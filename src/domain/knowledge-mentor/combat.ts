import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import { createAlchemistLifeState, type AlchemistCreation } from '../alchemist/life.js';
import type { SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { findKnowledgeMentorOriginalCreation, validateKnowledgeMentorCombatPlate, type KnowledgeMentorCombatPlate } from './life.js';
import { KNOWLEDGE_MENTOR_TARGET_ID, KNOWLEDGE_MENTOR_POWER_IDS, KNOWLEDGE_MENTOR_POWERS, hasKnowledgeMentorDisputeOpponent,
  type KnowledgeMentorEnemyIntent, type KnowledgeMentorPowerId } from './encounter.js';

/** Candidate finite G2 extension; retains actual Paragon4 core30/30/25/15,
 * 1250/floor125, maxS120, CONTINUE-only12 and the original1–6 count budgets. */
export const KNOWLEDGE_MENTOR_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const KNOWLEDGE_MENTOR_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const knowledgeMentorActionCount = pyromaniacActionCount;
export const knowledgeMentorEnemyActionCount = pyromaniacActionCount;
export type KnowledgeMentorMoveId = 'paragon.s2.protocol-binding' | 'paragon.s2.bounded-calibration' | 'paragon.s3.bounded-analysis' | 'paragon.s3.construct-coordination' | 'paragon.s4.animate-made-object'
  | 'paragon.s4.direct-creation' | 'paragon.s5.precision-focus' | 'STRIKE' | 'EVADE' | 'OBSERVE' | 'ACCIDENT';
const BINDING = 'paragon.s2.protocol-binding', CALIBRATION = 'paragon.s2.bounded-calibration';
const ANALYSIS = 'paragon.s3.bounded-analysis', COORDINATION = 'paragon.s3.construct-coordination';
const ANIMATE = 'paragon.s4.animate-made-object', DIRECT = 'paragon.s4.direct-creation', FOCUS = 'paragon.s5.precision-focus';
export const KNOWLEDGE_MENTOR_PLAYER_ABILITIES: readonly { id: KnowledgeMentorMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: BINDING, label: '候选有限工序封装（每轮一次，原指令片+5S+原件各1储能/知识18，G）', weight: 20, stance: 'ATTACK' },
  { id: CALIBRATION, label: '候选现场有限校准（每轮一次，4S+1M/知识18，下一次成功原件效果+18G）', weight: 15, stance: 'PREPARE' },
  { id: COORDINATION, label: '双原件有限协同（5S+各1储能/知识18，成功40/减20G）', weight: 15, stance: 'ATTACK' },
  { id: ANALYSIS, label: '有限结构解析（4S/知识18，下一次普通打击窗口G）', weight: 10, stance: 'CONTROL' },
  { id: ANIMATE, label: '继承原护架赋灵（4S+1储能/知识16，40×原掌握G）', weight: 10, stance: 'ATTACK' },
  { id: DIRECT, label: '继承指挥原护架（2S+1储能/减26G，须原架实际赋灵）', weight: 10, stance: 'DEFEND' },
  { id: FOCUS, label: '继承短时专注（2S/12×原掌握G）', weight: 5, stance: 'CONTROL' },
  { id: 'STRIKE', label: '本人普通原身体/实际在手原棍（12/16×身体G）', weight: 5, stance: 'ATTACK' },
  { id: 'EVADE', label: '本人普通避让（减10G，不免伤）', weight: 5, stance: 'DEFEND' },
  { id: 'OBSERVE', label: '观察眼前原人原物（0消耗/0贡献）', weight: 3, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡（固定−22.5G）', weight: 2, stance: null },
];
const ABILITIES = KNOWLEDGE_MENTOR_PLAYER_ABILITIES;
export const KNOWLEDGE_MENTOR_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'ARC_BOLT', label: '有限弧光术：7S/贡献105G', weight: 30 },
  { id: 'WARD', label: '有限护术：6S/减势60G', weight: 20 },
  { id: 'JAM', label: '有限干扰：3S/本轮下一次封装或协同抵抗30%→70%G', weight: 20 },
  { id: 'BODY_STRIKE', label: '自己的唯一原棍：20×身体G', weight: 20 },
  { id: 'OBSERVE', label: '普通观察原人原出口：0贡献', weight: 5 },
  { id: 'ACCIDENT', label: '判断偏差：−22.5G', weight: 5 },
];
export const isKnowledgeMentor = (s: SliceState) => s.progression.pathwayId === 'paragon' && s.progression.sequence === 2;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function knowledgeMentorAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: weights[i]! / total * 100 }));
}
export function drawKnowledgeMentorAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): KnowledgeMentorMoveId {
  const weights = tickets(stance); let n = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { n -= weights[i]!; if (n <= 0) return a.id; } throw new Error('候选知识导师能力盘无效。');
}
export function drawKnowledgeMentorEnemyAbility(random: ActionRandomStream): KnowledgeMentorEnemyIntent {
  let n = random.nextInt(1, 100); for (const a of KNOWLEDGE_MENTOR_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as KnowledgeMentorEnemyIntent; } throw new Error('原罗温·黑尔能力盘无效。');
}
export interface KnowledgeMentorCombatSource {
  runId: string; randomSeed: string; randomCursor: number; revision: number; week: number; round: number; encounterId: 'KNOWLEDGE_MENTOR_DISPUTE'; targetId: typeof KNOWLEDGE_MENTOR_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetAge: 48; targetSequence: 2; enemyPhysique: 24; actualOriginalBody: true; independentMind: true;
  enemyWeapon: 'KM2-ROWAN-CLUB'; weaponLocation: 'HAND'; distanceMetres: 2; space: 'KM2-OPEN-WORKSHOP-YARD'; ordinaryExit: true; pursuit: false; noBystanders: true; ordinaryExitMetres: 4; ordinaryExitSeconds: 4;
  playerHealth: number; playerMind: number; playerSpirituality: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  playerCoreStats: { physique: number; perception: number; will: number; knowledge: number }; playerInjuries: SliceInjury[]; enemyInjuries: SliceInjury[]; playerRisk: number; enemyRisk: number;
  clubHeld: boolean; knowledge: number; mastery: Record<string, number>; powerUses: Record<KnowledgeMentorPowerId, number>;
  carriedIds: ('AL4-BOX-1' | 'AL4-FRAME-1')[]; creations: AlchemistCreation[]; carriedPlateIds: string[]; combatPlates: KnowledgeMentorCombatPlate[];
  protocolUses: number; protocolSuccesses: number; calibrationUses: number; calibrationSuccesses: number; calibrationEffects: number; totalOwnerMindSpent: number;
}
const bounded = (n: number, max: number) => Math.max(0, Math.min(max, Number.isFinite(n) ? n : 0));
export function currentKnowledgeMentorCombatSource(s: SliceState, pendingRevision = false): KnowledgeMentorCombatSource | null {
  if (!hasKnowledgeMentorDisputeOpponent(s)) return null;
  const e = s.knowledgeMentor.encounter, c = s.combat!;
  const source: KnowledgeMentorCombatSource = { runId: s.runId, randomSeed: s.random.seed, randomCursor: s.random.cursor, revision: s.revision, week: s.week, round: c.round, encounterId: 'KNOWLEDGE_MENTOR_DISPUTE', targetId: KNOWLEDGE_MENTOR_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetAge: 48, targetSequence: 2, enemyPhysique: 24, actualOriginalBody: true, independentMind: true,
    enemyWeapon: 'KM2-ROWAN-CLUB', weaponLocation: 'HAND', distanceMetres: 2, space: 'KM2-OPEN-WORKSHOP-YARD', ordinaryExit: true, pursuit: false, noBystanders: true, ordinaryExitMetres: 4, ordinaryExitSeconds: 4,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality,
    playerCoreStats: { ...s.character.coreStats }, playerInjuries: structuredClone(s.injuries), enemyInjuries: structuredClone(c.enemyInjuries), playerRisk: s.injuryRisk, enemyRisk: c.enemyRisk,
    clubHeld: s.town.clubLocation === 'HAND', knowledge: s.character.coreStats.knowledge,
    mastery: Object.fromEntries(ABILITIES.filter(a => a.id.startsWith('paragon.')).map(a => [a.id, bounded(s.progression.mastery[a.id] ?? 0, 500)])),
    powerUses: { ...e.powerUses }, carriedIds: [...e.carriedIds], creations: e.carriedIds.map(id => structuredClone(findKnowledgeMentorOriginalCreation(s, id)!)),
    carriedPlateIds: [...e.carriedPlateIds], combatPlates: e.carriedPlateIds.map(id => structuredClone(s.knowledgeMentor.life.combatPlates.find(p => p.id === id)!)),
    protocolUses: e.protocolUses, protocolSuccesses: e.protocolSuccesses, calibrationUses: e.calibrationUses, calibrationSuccesses: e.calibrationSuccesses, calibrationEffects: e.calibrationEffects, totalOwnerMindSpent: e.totalOwnerMindSpent };
  return validateKnowledgeMentorCombatSource(source, pendingRevision) ? source : null;
}
export interface KnowledgeMentorCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: boolean }
interface ActionEvidence extends KnowledgeMentorCombatEffect { order: number; paidCost: number; physicalFactor: number; rolls: number[] }
export interface KnowledgeMentorPlayerAction extends ActionEvidence {
  id: KnowledgeMentorMoveId; boxChargeSpent: number; frameChargeSpent: number;
  coordinationResult: 'NONE' | 'FAILED' | 'RESISTED' | 'SUCCEEDED'; analysisOpened: boolean; analysisUsed: boolean;
  mentalCost: number; plateId: string | null; protocolResult: 'NONE' | 'FAILED' | 'RESISTED' | 'SUCCEEDED'; calibrationResult: 'NONE' | 'FAILED' | 'SUCCEEDED'; calibrationUsed: boolean; calibrationBonus: 0 | 18; actualAbilityUsed: boolean;
}
export interface KnowledgeMentorEnemyAction extends ActionEvidence { planned: KnowledgeMentorEnemyIntent; actual: KnowledgeMentorEnemyIntent; frameDurabilityDamage: number }
interface RoundModel {
  playerSpirituality: number; playerMind: number; enemySpirituality: number; powerUses: Record<KnowledgeMentorPowerId, number>;
  creations: AlchemistCreation[]; combatPlates: KnowledgeMentorCombatPlate[]; analysisWindow: boolean; jammed: boolean; pendingGuards: number;
  bindingAttempted: boolean; calibrationAttempted: boolean; calibrationWindow: boolean;
  protocolUses: number; protocolSuccesses: number; calibrationUses: number; calibrationSuccesses: number; calibrationEffects: number; totalOwnerMindSpent: number;
}
export interface KnowledgeMentorRoundContext {
  source: KnowledgeMentorCombatSource; stance: SliceStance; finished: boolean; liveState: string; model: RoundModel;
  playerSpiritualityBefore: number; enemySpiritualityBefore: number; playerActions: KnowledgeMentorPlayerAction[]; enemyActions: KnowledgeMentorEnemyAction[]; label: string;
}
const none = (label: string): KnowledgeMentorCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false });
function initialModel(source: KnowledgeMentorCombatSource): RoundModel {
  return { playerSpirituality: source.playerSpirituality, playerMind: source.playerMind, enemySpirituality: source.enemySpirituality, powerUses: { ...source.powerUses },
    creations: structuredClone(source.creations), combatPlates: structuredClone(source.combatPlates), analysisWindow: false, jammed: false, pendingGuards: 0,
    bindingAttempted: false, calibrationAttempted: false, calibrationWindow: false, protocolUses: source.protocolUses, protocolSuccesses: source.protocolSuccesses, calibrationUses: source.calibrationUses, calibrationSuccesses: source.calibrationSuccesses, calibrationEffects: source.calibrationEffects, totalOwnerMindSpent: source.totalOwnerMindSpent };
}
function liveState(s: SliceState): string {
  const e = s.knowledgeMentor.encounter;
  return stableStringify({ playerSpirituality: s.spirituality, playerMind: s.mind, enemySpirituality: e.enemySpirituality, powerUses: e.powerUses,
    creations: e.carriedIds.map(id => findKnowledgeMentorOriginalCreation(s, id)), combatPlates: e.carriedPlateIds.map(id => s.knowledgeMentor.life.combatPlates.find(p => p.id === id)),
    protocolUses: e.protocolUses, protocolSuccesses: e.protocolSuccesses, calibrationUses: e.calibrationUses, calibrationSuccesses: e.calibrationSuccesses, calibrationEffects: e.calibrationEffects, totalOwnerMindSpent: e.totalOwnerMindSpent });
}
function commit(s: SliceState, r: KnowledgeMentorRoundContext): void {
  const m = r.model, e = s.knowledgeMentor.encounter;
  s.spirituality = m.playerSpirituality; s.mind = m.playerMind; e.enemySpirituality = m.enemySpirituality; e.powerUses = { ...m.powerUses };
  for (const x of m.creations) {
    const original = findKnowledgeMentorOriginalCreation(s, x.id);
    if (!original || original.location !== 'YARD') throw new Error('同一原造物已不在本场。');
    original.charge = x.charge; original.durability = x.durability; original.active = x.active;
  }
  for (const plate of m.combatPlates) {
    const original = s.knowledgeMentor.life.combatPlates.find(p => p.id === plate.id);
    if (!original || original.location !== 'YARD') throw new Error('同一实付原指令片已不在本场。');
    original.status = plate.status; original.spentRevision = plate.spentRevision;
  }
  for (const key of ['protocolUses', 'protocolSuccesses', 'calibrationUses', 'calibrationSuccesses', 'calibrationEffects', 'totalOwnerMindSpent'] as const) e[key] = m[key];
  r.liveState = liveState(s);
}
const dynamicSource = new Set(['playerSpirituality', 'playerMind', 'enemySpirituality', 'powerUses', 'creations', 'combatPlates', 'protocolUses', 'protocolSuccesses', 'calibrationUses', 'calibrationSuccesses', 'calibrationEffects', 'totalOwnerMindSpent']);
function validRound(s: SliceState, r: KnowledgeMentorRoundContext, supplied: KnowledgeMentorCombatSource | null): boolean {
  const actual = currentKnowledgeMentorCombatSource(s, true);
  return !r.finished && actual !== null && supplied !== null && stableStringify(supplied) === stableStringify(r.source) && r.liveState === liveState(s) &&
    Object.entries(r.source).every(([key, value]) => dynamicSource.has(key) || stableStringify(actual[key as keyof KnowledgeMentorCombatSource]) === stableStringify(value));
}
export function beginKnowledgeMentorCombatRound(s: SliceState, stance: SliceStance, _random: ActionRandomStream): KnowledgeMentorRoundContext {
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('候选知识导师本轮姿态无效。');
  const source = currentKnowledgeMentorCombatSource(s); if (!source) throw new Error('缺少原罗温·黑尔、原棍和本场原物连续资源来源。');
  const r: KnowledgeMentorRoundContext = { source, stance, finished: false, liveState: '', model: initialModel(source), playerSpiritualityBefore: s.spirituality,
    enemySpiritualityBefore: s.knowledgeMentor.encounter.enemySpirituality, playerActions: [], enemyActions: [], label: '' };
  commit(s, r); r.label = `同一48岁原罗温·黑尔在独立工院2米外，独立灵性${r.enemySpiritualityBefore}/120。原盒原架仍用旧唯一资源，缺能普通回退；候选知识导师2映射、能力及数值全为G，原著配方仪式未知。`; return r;
}
export const createKnowledgeMentorCombatRound = beginKnowledgeMentorCombatRound;
function actionBase(order: number, physical: number): ActionEvidence { return { ...none(''), order, paidCost: 0, physicalFactor: physical, rolls: [] }; }
const originalMastery = (source: KnowledgeMentorCombatSource, id: string) => 0.65 + 0.35 * (source.mastery[id] ?? 0) / 500;
function playerAction(source: KnowledgeMentorCombatSource, m: RoundModel, id: KnowledgeMentorMoveId, physical: number, order: number, roll: () => number): KnowledgeMentorPlayerAction {
  const a: KnowledgeMentorPlayerAction = { ...actionBase(order, physical), id, boxChargeSpent: 0, frameChargeSpent: 0, coordinationResult: 'NONE', analysisOpened: false, analysisUsed: false, mentalCost: 0, plateId: null, protocolResult: 'NONE', calibrationResult: 'NONE', calibrationUsed: false, calibrationBonus: 0, actualAbilityUsed: false };
  const frame = m.creations.find(x => x.id === 'AL4-FRAME-1'), box = m.creations.find(x => x.id === 'AL4-BOX-1');
  const usable = (x: AlchemistCreation | undefined): x is AlchemistCreation => !!x && x.location === 'YARD' && x.charge > 0 && x.durability > 0;
  const pay = (n: number) => { if (m.playerSpirituality < n) return false; m.playerSpirituality -= n; a.paidCost = n; a.actualAbilityUsed = true; return true; };
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
      else { m.analysisWindow = true; a.analysisOpened = true; a.label = `有限结构解析知识${c.roll}≤${c.chance}，实付4S；只对眼前原罗温·黑尔的本轮下一次普通身体打击开一次额外12×身体G弱处窗口，未打中不直接扣H，不读取隐藏真相。轮末失效。`; }
    }
  } else if (id === CALIBRATION) {
    if (m.calibrationAttempted) a.label = '本轮已经实际尝试一次候选校准，普通观察0消耗0贡献，不叠加、不重骰（G）。';
    else if (!box || !frame || box.location !== 'YARD' || frame.location !== 'YARD' || box.durability <= 0 || frame.durability <= 0 || m.playerSpirituality < 4 || m.playerMind < 1)
      a.label = '同一原盒原架未完好在眼前，或不足4灵性与1精神，候选校准未施展；普通观察，不修复、不补能（G）。';
    else {
      m.calibrationAttempted = true; pay(4); m.playerMind--; a.mentalCost = 1; m.totalOwnerMindSpent++; m.calibrationUses++;
      const c = check(18);
      if (c.roll > c.chance) { a.calibrationResult = 'FAILED'; a.label = `候选现场校准知识${c.roll}>${c.chance}失败，实付4S与1M不退，本轮不再尝试（G）。`; }
      else { m.calibrationWindow = true; m.calibrationSuccesses++; a.calibrationResult = 'SUCCEEDED'; a.label = `候选现场校准知识${c.roll}≤${c.chance}，实付4S与1M；仅本轮下一次实际成功的原造物动作有限加18G，普通回退不消费，轮末到期。没有充能、修复或未知弱点。`; }
    }
  } else if (id === BINDING) {
    const plate = m.combatPlates.find(p => p.status === 'READY' && p.location === 'YARD' && source.carriedPlateIds.includes(p.id));
    if (m.bindingAttempted) strike('本轮已尝试一次候选有限封装，不重试；');
    else if (!usable(frame) || !usable(box) || !plate || m.playerSpirituality < 5) strike('缺少实际准备的READY原指令片、原件各1储能或本人5S，候选有限封装未施展；');
    else {
      m.bindingAttempted = true; m.protocolUses++; pay(5); plate.status = 'SPENT'; plate.spentRevision = source.revision + 1; a.plateId = plate.id;
      frame.charge--; box.charge--; a.frameChargeSpent = 1; a.boxChargeSpent = 1; frame.active = false; box.active = false;
      const c = check(18);
      if (c.roll > c.chance) { a.protocolResult = 'FAILED'; a.label = `候选封装知识${c.roll}>${c.chance}失败；原指令片${plate.id}真实用尽留院，5S与原件各1储能不退，0贡献0减势（G）。`; }
      else {
        const resistance = m.jammed ? 70 : 30, n = roll(), jammed = m.jammed; a.rolls.push(n); m.jammed = false;
        if (n <= resistance) { a.protocolResult = 'RESISTED'; a.label = `候选封装知识${c.roll}≤${c.chance}，原罗温·黑尔${jammed ? '实付3S的定向干扰' : '普通抵抗'}${n}≤${resistance}抵挡；原片${plate.id}用尽留院，5S及原件各1储能不退（G）。`; }
        else { a.protocolResult = 'SUCCEEDED'; m.protocolSuccesses++; a.selfGain = 40; a.enemyReduction = 20; a.threatens = true;
          a.label = `候选封装知识${c.roll}≤${c.chance}、抵抗${n}>${resistance}，实耗原片${plate.id}、5S及原件各1储能；同一原架开既有17毫米开口、原盒沿眼前原线移2米、同一原架关闭，只执行实付原片的三步，有限贡献40/减势20G。本槽结束即停止，没有第二轮盘或新身体。原片实物留院。`; }
      }
    }
  } else if (id === COORDINATION) {
    if (!usable(frame) || !usable(box) || m.playerSpirituality < 5) strike('原盒原架未同时在场可用、储能不足1或本人不足5S，未施展协同；');
    else {
      pay(5); frame.charge--; box.charge--; a.frameChargeSpent = 1; a.boxChargeSpent = 1; frame.active = false; box.active = false;
      const c = check(18);
      if (c.roll > c.chance) { a.coordinationResult = 'FAILED'; a.label = `两原件有限协同知识${c.roll}>${c.chance}失配，实付5S及原盒原架各1储能不退；两件实际停止，0贡献0减势，无新架或重抽。`; }
      else { const resistance = m.jammed ? 70 : 30, n = roll(), jammed = m.jammed; a.rolls.push(n); m.jammed = false;
        if (n <= resistance) { a.coordinationResult = 'RESISTED'; a.label = `协同知识${c.roll}≤${c.chance}，但原罗温·黑尔${jammed ? '实付3S的一次干扰' : '普通抵抗'}${n}≤${resistance}G，中止本次两件动作；已付5S和各1储能不退，0贡献0减势。`; }
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
  const originalSucceeded = a.protocolResult === 'SUCCEEDED' || a.coordinationResult === 'SUCCEEDED' ||
    id === ANIMATE && a.actualAbilityUsed && a.selfGain > 0 || id === DIRECT && a.actualAbilityUsed && a.enemyReduction > 0;
  if (m.calibrationWindow && originalSucceeded) {
    m.calibrationWindow = false; m.calibrationEffects++; a.calibrationUsed = true; a.calibrationBonus = 18;
    if (a.selfGain > 0) a.selfGain += 18; else a.enemyReduction += 18;
    a.label += '本次实际成功原件动作消费已实付的本轮校准窗口，已有贡献（或纯防守减势）额外18G；不新增动作、不修复或回充。';
  }
  return a;
}
function enemyAction(m: RoundModel, planned: KnowledgeMentorEnemyIntent, physical: number, order: number): KnowledgeMentorEnemyAction {
  const a: KnowledgeMentorEnemyAction = { ...actionBase(order, physical), planned, actual: planned, frameDurabilityDamage: 0 }, power = KNOWLEDGE_MENTOR_POWERS.find(p => p.id === planned);
  if (planned === 'JAM' && m.jammed) { a.actual = 'OBSERVE'; a.label = '原罗温·黑尔本轮已有一次未消费干扰，普通观察0贡献0消耗，不叠加或延长。'; }
  else if (power && m.enemySpirituality >= power.cost) {
    m.enemySpirituality -= power.cost; m.powerUses[power.id]++; a.paidCost = power.cost; a.selfGain = power.selfGain; a.enemyReduction = power.enemyReduction; a.threatens = power.selfGain > 0;
    if (planned === 'JAM') m.jammed = true;
    a.label = `同一原罗温·黑尔${power.label}：独立原灵性实际−${power.cost}、余${m.enemySpirituality}/120；${planned === 'JAM' ? '本轮下一次成功施展封装或协同的抵抗30%提高70%G，消费后或轮末失效' : `贡献${a.selfGain}/减势${a.enemyReduction}G`}，不借本人原资源。`;
  } else if (planned === 'OBSERVE') a.label = '原罗温·黑尔普通观察原身体、原物和出口，0贡献0消耗，没有免费干扰。';
  else if (planned === 'ACCIDENT') { a.selfGain = -22.5; a.label = '原罗温·黑尔本槽判断偏差，贡献−22.5G，不重抽。'; }
  else { a.actual = 'BODY_STRIKE'; a.selfGain = 20 * physical; a.threatens = a.selfGain > 0; a.label = `${power ? '独立灵性不足，未施法、不重抽；' : ''}原罗温·黑尔以自己的唯一原棍KM2-ROWAN-CLUB普通打击20×身体G。`;
    const frame = m.creations.find(x => x.id === 'AL4-FRAME-1');
    if (a.threatens && m.pendingGuards > 0 && frame && frame.durability > 0) {
      m.pendingGuards--; a.frameDurabilityDamage = Math.min(5, frame.durability); frame.durability -= a.frameDurabilityDamage; if (frame.durability === 0) frame.active = false;
      a.label += `已付指挥的同一原护架实际承接本次原棍，耐久−${a.frameDurabilityDamage}至${frame.durability}；已计减势不重复叠加，不取消伤势盘。`;
    }
  }
  return a;
}
const allowed = (id: string): id is KnowledgeMentorMoveId => ABILITIES.some(a => a.id === id);
const enemyAllowed = (id: string): id is KnowledgeMentorEnemyIntent => KNOWLEDGE_MENTOR_ENEMY_ABILITY_WHEEL.some(a => a.id === id);
export function resolveKnowledgeMentorCombatAbility(s: SliceState, id: KnowledgeMentorMoveId, physical: number, random: ActionRandomStream,
  r: KnowledgeMentorRoundContext, source: KnowledgeMentorCombatSource | null = r.source): KnowledgeMentorCombatEffect {
  if (!allowed(id) || r.playerActions.length >= 6 || !validRound(s, r, source)) return none('本轮原身体、罗温·黑尔或同一原物资源来源不符：0贡献0消耗，不重抽。');
  const a = playerAction(r.source, r.model, id, bounded(physical, 1), r.playerActions.length + r.enemyActions.length, () => random.nextInt(1, 100));
  r.playerActions.push(a); commit(s, r); return a;
}
export function resolveKnowledgeMentorEnemyAbility(s: SliceState, planned: KnowledgeMentorEnemyIntent, physical: number, _random: ActionRandomStream,
  r: KnowledgeMentorRoundContext, source: KnowledgeMentorCombatSource | null = r.source): KnowledgeMentorCombatEffect {
  if (!enemyAllowed(planned) || r.enemyActions.length >= 6 || !validRound(s, r, source)) return none('本轮原罗温·黑尔独立身体/资源来源不符：0贡献0消耗，不重抽。');
  const a = enemyAction(r.model, planned, bounded(physical, 1), r.playerActions.length + r.enemyActions.length); r.enemyActions.push(a); commit(s, r); return a;
}
export interface KnowledgeMentorRoundOutcome {
  targetId: typeof KNOWLEDGE_MENTOR_TARGET_ID; round: number; source: KnowledgeMentorCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number; enemySpiritualityBefore: number;
  powerUses: Record<KnowledgeMentorPowerId, number>; creations: AlchemistCreation[]; combatPlates: KnowledgeMentorCombatPlate[];
  protocolUses: number; protocolSuccesses: number; calibrationUses: number; calibrationSuccesses: number; calibrationEffects: number; totalOwnerMindSpent: number;
  playerInjuriesAfter: SliceInjury[]; enemyInjuriesAfter: SliceInjury[]; playerRiskAfter: number; enemyRiskAfter: number; randomCursorAfter: number;
  calibrationActiveAfter: false;
  analysisActiveAfter: false; coordinationActiveAfter: false; resistanceActiveAfter: false; elapsedSeconds: 60;
  playerActions: KnowledgeMentorPlayerAction[]; enemyActions: KnowledgeMentorEnemyAction[];
}
export function finishKnowledgeMentorCombatRound(s: SliceState, r: KnowledgeMentorRoundContext, continuing = true, randomCursorAfter = r.source.randomCursor): KnowledgeMentorRoundOutcome {
  const e = s.knowledgeMentor.encounter, c = s.combat, m = r.model;
  if (r.finished || !c || c.encounterId !== 'KNOWLEDGE_MENTOR_DISPUTE' || c.round !== r.source.round || r.liveState !== liveState(s)) throw new Error('原候选知识导师回合已结束或真实资源被改写。');
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus; e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk;
  if (e.enemyStatus !== 'RESISTING') e.weaponLocation = 'YARD';
  for (const x of m.creations) if (!continuing || x.charge === 0 || x.durability === 0) x.active = false;
  m.analysisWindow = false; m.calibrationWindow = false; m.jammed = false; m.pendingGuards = 0; commit(s, r); r.finished = true;
  return { targetId: KNOWLEDGE_MENTOR_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus,
    playerSpiritualityBefore: r.playerSpiritualityBefore, playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind, enemySpiritualityBefore: r.enemySpiritualityBefore,
    powerUses: { ...e.powerUses }, creations: structuredClone(m.creations), combatPlates: structuredClone(m.combatPlates),
    playerInjuriesAfter: structuredClone(s.injuries), enemyInjuriesAfter: structuredClone(c.enemyInjuries), playerRiskAfter: s.injuryRisk, enemyRiskAfter: c.enemyRisk, randomCursorAfter,
    protocolUses: m.protocolUses, protocolSuccesses: m.protocolSuccesses, calibrationUses: m.calibrationUses, calibrationSuccesses: m.calibrationSuccesses, calibrationEffects: m.calibrationEffects, totalOwnerMindSpent: m.totalOwnerMindSpent, calibrationActiveAfter: false, analysisActiveAfter: false, coordinationActiveAfter: false, resistanceActiveAfter: false,
    elapsedSeconds: 60, playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
}
export function projectKnowledgeMentorCombat(s: SliceState) {
  const e = s.knowledgeMentor.encounter;
  return { enemyName: '罗温·黑尔（48岁，原创有限G2等效对手）', targetId: e.targetId, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality,
    powerUses: { ...e.powerUses }, creations: e.carriedIds.map(id => structuredClone(findKnowledgeMentorOriginalCreation(s, id))),
    combatPlates: e.carriedPlateIds.map(id => structuredClone(s.knowledgeMentor.life.combatPlates.find(p => p.id === id))),
    protocolUses: e.protocolUses, protocolSuccesses: e.protocolSuccesses, calibrationUses: e.calibrationUses, calibrationSuccesses: e.calibrationSuccesses, calibrationEffects: e.calibrationEffects, totalOwnerMindSpent: e.totalOwnerMindSpent,
    originalExit: true, pursuit: false, distanceMetres: 2, exitTravelMetres: e.exitTravelMetres, exitSeconds: e.exitSeconds, source: currentKnowledgeMentorCombatSource(s),
    summary: '候选知识导师2及新增能力均G，原著配方仪式未知。双方1–6次数权重10/15/25/25/15/10；继承真实体30/感30/意25/知15，1250/底125、灵性上限120，仅继续轮恢复12G。新封装每轮至多一次：实际READY原指令片+5S+两原件各1储能，知识18，成功40/减20，抵抗30%、对方实付3S干扰提高至70%。新校准每轮一次4S+1M/知识18，下一次成功原造物动作+18G，普通回退不加成。原片实物保留，原件缺能普通行动；旧赋灵、指挥、专注、解析与协同沿原ID与成本。生还亲手取回原件和片后实走4米4秒；死亡同物停止留院，无替死复活。' };
}
const SOURCE_KEYS = ['runId', 'randomSeed', 'randomCursor', 'revision', 'week', 'round', 'encounterId', 'targetId', 'attemptWeek', 'startHistoryIndex', 'targetAge', 'targetSequence', 'enemyPhysique', 'actualOriginalBody', 'independentMind', 'enemyWeapon', 'weaponLocation', 'distanceMetres', 'space', 'ordinaryExit', 'pursuit', 'noBystanders', 'ordinaryExitMetres', 'ordinaryExitSeconds', 'playerHealth', 'playerMind', 'playerSpirituality', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'playerCoreStats', 'playerInjuries', 'enemyInjuries', 'playerRisk', 'enemyRisk', 'clubHeld', 'knowledge', 'mastery', 'powerUses', 'carriedIds', 'creations', 'carriedPlateIds', 'combatPlates', 'protocolUses', 'protocolSuccesses', 'calibrationUses', 'calibrationSuccesses', 'calibrationEffects', 'totalOwnerMindSpent'];
const OUTCOME_KEYS = ['targetId', 'round', 'source', 'stance', 'continuing', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus', 'playerSpiritualityBefore', 'playerSpiritualityAfter', 'playerHealthAfter', 'playerMindAfter', 'enemySpiritualityBefore', 'powerUses', 'creations', 'combatPlates', 'protocolUses', 'protocolSuccesses', 'calibrationUses', 'calibrationSuccesses', 'calibrationEffects', 'totalOwnerMindSpent', 'calibrationActiveAfter', 'analysisActiveAfter', 'coordinationActiveAfter', 'resistanceActiveAfter', 'elapsedSeconds', 'playerActions', 'enemyActions', 'playerInjuriesAfter', 'enemyInjuriesAfter', 'playerRiskAfter', 'enemyRiskAfter', 'randomCursorAfter'];
const exactKeys = (value: object, keys: readonly string[]) => !!value && same(Object.keys(value).sort(), [...keys].sort());
function validInjuries(value: SliceInjury[], revision: number): boolean {
  return Array.isArray(value) && new Set(value.map(x => x?.id)).size === value.length && value.every(x => !!x && exactKeys(x, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof x.id === 'string' && ['LIGHT', 'HEAVY'].includes(x.severity) && integer(x.acquiredRevision, 0, revision) && (x.treatedRevision === null || integer(x.treatedRevision, x.acquiredRevision, revision)));
}
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const COUNTER_KEYS = ['protocolUses', 'protocolSuccesses', 'calibrationUses', 'calibrationSuccesses', 'calibrationEffects', 'totalOwnerMindSpent'] as const;
type Counters = Pick<KnowledgeMentorCombatSource, typeof COUNTER_KEYS[number]>;
function validCounters(c: Counters): boolean {
  return COUNTER_KEYS.every(k => integer(c[k])) && c.protocolSuccesses <= c.protocolUses && c.calibrationSuccesses <= c.calibrationUses && c.calibrationEffects <= c.calibrationSuccesses && c.totalOwnerMindSpent === c.calibrationUses;
}
function countersEqual(a: Counters, b: Counters): boolean { return COUNTER_KEYS.every(k => a[k] === b[k]); }

export function validateKnowledgeMentorCombatSource(source: KnowledgeMentorCombatSource, pendingRevision = false): boolean {
  const origins = createAlchemistLifeState().materials;
  return !!source && exactKeys(source, SOURCE_KEYS) && typeof source.runId === 'string' && source.runId.length > 0 && typeof source.randomSeed === 'string' && source.randomSeed.length > 0 && source.randomSeed.length <= 256 && integer(source.randomCursor) && integer(source.revision) && integer(source.week, 1) && integer(source.round, 1) && source.attemptWeek === source.week && integer(source.startHistoryIndex) &&
    source.encounterId === 'KNOWLEDGE_MENTOR_DISPUTE' && source.targetId === KNOWLEDGE_MENTOR_TARGET_ID && source.targetAge === 48 && source.targetSequence === 2 && source.enemyPhysique === 24 && source.actualOriginalBody === true && source.independentMind === true &&
    source.enemyWeapon === 'KM2-ROWAN-CLUB' && source.weaponLocation === 'HAND' && source.distanceMetres === 2 && source.space === 'KM2-OPEN-WORKSHOP-YARD' && source.ordinaryExit === true && source.pursuit === false && source.noBystanders === true && source.ordinaryExitMetres === 4 && source.ordinaryExitSeconds === 4 &&
    [source.playerHealth, source.enemyHealth, source.enemyMind].every(n => integer(n, 1, 100)) && integer(source.playerMind, 0, 100) && [source.playerSpirituality, source.enemySpirituality].every(n => integer(n, 0, 120)) && !!source.playerCoreStats && exactKeys(source.playerCoreStats, ['physique', 'perception', 'will', 'knowledge']) && Object.values(source.playerCoreStats).every(n => integer(n, 0, 500)) && source.knowledge === source.playerCoreStats.knowledge && validInjuries(source.playerInjuries, source.revision) && validInjuries(source.enemyInjuries, source.revision) && integer(source.playerRisk) && integer(source.enemyRisk) && typeof source.clubHeld === 'boolean' && integer(source.knowledge, 0, 500) &&
    !!source.mastery && same(Object.keys(source.mastery).sort(), ABILITIES.filter(a => a.id.startsWith('paragon.')).map(a => a.id).sort()) && Object.values(source.mastery).every(n => integer(n, 0, 500)) &&
    !!source.powerUses && Object.keys(source.powerUses).length === 3 && KNOWLEDGE_MENTOR_POWER_IDS.every(id => integer(source.powerUses[id])) && source.enemySpirituality === 120 - KNOWLEDGE_MENTOR_POWERS.reduce((n, p) => n + source.powerUses[p.id] * p.cost, 0) &&
    Array.isArray(source.carriedIds) && same(source.carriedIds, ['AL4-BOX-1', 'AL4-FRAME-1']) && Array.isArray(source.creations) && source.creations.length === source.carriedIds.length &&
    validCounters(source) && Array.isArray(source.carriedPlateIds) && source.carriedPlateIds.length <= 3 && new Set(source.carriedPlateIds).size === source.carriedPlateIds.length &&
    Array.isArray(source.combatPlates) && source.combatPlates.length === source.carriedPlateIds.length && source.combatPlates.every((p, i) => p.id === source.carriedPlateIds[i] && p.location === 'YARD' && p.status !== 'FAILED' && validateKnowledgeMentorCombatPlate(p, source.week, source.revision + (pendingRevision ? 1 : 0))) &&
    source.creations.every((x, i) => { const box = x.id === 'AL4-BOX-1', origin = origins[box ? 0 : 1]!;
      return exactKeys(x, ['id', 'kind', 'source', 'componentIds', 'madeBy', 'owner', 'custodian', 'location', 'durability', 'charge', 'active', 'manufacturedWeek']) && x.id === source.carriedIds[i] && ['AL4-BOX-1', 'AL4-FRAME-1'].includes(x.id) && x.kind === (box ? 'MESSENGER_BOX' : 'GUARD_FRAME') && x.madeBy === source.runId && x.owner === 'PLAYER' && x.custodian === 'PLAYER' && x.location === 'YARD' &&
        x.source === origin.source && same(x.componentIds, origin.componentIds) && integer(x.manufacturedWeek, 1, source.week) && integer(x.charge, 0, 3) && integer(x.durability, 0, 100) && typeof x.active === 'boolean' && (!x.active || x.charge > 0 && x.durability > 0); });
}
/** Validate finite paid actions and the original objects only. The established
 * common combat adapter remains the sole authority for physical injury/death. */
export function validateKnowledgeMentorRoundOutcome(value: unknown): value is KnowledgeMentorRoundOutcome {
  try {
    const o = value as KnowledgeMentorRoundOutcome;
    if (!o || !exactKeys(o, OUTCOME_KEYS) || !validInjuries(o.playerInjuriesAfter, o.source?.revision + 1) || !validInjuries(o.enemyInjuriesAfter, o.source?.revision + 1) || !integer(o.playerRiskAfter) || !integer(o.enemyRiskAfter) || !integer(o.randomCursorAfter, o.source?.randomCursor) || !validateKnowledgeMentorCombatSource(o.source) || o.targetId !== KNOWLEDGE_MENTOR_TARGET_ID || o.round !== o.source.round || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(o.stance) || typeof o.continuing !== 'boolean' || o.elapsedSeconds !== 60 ||
        ![o.enemyHealth, o.playerHealthAfter].every(n => integer(n, 0, 100)) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(o.enemyStatus) || (o.enemyStatus === 'DEAD') !== (o.enemyHealth === 0) ||
        o.enemyMind !== o.source.enemyMind || !integer(o.playerMindAfter, 0, o.source.playerMind) || ![o.playerSpiritualityBefore, o.playerSpiritualityAfter, o.enemySpiritualityBefore, o.enemySpirituality].every(n => integer(n, 0, 120)) ||
        o.playerHealthAfter > o.source.playerHealth || o.enemyHealth > o.source.enemyHealth || o.playerSpiritualityBefore !== o.source.playerSpirituality || o.enemySpiritualityBefore !== o.source.enemySpirituality ||
        !Array.isArray(o.playerActions) || !Array.isArray(o.enemyActions) || o.playerActions.length > 6 || o.enemyActions.length > 6 || o.calibrationActiveAfter !== false || o.analysisActiveAfter !== false || o.coordinationActiveAfter !== false || o.resistanceActiveAfter !== false ||
        o.continuing && (o.enemyStatus !== 'RESISTING' || o.playerHealthAfter <= 0)) return false;
    const m = initialModel(o.source), all = [...o.playerActions.map(a => ({ actor: 'PLAYER', action: a })), ...o.enemyActions.map(a => ({ actor: 'ENEMY', action: a }))].sort((a, b) => a.action.order - b.action.order);
    for (const [i, item] of all.entries()) {
      const a = item.action;
      if (a.order !== i || !Number.isFinite(a.physicalFactor) || a.physicalFactor < 0 || a.physicalFactor > 1 || !Array.isArray(a.rolls) || a.rolls.some(n => !integer(n, 1, 100))) return false;
      let expected: KnowledgeMentorPlayerAction | KnowledgeMentorEnemyAction;
      if (item.actor === 'PLAYER') { const p = a as KnowledgeMentorPlayerAction; if (!allowed(p.id)) return false;
        let cursor = 0; expected = playerAction(o.source, m, p.id, p.physicalFactor, i, () => { const n = a.rolls[cursor++]; if (n === undefined) throw new Error('Missing recorded check'); return n; });
        if (cursor !== a.rolls.length) return false;
      } else { const e = a as KnowledgeMentorEnemyAction; if (!enemyAllowed(e.planned)) return false; expected = enemyAction(m, e.planned, e.physicalFactor, i); }
      if (!same(a, expected)) return false;
    }
    for (const x of m.creations) if (!o.continuing || x.charge === 0 || x.durability === 0) x.active = false;
    return o.playerMindAfter === m.playerMind && countersEqual(o, m) && same(o.combatPlates, m.combatPlates) && o.playerSpiritualityAfter === m.playerSpirituality && o.enemySpirituality === m.enemySpirituality && same(o.powerUses, m.powerUses) && same(o.creations, m.creations);
  } catch { return false; }
}
