import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { TRAVELER_COUNT_WHEEL, travelerActionCount } from '../traveler/combat.js';
import { DESPAIR_TARGET_ID, DESPAIR_POWERS, DESPAIR_POWER_IDS, hasDespairDisputeOpponent, type DespairEnemyIntent, type DespairPowerId } from './encounter.js';

export const DESPAIR_COUNT_WHEEL = TRAVELER_COUNT_WHEEL;
export const despairActionCount = travelerActionCount;
export const DESPAIR_ENEMY_COUNT_WHEEL: readonly SliceWheelEntry[] = [
  { id: '2', label: '2次', weight: 20 }, { id: '3', label: '3次', weight: 50 }, { id: '4', label: '4次', weight: 30 },
];
export const despairEnemyActionCount = (roll: number): number => roll <= 20 ? 2 : roll <= 70 ? 3 : 4;
export const DESPAIR_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'ARC_BOLT', label: '原弧光术：5灵性，贡献55（G）', weight: 30 },
  { id: 'FROST_GUARD', label: '原霜护：3灵性，对方−30（G）', weight: 25 },
  { id: 'SPRINT_STRIKE', label: '原短冲棍击：4灵性，50×身体（G）', weight: 20 },
  { id: 'BODY_STRIKE', label: '自有原棍普通打击：18×身体（G）', weight: 20 },
  { id: 'ACCIDENT', label: '实际失衡：0贡献，不恢复灵性', weight: 5 },
];
export type DespairMoveId = 'assassin.s7.black-flame' | 'assassin.s7.frost' | 'assassin.s7.substitute'
  | 'assassin.s4.plague' | 'assassin.s6.silk-binding' | 'ACCIDENT';
const ABILITIES: readonly { id: DespairMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'assassin.s7.black-flame', label: '继承黑焰（H，2灵性；实际持原棍则普通16）', weight: 30, stance: 'ATTACK' },
  { id: 'assassin.s7.frost', label: '继承冰霜牵制（J，2灵性，仅共同减势）', weight: 15, stance: 'ATTACK' },
  { id: 'assassin.s7.substitute', label: '实际已备原镜3灵性＋1面／原粉2灵性＋1剂／普通避让10（B）', weight: 20, stance: 'DEFEND' },
  { id: 'assassin.s4.plague', label: '有限超自然瘟疫（K，首次4灵性、知识18；后轮2灵性/强度＋1，最多6）', weight: 20, stance: 'CONTROL' },
  { id: 'assassin.s6.silk-binding', label: '实际布丝后另抽丝缚（R，每步3灵性，有身体抵抗）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡（A，固定−22.5，G）', weight: 5, stance: null },
];
export const isDespair = (s: SliceState): boolean => s.progression.pathwayId === 'demoness' && s.progression.sequence === 4;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function despairAbilityWheel(s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0), e = s.despair.encounter;
  return ABILITIES.map((a, i) => ({ id: a.id, weight: weights[i]! / total * 100,
    label: a.id === 'assassin.s4.plague' && (stance === 'DEFEND' || stance === 'RETREAT' || e.diseaseApplications > 0)
      ? '本槽普通自保10、0灵性；停止或已有原感染，不重启、不额外增长、不治愈'
      : a.id === 'assassin.s7.black-flame' && s.town.clubLocation === 'HAND' ? '实际原短棍打击16×身体，0灵性，替换黑焰'
      : a.label + (stance === 'DEFEND' ? '；开轮先停止新增暴露，持续症状保留' : '') }));
}
export function drawDespairAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): DespairMoveId {
  const weights = tickets(stance); let roll = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (let i = 0; i < ABILITIES.length; i++) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; }
  throw new Error('绝望魔女动作盘权重无效。');
}
export function drawDespairEnemyAbility(random: ActionRandomStream): DespairEnemyIntent {
  let roll = random.nextInt(1, 100);
  for (const a of DESPAIR_ENEMY_ABILITY_WHEEL) { roll -= a.weight; if (roll <= 0) return a.id as DespairEnemyIntent; }
  throw new Error('原瓦伦动作盘权重无效。');
}
export interface DespairCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'DESPAIR_DISPUTE'; targetId: typeof DESPAIR_TARGET_ID; attemptWeek: number; startHistoryIndex: number;
  playerHealth: number; playerMind: number; enemyHealth: number; enemyMind: number;
  clubLocation: SliceState['town']['clubLocation']; actualOriginalBody: true; mutuallyVisible: true;
  distanceMetres: 4; fieldRadiusMetres: 10; noBystanders: true; friendImmunity: false;
  ordinaryExit: true; pursuit: false; targetSequence: 5; targetPhysique: 20;
  enemyWeapon: 'DP4-VALEN-CLUB'; space: 'ORIGINAL_ABANDONED_ISOLATED_YARD';
}
export function currentDespairCombatSource(s: SliceState): DespairCombatSource | null {
  if (!hasDespairDisputeOpponent(s)) return null;
  const e = s.despair.encounter, c = s.combat!;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'DESPAIR_DISPUTE', targetId: DESPAIR_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, playerHealth: s.health, playerMind: s.mind,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, clubLocation: s.town.clubLocation,
    actualOriginalBody: true, mutuallyVisible: true, distanceMetres: 4, fieldRadiusMetres: 10, noBystanders: true, friendImmunity: false,
    ordinaryExit: true, pursuit: false, targetSequence: 5, targetPhysique: 20, enemyWeapon: 'DP4-VALEN-CLUB', space: 'ORIGINAL_ABANDONED_ISOLATED_YARD' };
}
function validSource(s: SliceState, source: DespairCombatSource | null): source is DespairCombatSource {
  const current = currentDespairCombatSource(s);
  return !!source && !!current && Object.entries(current).every(([k, v]) => (source as unknown as Record<string, unknown>)[k] === v);
}
export interface DespairEnemyAction {
  planned: DespairEnemyIntent; actual: DespairEnemyIntent | 'INTERRUPTED'; paidCost: number;
  diseaseAtAction: number; symptomChance: number | null; symptomRoll: number | null; interrupted: boolean;
}
export interface DespairRoundContext {
  source: DespairCombatSource; stance: SliceStance; finished: boolean;
  playerSpiritualityBefore: number; enemySpiritualityBefore: number; diseaseBefore: number;
  enemyActions: DespairEnemyAction[]; label: string;
}
export function beginDespairCombatRound(s: SliceState, stance: SliceStance): DespairRoundContext {
  const source = currentDespairCombatSource(s); if (!source) throw new Error('缺少绝望魔女当前原瓦伦、原身体、净空原院或连续回合来源；不借首案或旧奥伦。');
  const e = s.despair.encounter, playerSpiritualityBefore = s.spirituality, diseaseBefore = e.enemyDisease;
  let label = '本场只有原瓦伦在4米范围，10米场上限为有限G；没有旁人不代表友军免疫。';
  if (stance === 'DEFEND' || stance === 'RETREAT') {
    e.fieldActive = false; e.silkPrepared = false; e.boundRound = null;
    label += `选择${stance === 'DEFEND' ? '防御' : '撤退'}先主动撤去瘟疫场，0维持费用、0新增暴露，原症状${e.enemyDisease}保留；不是治愈。`;
  } else if (e.fieldActive && e.lastDiseaseRound !== source.round) {
    if (Number.isFinite(s.spirituality) && s.spirituality >= 2) {
      s.spirituality -= 2; e.enemyDisease = Math.min(6, e.enemyDisease + 1); e.lastDiseaseRound = source.round;
      label += `实付2灵性维持原场，本轮仅一次强度${diseaseBefore}→${e.enemyDisease}；不直接扣原健康。`;
    } else { e.fieldActive = false; label += `不足2灵性，原场停止，原症状${e.enemyDisease}保留。`; }
  }
  return { source, stance, finished: false, playerSpiritualityBefore, enemySpiritualityBefore: e.enemySpirituality, diseaseBefore, enemyActions: [], label };
}
export interface DespairCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
const none = (label: string): DespairCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
const bounded = (n: number, max: number) => Math.max(0, Math.min(max, Number.isFinite(n) ? n : 0));
function mastery(s: SliceState, id: string): number { return 0.65 + 0.35 * bounded(s.progression.mastery[id] ?? 0, 500) / 500; }
export function resolveDespairCombatAbility(s: SliceState, id: DespairMoveId, physicalStateFactor: number, random: ActionRandomStream,
  r: DespairRoundContext, source: DespairCombatSource | null = r.source): DespairCombatEffect {
  if (r.finished || !validSource(s, source) || !validSource(s, r.source)) return none('缺少本回合实际原瓦伦来源，0贡献、0消耗，不重抽。');
  const e = s.despair.encounter, physical = bounded(physicalStateFactor, 1), canPay = (n: number) => Number.isFinite(s.spirituality) && s.spirituality >= n;
  if (id === 'ACCIDENT') return { ...none('本次判断失衡，固定−22.5（G），0灵性，不判伤或生成原物。'), selfGain: -22.5 };
  if (id === 'assassin.s7.black-flame') {
    if (s.town.clubLocation === 'HAND' || !canPay(2)) {
      const gain = (s.town.clubLocation === 'HAND' ? 16 : 12) * physical;
      return { label: `实际原短棍或灵性不足的普通身体打击${s.town.clubLocation === 'HAND' ? 16 : 12}×身体（G），0灵性，不叠黑焰。`, selfGain: gain, enemyReduction: 0, threatens: gain > 0 };
    }
    s.spirituality -= 2;
    return { label: '继承黑焰实付2灵性，59.15×原黑焰掌握系数（G）；只入共同胜负与伤势盘，不直接扣健康。', selfGain: 59.15 * mastery(s, id), enemyReduction: 0, threatens: true };
  }
  if (id === 'assassin.s7.frost') {
    if (!canPay(2)) return { ...none('不足2灵性，普通牵制6×身体，不透支。'), enemyReduction: 6 * physical };
    s.spirituality -= 2;
    return { ...none('继承冰霜实付2灵性，31.85×原冰霜掌握（G），仅共同减势，不自动中断或删除原敌行动。'), enemyReduction: 31.85 * mastery(s, id) };
  }
  if (id === 'assassin.s7.substitute') {
    const t = s.witch.tools;
    if (t.mirrorPrepared && Number.isSafeInteger(t.mirrorsHeld) && t.mirrorsHeld > 0 && canPay(3)) {
      s.spirituality -= 3; t.mirrorsHeld--; t.mirrorsUsed++; t.mirrorPrepared = false;
      return { ...none('消耗3灵性＋1面实际已备原镜；原镜破碎，42.25×原替身掌握（G）共同减势，不撤销既有疾病、伤势或死亡。'), enemyReduction: 42.25 * mastery(s, id) };
    }
    if (Number.isSafeInteger(t.powderHeld) && t.powderHeld > 0 && canPay(2)) {
      s.spirituality -= 2; t.powderHeld--; t.powderUsed++;
      return { ...none('原镜条件不足，消耗2灵性＋1剂实际原粉，21.125×原隐形掌握（G）共同减势，不免疫原敌法术或清除感染。'), enemyReduction: 21.125 * mastery(s, 'assassin.s7.invisibility') };
    }
    return { ...none('无可用原镜／粉，普通避让10×身体（G），0灵性；不生成消耗品。'), enemyReduction: 10 * physical };
  }
  if (id === 'assassin.s4.plague') {
    if (r.stance === 'DEFEND' || r.stance === 'RETREAT' || e.diseaseApplications > 0 || e.fieldActive) return { ...none('本轮停止新增暴露或原感染已建立，本槽只普通自保10（G）、0灵性；不重启、不叠增长、不治疗。'), enemyReduction: 10 };
    if (!canPay(4)) return none('不足4灵性，无法开始瘟疫场，不产生暴露或免费检定。');
    s.spirituality -= 4;
    const chance = computeCheckChance({ ability: 'knowledge', baseAbility: s.character.coreStats.knowledge, difficulty: 18, modifiers: [] });
    const roll = random.nextInt(1, 100), success = roll <= chance;
    if (success) { e.fieldActive = true; e.enemyDisease = 1; e.diseaseApplications = 1; e.lastDiseaseRound = source.round; }
    return none(`实付4灵性，知识18实抽${roll}/100、阈值${chance}（G）；${success ? '仅本场4米原瓦伦实际暴露，强度1。本轮不二次增长；没有天然友军免疫' : '未建立瘟疫场，原敌未感染，不退已付资源'}。无现实病原、不直接扣健康、未凭空中断尚未实际抽到的法术。`);
  }
  if (!canPay(3)) return none('不足3灵性，不能布丝或牵引，不掷抵抗盘。');
  s.spirituality -= 3;
  if (!e.silkPrepared) { e.silkPrepared = true; return none('实付3灵性在本场原院实际布丝，0即时贡献；须后来再次抽中R、另付3灵性才尝试实体丝缚，不借旧日常丝线。'); }
  e.silkPrepared = false;
  const attack = .5 * bounded(s.character.coreStats.perception, 500) + .5 * bounded(s.progression.mastery[id] ?? 0, 500);
  const chance = Math.max(5, Math.min(95, 50 + 8 * (5 - 4) + .08 * (attack - source.targetPhysique)));
  const roll = random.nextInt(1, 100), success = roll <= chance;
  if (success) e.boundRound = source.round;
  return none(`另付3灵性并牵引本场原丝，身体抵抗${roll}/100、阈值${Number(chance.toFixed(2))}（G）；${success ? '成功，仅下一次本轮正向实体打击×0.50，触发即解，与症状取较强效果' : '原瓦伦挣脱，没有新束缚'}。0即时贡献，不控制思想，不删除敌方槽，轮末解除。`);
}
/** Only a drawn, affordable original spell can spend SP and face the first eligible symptom check. */
export function resolveDespairEnemyAbility(s: SliceState, id: DespairEnemyIntent, physicalStateFactor: number, random: ActionRandomStream, r: DespairRoundContext): DespairCombatEffect {
  if (r.finished || !validSource(s, r.source)) throw new Error('没有本回合同一原瓦伦的实际行动来源。');
  const e = s.despair.encounter, p = DESPAIR_POWERS.find(a => a.id === id), payable = !!p && e.enemySpirituality >= p.cost;
  const action: DespairEnemyAction = { planned: id, actual: id === 'ACCIDENT' ? 'ACCIDENT' : payable ? id : 'BODY_STRIKE', paidCost: payable ? p!.cost : 0,
    diseaseAtAction: e.enemyDisease, symptomChance: null, symptomRoll: null, interrupted: false };
  r.enemyActions.push(action);
  if (id === 'ACCIDENT') return none('原瓦伦实际失衡，0贡献、0灵性，不恢复资源。');
  if (payable) {
    e.enemySpirituality -= p!.cost; e.powerUses[p!.id]++;
    if (e.enemyDisease >= 3 && e.lastInterruptionCheckRound !== r.source.round) {
      e.lastInterruptionCheckRound = r.source.round;
      // Finite G resistance: 40/50/60/70%, never a guarantee and never all slots.
      action.symptomChance = Math.min(70, 40 + (e.enemyDisease - 3) * 10); action.symptomRoll = random.nextInt(1, 100);
      action.interrupted = action.symptomRoll <= action.symptomChance;
      if (action.interrupted) {
        action.actual = 'INTERRUPTED'; e.interruptionCount++;
        return none(`原瓦伦实际开始${p!.label}并已付${p!.cost}灵性，原症状${e.enemyDisease}触发本轮首次可中断法术检定${action.symptomRoll}/100≤${action.symptomChance}：这一次施法中断、0贡献，费用不退，余${e.enemySpirituality}。没有删除其他敌方行动。`);
      }
    }
  }
  const physical = bounded(physicalStateFactor, 1), body = action.actual === 'BODY_STRIKE' || action.actual === 'SPRINT_STRIKE';
  const bound = body && e.boundRound === r.source.round, diseaseMultiplier = 1 - Math.min(.3, e.enemyDisease * .05);
  const multiplier = body ? bound ? Math.min(.5, diseaseMultiplier) : diseaseMultiplier : 1;
  if (bound) e.boundRound = null;
  const selfGain = (payable ? p!.selfGain : 18) * (body ? physical * multiplier : 1);
  return { label: `${payable ? `原瓦伦实际${p!.label}，实付${p!.cost}灵性，有限40余${e.enemySpirituality}` : '原棍普通打击18×身体（G）；原法术无足够灵性则明确回退，0费用'}${action.symptomRoll !== null ? `；症状检定${action.symptomRoll}/100>${action.symptomChance}失败，该法术实际完成` : ''}${body ? `；本次实体贡献×${multiplier}，症状身体削弱最多30%${bound ? '，本场丝缚触发即解，只取较强效果' : ''}` : '；此非实体术式不假借身体疲乏再削弱'}。不补灵性、不直接扣健康。`,
    selfGain, enemyReduction: payable ? p!.enemyReduction : 0, threatens: selfGain > 0 };
}
export interface DespairRoundOutcome {
  targetId: typeof DESPAIR_TARGET_ID; round: number; source: DespairCombatSource;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; enemySpiritualityBefore: number;
  powerUses: Record<DespairPowerId, number>; interruptionCount: number; lastInterruptionCheckRound: number | null;
  fieldActive: boolean; enemyDisease: number; diseaseBefore: number; diseaseApplications: number; lastDiseaseRound: number | null;
  silkPrepared: boolean; enemyActions: DespairEnemyAction[]; stoppedExposure: boolean;
}
export function finishDespairCombatRound(s: SliceState, r: DespairRoundContext, continuing: boolean): DespairRoundOutcome {
  if (r.finished || s.combat?.encounterId !== 'DESPAIR_DISPUTE' || s.combat.round !== r.source.round) throw new Error('同一原回合已结束或不存在。');
  const e = s.despair.encounter, c = s.combat;
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus;
  e.enemyInjuries = c.enemyInjuries.map(i => ({ ...i })); e.enemyRisk = c.enemyRisk; e.boundRound = null;
  if (!continuing) { e.fieldActive = false; e.silkPrepared = false; }
  r.finished = true;
  return { targetId: DESPAIR_TARGET_ID, round: c.round, source: { ...r.source }, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus, playerSpiritualityBefore: r.playerSpiritualityBefore,
    playerSpiritualityAfter: s.spirituality, enemySpiritualityBefore: r.enemySpiritualityBefore,
    powerUses: { ...e.powerUses }, interruptionCount: e.interruptionCount, lastInterruptionCheckRound: e.lastInterruptionCheckRound,
    fieldActive: e.fieldActive, enemyDisease: e.enemyDisease, diseaseBefore: r.diseaseBefore, diseaseApplications: e.diseaseApplications,
    lastDiseaseRound: e.lastDiseaseRound, silkPrepared: e.silkPrepared, enemyActions: r.enemyActions.map(a => ({ ...a })),
    stoppedExposure: !e.fieldActive };
}
export function projectDespairCombat(s: SliceState) {
  const e = s.despair.encounter;
  return { enemyName: '瓦伦·霍尔特（DP4-VALEN-HOLT，原创成年序列5对手，G）', targetId: e.targetId,
    enemySpirituality: e.enemySpirituality, fieldActive: e.fieldActive, enemyDisease: e.enemyDisease, interruptionCount: e.interruptionCount,
    powerUses: { ...e.powerUses }, originalExit: true, pursuit: false, distanceMetres: 4, fieldRadiusMetres: 10,
    summary: `新增暴露${e.fieldActive ? '维持中，每后轮2灵性' : '已停止'}；持续症状${e.enemyDisease}/6，停场不治愈。防御或撤退会先停止场；原敌剩余灵性${e.enemySpirituality}/40，已中断${e.interruptionCount}次实际法术。`,
    enemyCountWheel: DESPAIR_ENEMY_COUNT_WHEEL, enemyAbilityWheel: DESPAIR_ENEMY_ABILITY_WHEEL };
}
export function validateDespairRoundOutcome(v: unknown): v is DespairRoundOutcome {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const p = v as DespairRoundOutcome, integer = (n: unknown, min: number, max = Number.MAX_SAFE_INTEGER): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= min && n <= max;
  const resource = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 120;
  if (Object.keys(p).length !== 21 || p.targetId !== DESPAIR_TARGET_ID || !integer(p.round, 1) ||
      !integer(p.enemyHealth, 0, 100) || !integer(p.enemyMind, 0, 100) || !integer(p.enemySpirituality, 0, 40) || !integer(p.enemySpiritualityBefore, p.enemySpirituality, 40) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(p.enemyStatus) || (p.enemyStatus === 'DEAD') !== (p.enemyHealth === 0) ||
      !resource(p.playerSpiritualityBefore) || !resource(p.playerSpiritualityAfter) || p.playerSpiritualityAfter > p.playerSpiritualityBefore ||
      !p.powerUses || Object.keys(p.powerUses).length !== 3 || DESPAIR_POWER_IDS.some(id => !integer(p.powerUses[id], 0, 13)) ||
      p.enemySpirituality !== 40 - DESPAIR_POWERS.reduce((n, a) => n + p.powerUses[a.id] * a.cost, 0) ||
      !integer(p.enemyDisease, 0, 6) || !integer(p.diseaseBefore, 0, p.enemyDisease) || p.enemyDisease - p.diseaseBefore > 1 ||
      !integer(p.diseaseApplications, 0, 1) || typeof p.fieldActive !== 'boolean' || typeof p.silkPrepared !== 'boolean' ||
      typeof p.stoppedExposure !== 'boolean' || p.stoppedExposure === p.fieldActive || !integer(p.interruptionCount, 0, 13) ||
      (p.lastInterruptionCheckRound !== null && !integer(p.lastInterruptionCheckRound, 1, p.round)) ||
      (p.diseaseApplications === 0 ? p.enemyDisease !== 0 || p.lastDiseaseRound !== null || p.fieldActive || p.interruptionCount !== 0 : !integer(p.lastDiseaseRound, 1, p.round)) ||
      !Array.isArray(p.enemyActions) || p.enemyActions.length > 4) return false;
  let checks = 0, interruptions = 0, spent = 0;
  for (const a of p.enemyActions) {
    if (!a || Object.keys(a).length !== 7 || ![...DESPAIR_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(a.planned) ||
        ![...DESPAIR_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT', 'INTERRUPTED'].includes(a.actual) || !integer(a.diseaseAtAction, p.diseaseBefore, p.enemyDisease) || typeof a.interrupted !== 'boolean') return false;
    const power = DESPAIR_POWERS.find(x => x.id === a.planned), payable = !!power && p.enemySpiritualityBefore - spent >= power.cost;
    if (a.paidCost !== (payable ? power!.cost : 0)) return false;
    spent += a.paidCost;
    if (a.symptomRoll !== null) {
      checks++;
      if (!payable || a.diseaseAtAction < 3 || !integer(a.symptomRoll, 1, 100) || a.symptomChance !== Math.min(70, 40 + (a.diseaseAtAction - 3) * 10) ||
          a.interrupted !== (a.symptomRoll <= a.symptomChance) || p.lastInterruptionCheckRound !== p.round) return false;
    } else if (a.symptomChance !== null || a.interrupted) return false;
    if (a.interrupted) interruptions++;
    if (a.actual !== (a.interrupted ? 'INTERRUPTED' : a.planned === 'ACCIDENT' ? 'ACCIDENT' : payable ? a.planned : 'BODY_STRIKE')) return false;
  }
  if (checks > 1 || interruptions > p.interruptionCount || p.enemySpiritualityBefore - spent !== p.enemySpirituality) return false;
  const a = p.source;
  return !!a && typeof a === 'object' && Object.keys(a).length === 25 && a.targetId === DESPAIR_TARGET_ID && a.encounterId === 'DESPAIR_DISPUTE' && a.round === p.round &&
    typeof a.runId === 'string' && a.runId.length > 0 && integer(a.revision, 0) && integer(a.week, 1) && a.attemptWeek === a.week && integer(a.startHistoryIndex, 0) &&
    integer(a.playerHealth, 1, 100) && integer(a.playerMind, 1, 100) && integer(a.enemyHealth, 1, 100) && integer(a.enemyMind, 1, 100) &&
    typeof a.clubLocation === 'string' && a.actualOriginalBody === true && a.mutuallyVisible === true && a.distanceMetres === 4 && a.fieldRadiusMetres === 10 &&
    a.noBystanders === true && a.friendImmunity === false && a.ordinaryExit === true && a.pursuit === false && a.targetSequence === 5 && a.targetPhysique === 20 &&
    a.enemyWeapon === 'DP4-VALEN-CLUB' && a.space === 'ORIGINAL_ABANDONED_ISOLATED_YARD';
}
