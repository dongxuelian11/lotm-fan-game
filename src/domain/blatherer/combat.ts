import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { advanceBlathererLifeClock } from './life.js';
import { BLATHERER_TARGET_ID, BLATHERER_POWERS, BLATHERER_POWER_IDS, hasBlathererCourtOpponent,
  type BlathererEnemyIntent, type BlathererPowerId, type BlathererEncounterScene } from './encounter.js';

/** New whisper, original opponent and every numerical strengthening are explicitly bounded G. */
export const BLATHERER_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const BLATHERER_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const blathererActionCount = pyromaniacActionCount;
export const blathererEnemyActionCount = pyromaniacActionCount;
const FLAME = 'abyss.s6.flame-hex', BODY = 'BODY_FOLLOWUP', HARDEN = 'abyss.s6.demonic-body', WHISPER = 'abyss.s3.limited-murmur';
const MASTERY_IDS = [FLAME, HARDEN, WHISPER] as const;
export type BlathererMoveId = typeof FLAME | typeof BODY | typeof HARDEN | typeof WHISPER | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly { id: BlathererMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: FLAME, label: '继承火焰3S＋1原恶魔负荷，60×旧掌握G；本人持原棍则普通16×身体', weight: 30, stance: 'ATTACK' },
  { id: BODY, label: '继承身体次击29.575×旧恶魔身体掌握×身体，0S（G）', weight: 15, stance: 'ATTACK' },
  { id: HARDEN, label: '继承硬皮2S＋1原负荷，50.7×旧掌握×身体；有限原负荷上限3（G）', weight: 20, stance: 'DEFEND' },
  { id: WHISPER, label: '有限低语4S＋1M/知识18，下一实际正身体或弧光战势减半一次（G）', weight: 20, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '观察当前公开原人、有限低语与原负荷，0S/0贡献', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作偏差固定−22.5（G）', weight: 5, stance: null },
];
export const BLATHERER_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'ARC_BOLT', label: '原有限弧光5S/70G', weight: 35 },
  { id: 'WARD', label: '原有限屏护4S/减势30G', weight: 25 },
  { id: 'BODY_STRIKE', label: '自己的唯一原棍20×身体（G）', weight: 25 },
  { id: 'STEADY_BREATH', label: '实际集中呼吸0S/8贡献，清除尚未消费的低语和余留（G）', weight: 10 },
  { id: 'ACCIDENT', label: '实际失衡0贡献/0S', weight: 5 },
];
export const isBlatherer = (s: SliceState): boolean => s.progression.pathwayId === 'abyss' && s.progression.sequence === 3;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function blathererAbilityWheel(s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, weight: total === 400 ? weights[i]! / 4 : weights[i]! / total * 100,
    label: a.id === FLAME && s.town.clubLocation === 'HAND' ? '本人实际持握原短棍：普通16×身体替换火焰，0S、不增原负荷（G）' : a.label }));
}
export function drawBlathererAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): BlathererMoveId {
  const weights = tickets(stance); let roll = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { roll -= weights[i]!; if (roll <= 0) return a.id; }
  throw new Error('呓语者动作盘权重无效。');
}
export function drawBlathererEnemyAbility(random: ActionRandomStream): BlathererEnemyIntent {
  let roll = random.nextInt(1, 100);
  for (const a of BLATHERER_ENEMY_ABILITY_WHEEL) { roll -= a.weight; if (roll <= 0) return a.id as BlathererEnemyIntent; }
  throw new Error('原埃德里克动作盘权重无效。');
}
export interface BlathererCombatSource {
  runId: string; revision: number; week: number; round: number; encounterId: 'BLATHERER_COURT'; targetId: typeof BLATHERER_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetAge: 48; targetSequence: 4; targetPhysique: 22; actualOriginalBody: true; independentMind: true;
  enemyWeapon: 'BL3-EDRIC-ROD'; weaponLocation: 'HAND'; distanceMetres: 4; space: 'BL3-COURT'; targetAwake: true; targetListening: true;
  abilitySource: 'ORIGINAL_LIMITED_G'; ordinaryExit: true; pursuit: false; thirdPartiesInArea: 0; automaticAllyImmunity: false;
  playerHealth: number; playerMind: number; playerSpirituality: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyInjuries: SliceInjury[]; enemyRisk: number; clubHeld: boolean; knowledge: number; lifeClockSeconds: number; strain: number;
  mastery: Record<string, number>; scene: BlathererEncounterScene; powerUses: Record<BlathererPowerId, number>; breathUses: number;
}
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const bounded = (v: number, max: number) => Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : 0;
const masteryFactor = (v: number) => .65 + .35 * bounded(v, 500) / 500;
export function currentBlathererCombatSource(s: SliceState): BlathererCombatSource | null {
  if (!hasBlathererCourtOpponent(s) || !integer(s.demon.strain, 0, 3)) return null;
  const e = s.blatherer.encounter, c = s.combat!;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'BLATHERER_COURT', targetId: BLATHERER_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetAge: 48, targetSequence: 4, targetPhysique: 22, actualOriginalBody: true, independentMind: true,
    enemyWeapon: 'BL3-EDRIC-ROD', weaponLocation: 'HAND', distanceMetres: 4, space: 'BL3-COURT', targetAwake: true, targetListening: true,
    abilitySource: 'ORIGINAL_LIMITED_G', ordinaryExit: true, pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind,
    enemySpirituality: e.enemySpirituality, enemyInjuries: structuredClone(c.enemyInjuries), enemyRisk: c.enemyRisk,
    clubHeld: s.town.clubLocation === 'HAND', knowledge: s.character.coreStats.knowledge, lifeClockSeconds: s.blatherer.life.clockSeconds, strain: s.demon.strain,
    mastery: Object.fromEntries(MASTERY_IDS.map(id => [id, s.progression.mastery[id] ?? 0])), scene: structuredClone(e.scene), powerUses: { ...e.powerUses }, breathUses: e.breathUses };
}
export interface BlathererCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: false }
interface ActionEvidence extends BlathererCombatEffect { order: number; paidCost: number; physicalFactor: number; rolls: number[]; mode: string }
export interface BlathererPlayerAction extends ActionEvidence {
  id: BlathererMoveId; mindCost: number; strainCost: number; prepared: 'WHISPER' | null;
  checkTier: 'GREAT_SUCCESS' | 'SUCCESS' | 'FAILURE' | 'GREAT_FAILURE' | null;
}
export interface BlathererEnemyAction extends ActionEvidence { planned: BlathererEnemyIntent; actual: BlathererEnemyIntent; whisperConsumed: boolean; whisperCleared: boolean }
export interface BlathererRoundContext {
  source: BlathererCombatSource; stance: SliceStance; finished: boolean; liveState: string;
  playerActions: BlathererPlayerAction[]; enemyActions: BlathererEnemyAction[]; label: string; outcome: BlathererRoundOutcome | null;
}
const none = (label: string): BlathererCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false });
function liveState(s: SliceState): string {
  return stableStringify({ spirituality: s.spirituality, mind: s.mind, strain: s.demon.strain, encounter: s.blatherer.encounter, clockSeconds: s.blatherer.life.clockSeconds });
}
const dynamicSource = new Set(['playerSpirituality', 'playerMind', 'enemySpirituality', 'powerUses', 'strain', 'breathUses']);
function validRound(s: SliceState, r: BlathererRoundContext, supplied: BlathererCombatSource | null): boolean {
  const actual = currentBlathererCombatSource(s);
  return !r.finished && actual !== null && supplied !== null && same(supplied, r.source) && r.liveState === liveState(s) &&
    Object.entries(r.source).every(([key, value]) => dynamicSource.has(key) || same(actual[key as keyof BlathererCombatSource], value));
}
export function beginBlathererCombatRound(s: SliceState, stance: SliceStance, _random: ActionRandomStream): BlathererRoundContext {
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('呓语者战斗姿态无效。');
  const source = currentBlathererCombatSource(s), e = s.blatherer.encounter;
  if (!source || e.whisperReady || e.residualSeconds !== 0) throw new Error('缺少同一原埃德里克、原棍、当前听者或连续回合，或上一轮低语尚未结束。');
  return { source, stance, finished: false, liveState: liveState(s), playerActions: [], enemyActions: [], outcome: null,
    label: `48岁原埃德里克在净空原院4米外清醒可听，持自己的唯一原棍，独立S${source.enemySpirituality}/120。有限低语只有本轮一次轻微迟疑，实际集中呼吸可以解除；不移植旧种子、不强制服从。` };
}
export const createBlathererCombatRound = beginBlathererCombatRound;
interface Resources { playerS: number; playerM: number; enemyS: number; strain: number; powers: Record<BlathererPowerId, number>; breathUses: number; whisper: boolean; residual: 0 | 30 }
function resources(s: SliceState): Resources {
  const e = s.blatherer.encounter;
  return { playerS: s.spirituality, playerM: s.mind, enemyS: e.enemySpirituality, strain: s.demon.strain, powers: { ...e.powerUses }, breathUses: e.breathUses, whisper: e.whisperReady, residual: e.residualSeconds };
}
function commit(s: SliceState, r: BlathererRoundContext, q: Resources): void {
  const e = s.blatherer.encounter; s.spirituality = q.playerS; s.mind = q.playerM; s.demon.strain = q.strain;
  e.enemySpirituality = q.enemyS; e.powerUses = q.powers; e.breathUses = q.breathUses; e.whisperReady = q.whisper; e.residualSeconds = q.residual; r.liveState = liveState(s);
}
function rollsRequired(_x: BlathererCombatSource, q: Resources, id: BlathererMoveId): number { return Number(id === WHISPER && q.playerS >= 4 && q.playerM > 1); }
/** One transition handles real runtime actions and replays their saved ordered evidence. */
function playerAction(x: BlathererCombatSource, q: Resources, id: BlathererMoveId, physical: number, rolls: number[], order: number): BlathererPlayerAction {
  const a: BlathererPlayerAction = { ...none(''), order, id, paidCost: 0, mindCost: 0, strainCost: 0, physicalFactor: physical, rolls: [...rolls], mode: 'NONE', prepared: null, checkTier: null };
  if (id === 'ACCIDENT') { a.selfGain = -22.5; a.label = '本次动作偏差固定−22.5G，0S、不增原负荷，不重抽。'; }
  else if (id === BODY) { a.selfGain = 29.575 * masteryFactor(x.mastery[HARDEN] ?? 0) * physical; a.threatens = a.selfGain > 0; a.mode = 'INHERITED_BODY'; a.label = '继承本人身体次击29.575×旧恶魔身体掌握×实际身体G，独占一槽、0S，不增负荷。'; }
  else if (id === FLAME || id === HARDEN) {
    const flame = id === FLAME, cost = flame ? 3 : 2;
    let value: number;
    if (flame && x.clubHeld) { a.mode = 'ORIGINAL_CLUB'; value = 16 * physical; a.label = '本人持握原短棍，普通16×身体替换本槽火焰，0S、不增负荷；不取敌人的原棍。'; }
    else if (q.strain < 3 && q.playerS >= cost) {
      a.paidCost = cost; a.strainCost = 1; a.mode = 'INHERITED_POWER'; value = (flame ? 60 : 50.7 * physical) * masteryFactor(x.mastery[id] ?? 0);
      a.label = `继承${flame ? '有限火焰' : '本槽有限硬皮'}实付${cost}S＋1原恶魔负荷，原负荷${q.strain + 1}/3；${flame ? '60×旧火焰掌握' : '50.7×旧恶魔身体掌握×实际身体'}G。不治疗、不抹原伤或清风险。`;
    } else { a.mode = 'ORDINARY_FALLBACK'; value = (flame ? 12 : 10) * physical; a.label = `不足${cost}S或原负荷已达3，${flame ? '普通身体12' : '普通格挡10'}×身体G，0消耗，不透支或清除原负荷。`; }
    a.selfGain = flame ? value : 0; a.enemyReduction = flame ? 0 : value; a.threatens = flame && value > 0;
  } else if (id === WHISPER) {
    if (q.playerS < 4 || q.playerM <= 1) { a.mode = 'LOW_RESOURCE'; a.label = '实际灵性不足4或精神不足以承担1M，普通观察0贡献/0消耗，不免费低语或透支。'; }
    else {
      a.paidCost = 4; a.mindCost = 1;
      const check = resolveNormalCheck({ ability: 'knowledge', baseAbility: x.knowledge, difficulty: 18, modifiers: [], roll: rolls[0]! });
      const success = check.tier === 'GREAT_SUCCESS' || check.tier === 'SUCCESS'; a.checkTier = check.tier; a.mode = success ? 'PREPARED' : 'FAILED';
      if (success) { a.prepared = 'WHISPER'; q.whisper = true; q.residual = 30; }
      a.label = `原创G有限低语实付4S＋1M，向4米内同一清醒听者作短促输入，知识18实抽${check.roll}/${check.chance}、${check.tier}；${success ? '只形成轻微迟疑：本轮下一正贡献BODY_STRIKE或实际付费ARC_BOLT×0.5一次；重复成功只续同一窗口，不叠乘' : '原人抵抗成功，无新增效果，费用不退'}。不直接伤害、不夺棍、不强迫道歉服从；旧奥里克种子与结局不转移。`;
    }
  } else { a.mode = 'OBSERVE'; a.label = `普通观察当前公开原人：埃德里克清醒、4米内可听；当轮低语${q.whisper ? '待一次真实攻击' : '无待触发效果'}、轻微余留${q.residual}秒；本人原恶魔负荷${q.strain}/3。0S/0贡献，不读隐藏思想或制造资源。`; }
  q.playerS -= a.paidCost; q.playerM -= a.mindCost; q.strain += a.strainCost; return a;
}
function enemyAction(_x: BlathererCombatSource, q: Resources, planned: BlathererEnemyIntent, physical: number, order: number): BlathererEnemyAction {
  const power = BLATHERER_POWERS.find(p => p.id === planned), usable = !!power && q.enemyS >= power.cost;
  const actual: BlathererEnemyIntent = power && !usable ? 'BODY_STRIKE' : planned;
  const a: BlathererEnemyAction = { ...none(''), order, planned, actual, paidCost: usable ? power!.cost : 0, physicalFactor: physical, rolls: [],
    mode: actual !== planned ? 'ORDINARY_FALLBACK' : 'ORIGINAL', whisperConsumed: false, whisperCleared: false };
  if (usable) { q.enemyS -= a.paidCost; q.powers[power!.id]++; }
  if (actual === 'STEADY_BREATH') {
    a.selfGain = 8; a.whisperCleared = q.whisper || q.residual > 0; q.whisper = false; q.residual = 0; q.breathUses++;
    a.label = '原埃德里克实际集中呼吸，0S、普通8战势、无致伤威胁；清除尚未触发低语和轻微余留G，不退款、不治疗，也不撤销已经减半的先前动作。';
  } else if (actual === 'ACCIDENT') a.label = '原埃德里克实际失衡0贡献/0S，不补充资源或重抽。';
  else if (actual === 'WARD') { a.enemyReduction = 30; a.label = '同一原埃德里克实际付4S完成有限屏护，减势30G；无致伤威胁，不消耗有限低语。'; }
  else {
    const raw = actual === 'ARC_BOLT' ? 70 : 20 * physical; a.whisperConsumed = raw > 0 && q.whisper;
    a.selfGain = raw * (a.whisperConsumed ? .5 : 1); a.threatens = a.selfGain > 0; if (a.whisperConsumed) q.whisper = false;
    a.label = `${actual === 'ARC_BOLT' ? '同一原埃德里克实付5S完成原弧光70G' : `${a.mode === 'ORDINARY_FALLBACK' ? '法术灵性不足，0S普通回退；' : ''}以自己的唯一BL3-EDRIC-ROD实际打击20×身体G`}${a.whisperConsumed ? '；已付低语仅使本次实际正贡献×0.5一次，余留仍待真实平复' : ''}。费用不退，致伤仍由共同胜负和伤势盘决定。`;
  }
  return a;
}
export function resolveBlathererCombatAbility(s: SliceState, id: BlathererMoveId, physical: number, random: ActionRandomStream,
  r: BlathererRoundContext, source: BlathererCombatSource | null = r.source): BlathererCombatEffect {
  if (!validRound(s, r, source) || r.playerActions.length >= 6 || !ABILITIES.some(a => a.id === id)) return none('当前原人、听者或实际资源来源无效，0贡献/0消耗，不重抽。');
  const q = resources(s), rolls = Array.from({ length: rollsRequired(r.source, q, id) }, () => random.nextInt(1, 100));
  const a = playerAction(r.source, q, id, bounded(physical, 1), rolls, r.playerActions.length + r.enemyActions.length);
  r.playerActions.push(a); commit(s, r, q); return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: false };
}
export function resolveBlathererEnemyAbility(s: SliceState, planned: BlathererEnemyIntent, physical: number, _random: ActionRandomStream,
  r: BlathererRoundContext, source: BlathererCombatSource | null = r.source): BlathererCombatEffect {
  if (!validRound(s, r, source) || r.enemyActions.length >= 6 || ![...BLATHERER_POWER_IDS, 'BODY_STRIKE', 'STEADY_BREATH', 'ACCIDENT'].includes(planned)) return none('当前原埃德里克或实际资源来源无效，0贡献/0消耗，不重抽。');
  const q = resources(s), a = enemyAction(r.source, q, planned, bounded(physical, 1), r.playerActions.length + r.enemyActions.length);
  r.enemyActions.push(a); commit(s, r, q); return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: false };
}
export interface BlathererRoundOutcome {
  targetId: typeof BLATHERER_TARGET_ID; round: number; source: BlathererCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  enemyInjuriesAfter: SliceInjury[]; enemyRiskAfter: number; playerSpiritualityBefore: number; playerSpiritualityAfter: number;
  playerHealthAfter: number; playerMindAfter: number; playerStrainAfter: number; enemySpiritualityBefore: number; powerUses: Record<BlathererPowerId, number>; breathUses: number;
  sceneAfter: BlathererEncounterScene; whisperReadyAfter: false; residualSecondsAfter: 0;
  roundSeconds: 60; cleanupWaitSeconds: 0 | 30; exitSeconds: 0 | 4; elapsedSeconds: number; lifeClockSecondsAfter: number;
  playerActions: BlathererPlayerAction[]; enemyActions: BlathererEnemyAction[];
}
export function finishBlathererCombatRound(s: SliceState, r: BlathererRoundContext, continuing = true): BlathererRoundOutcome {
  const e = s.blatherer.encounter, c = s.combat;
  if (r.finished || !c || c.encounterId !== 'BLATHERER_COURT' || c.round !== r.source.round || r.liveState !== liveState(s)) throw new Error('原回合已结束或实际资源被改写。');
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus; e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk;
  if (e.enemyStatus !== 'RESISTING') e.weaponLocation = 'COURT';
  e.scene.targetAwake = c.enemyStatus !== 'DEAD';
  if (!continuing) e.scene.targetListening = false;
  const cleanupWaitSeconds = !continuing && e.residualSeconds > 0 ? 30 : 0, exitSeconds = !continuing && s.health > 0 ? 4 : 0;
  if (exitSeconds) { e.scene.ordinaryWalkedMetres += 4; e.scene.playerPosition = 'EXIT'; }
  e.whisperReady = false; e.residualSeconds = 0;
  const elapsedSeconds = 60 + cleanupWaitSeconds + exitSeconds; advanceBlathererLifeClock(s, elapsedSeconds); r.finished = true;
  r.outcome = { targetId: BLATHERER_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus,
    enemyInjuriesAfter: structuredClone(c.enemyInjuries), enemyRiskAfter: c.enemyRisk, playerSpiritualityBefore: r.source.playerSpirituality,
    playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind, playerStrainAfter: s.demon.strain,
    enemySpiritualityBefore: r.source.enemySpirituality, powerUses: { ...e.powerUses }, breathUses: e.breathUses,
    sceneAfter: structuredClone(e.scene), whisperReadyAfter: false, residualSecondsAfter: 0,
    roundSeconds: 60, cleanupWaitSeconds, exitSeconds, elapsedSeconds, lifeClockSecondsAfter: s.blatherer.life.clockSeconds,
    playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
  return structuredClone(r.outcome);
}
export function blathererRoundOutcome(r: BlathererRoundContext): BlathererRoundOutcome { if (!r.outcome) throw new Error('先实际结束原回合。'); return structuredClone(r.outcome); }
export function projectBlathererCombat(s: SliceState) {
  const e = s.blatherer.encounter, visible = isBlatherer(s);
  return { enemyName: visible ? '埃德里克·凯尔（48岁，独立原创有限G序列4对手）' : '', targetId: visible ? e.targetId : null,
    enemyMind: visible ? e.enemyMind : null, enemySpirituality: visible ? e.enemySpirituality : null, powerUses: visible ? { ...e.powerUses } : null,
    breathUses: visible ? e.breathUses : null, whisperReady: visible ? e.whisperReady : null, residualSeconds: visible ? e.residualSeconds : null, strain: visible ? s.demon.strain : null,
    scene: visible ? structuredClone(e.scene) : null, source: visible ? currentBlathererCombatSource(s) : null,
    summary: visible ? '双方1–6次，继承魔鬼4实际深渊核心35/30/15/20；1250/底125、S120，只有CONTINUE恢复12S。六槽H30/J15/B20/K20/R10/A5。原火焰3S＋1旧负荷、旧硬皮2S＋1旧负荷，上限3不重置。新有限低语4S＋1M/知识18，仅下一实际正身体或弧光战势×0.5一次，不叠乘；实际集中呼吸0S/8可清除尚未发生的效果，不退费或撤销已发生减半。无直接伤害、永久疯狂或强制服从。旧奥里克投降与旧种子历史不转移。每轮60秒，终局余留另实际等30秒、活人普通走4米4秒离开，不治疗或复活。全部新场景、能力规则与数值均G。' : '' };
}
export function validBlathererCombatScene(v: BlathererEncounterScene): boolean {
  return !!v && v.courtId === 'BL3-COURT' && v.ordinaryExit === 'OPEN' && v.thirdPartiesInArea === 0 && typeof v.clearanceConfirmed === 'boolean' &&
    typeof v.targetAwake === 'boolean' && typeof v.targetListening === 'boolean' && ['COURT', 'EXIT'].includes(v.playerPosition) && v.distanceMetres === 4 && v.exitMetres === 4 && integer(v.ordinaryWalkedMetres, 0, 4);
}
export function validateBlathererRoundOutcome(value: unknown): value is BlathererRoundOutcome {
  try {
    const o = value as BlathererRoundOutcome, x = o?.source;
    if (!o || !x || typeof x.runId !== 'string' || x.runId.length === 0 || !integer(x.revision) || !integer(x.week, 1) || !integer(x.round, 1) || !integer(x.startHistoryIndex) || x.attemptWeek !== x.week ||
      x.encounterId !== 'BLATHERER_COURT' || x.targetId !== BLATHERER_TARGET_ID || x.targetAge !== 48 || x.targetSequence !== 4 || x.targetPhysique !== 22 ||
      x.actualOriginalBody !== true || x.independentMind !== true || x.enemyWeapon !== 'BL3-EDRIC-ROD' || x.weaponLocation !== 'HAND' || x.distanceMetres !== 4 || x.space !== 'BL3-COURT' || x.targetAwake !== true || x.targetListening !== true ||
      x.ordinaryExit !== true || x.pursuit !== false || x.thirdPartiesInArea !== 0 || x.automaticAllyImmunity !== false || x.abilitySource !== 'ORIGINAL_LIMITED_G' ||
      ![x.playerHealth, x.playerMind, x.enemyHealth, x.enemyMind].every(n => integer(n, 1, 100)) || !integer(x.knowledge, 0, 500) || typeof x.clubHeld !== 'boolean' ||
      !integer(x.lifeClockSeconds) || !Array.isArray(x.enemyInjuries) || !integer(x.enemyRisk) || !Array.isArray(o.enemyInjuriesAfter) || !integer(o.enemyRiskAfter) ||
      o.targetId !== BLATHERER_TARGET_ID || o.round !== x.round || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(o.stance) || typeof o.continuing !== 'boolean' ||
      o.roundSeconds !== 60 || o.whisperReadyAfter !== false || o.residualSecondsAfter !== 0 || !integer(o.enemyHealth, 0, x.enemyHealth) || !integer(o.playerHealthAfter, 0, x.playerHealth) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(o.enemyStatus) || (o.enemyStatus === 'DEAD') !== (o.enemyHealth === 0) || o.enemyMind !== x.enemyMind || !integer(o.playerMindAfter, 1, x.playerMind) ||
      (o.continuing && (o.enemyStatus !== 'RESISTING' || o.playerHealthAfter <= 0)) ||
      ![x.playerSpirituality, x.enemySpirituality, o.playerSpiritualityAfter, o.enemySpirituality].every(n => integer(n, 0, 120)) || o.playerSpiritualityBefore !== x.playerSpirituality || o.enemySpiritualityBefore !== x.enemySpirituality ||
      !integer(x.strain, 0, 3) || !integer(o.playerStrainAfter, x.strain, 3) || !integer(x.breathUses) ||
      !Array.isArray(o.playerActions) || !Array.isArray(o.enemyActions) || o.playerActions.length > 6 || o.enemyActions.length > 6 || !x.powerUses || !same(Object.keys(x.powerUses).sort(), [...BLATHERER_POWER_IDS].sort()) ||
      !BLATHERER_POWER_IDS.every(id => integer(x.powerUses[id])) || x.enemySpirituality !== 120 - BLATHERER_POWERS.reduce((n, p) => n + x.powerUses[p.id] * p.cost, 0) ||
      !validBlathererCombatScene(x.scene) || !x.scene.targetAwake || !x.scene.targetListening || !x.scene.clearanceConfirmed || x.scene.playerPosition !== 'COURT' || x.scene.ordinaryWalkedMetres !== 0 ||
      !x.mastery || !same(Object.keys(x.mastery).sort(), [...MASTERY_IDS].sort()) || Object.values(x.mastery).some(n => !integer(n, 0, 500))) return false;
    const q: Resources = { playerS: x.playerSpirituality, playerM: x.playerMind, enemyS: x.enemySpirituality, strain: x.strain, powers: { ...x.powerUses }, breathUses: x.breathUses, whisper: false, residual: 0 };
    const actions = [...o.playerActions.map(a => ({ actor: 'PLAYER' as const, a })), ...o.enemyActions.map(a => ({ actor: 'ENEMY' as const, a }))].sort((a, b) => a.a.order - b.a.order);
    for (const [i, entry] of actions.entries()) {
      const a = entry.a;
      if (a.order !== i || !Number.isFinite(a.physicalFactor) || a.physicalFactor < 0 || a.physicalFactor > 1 || !Array.isArray(a.rolls) || a.rolls.some(n => !integer(n, 1, 100))) return false;
      if (entry.actor === 'PLAYER') { const b = entry.a; if (!ABILITIES.some(v => v.id === b.id) || b.rolls.length !== rollsRequired(x, q, b.id) || !same(b, playerAction(x, q, b.id, b.physicalFactor, b.rolls, i))) return false; }
      else { const b = entry.a; if (![...BLATHERER_POWER_IDS, 'BODY_STRIKE', 'STEADY_BREATH', 'ACCIDENT'].includes(b.planned) || !same(b, enemyAction(x, q, b.planned, b.physicalFactor, i))) return false; }
    }
    if ((!o.playerActions.some(a => a.threatens) && (o.enemyHealth !== x.enemyHealth || o.enemyStatus !== 'RESISTING' || !same(o.enemyInjuriesAfter, x.enemyInjuries))) ||
      (!o.enemyActions.some(a => a.threatens) && o.playerHealthAfter !== x.playerHealth)) return false;
    const scene = structuredClone(x.scene), wait = !o.continuing && q.residual > 0 ? 30 : 0, exit = !o.continuing && o.playerHealthAfter > 0 ? 4 : 0;
    scene.targetAwake = o.enemyStatus !== 'DEAD'; if (!o.continuing) scene.targetListening = false;
    if (exit) { scene.ordinaryWalkedMetres += 4; scene.playerPosition = 'EXIT'; }
    return q.playerS === o.playerSpiritualityAfter && q.playerM === o.playerMindAfter && q.strain === o.playerStrainAfter && q.enemyS === o.enemySpirituality &&
      same(q.powers, o.powerUses) && q.breathUses === o.breathUses && same(scene, o.sceneAfter) && o.cleanupWaitSeconds === wait && o.exitSeconds === exit &&
      o.elapsedSeconds === 60 + wait + exit && o.lifeClockSecondsAfter === x.lifeClockSeconds + o.elapsedSeconds;
  } catch { return false; }
}
