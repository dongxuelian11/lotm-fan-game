import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import type { SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import type { WitchTools } from '../witch/types.js';
import { advanceUnagingDemonessLifeClock } from './life.js';
import { UNAGING_DEMONESS_TARGET_ID, UNAGING_DEMONESS_POWERS, UNAGING_DEMONESS_POWER_IDS, hasUnagingDemonessDisputeOpponent,
  type UnagingDemonessEnemyIntent, type UnagingDemonessPowerId, type UnagingDemonessEncounterScene } from './encounter.js';

export const UNAGING_DEMONESS_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const UNAGING_DEMONESS_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const unagingDemonessActionCount = pyromaniacActionCount;
export const unagingDemonessEnemyActionCount = pyromaniacActionCount;
const MIRROR = 'assassin.s3.mirror-passage', FLAME = 'assassin.s7.black-flame', FROST = 'assassin.s7.frost', SUBSTITUTE = 'assassin.s7.substitute', SILK = 'assassin.s6.silk-binding';
export type UnagingDemonessMoveId = typeof MIRROR | typeof FLAME | typeof FROST | typeof SUBSTITUTE | typeof SILK | 'ACCIDENT';
/** The actual S4 six slots, replacing only plague20 with mirror20. All inherited costs remain real. */
const ABILITIES: readonly { id: UnagingDemonessMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: FLAME, label: '继承黑焰（2S；持自己的原棍则普通打击16）', weight: 30, stance: 'ATTACK' },
  { id: FROST, label: '继承冰霜（2S，有限减势）', weight: 15, stance: 'ATTACK' },
  { id: SUBSTITUTE, label: '继承替身（3S＋实际已备小镜／2S＋原粉／普通避让）', weight: 20, stance: 'DEFEND' },
  { id: MIRROR, label: '两原镜有限通行（6S/知识18，同一身体移动2米，减势36G）', weight: 20, stance: 'CONTROL' },
  { id: SILK, label: '继承丝线（布丝3S，另抽3S实体牵制）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡（固定−22.5G）', weight: 5, stance: null },
];
export const UNAGING_DEMONESS_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'FORCE_STRIKE', label: '原科宾有限灵性冲击：5S/70G', weight: 35 },
  { id: 'SEAL_MIRROR', label: '有限封镜：4S/下一次通行；共三次', weight: 25 },
  { id: 'BODY_STRIKE', label: '自有原棍普通打击：20×身体G', weight: 20 },
  { id: 'BREAK_MIRROR', label: '实际击碎原镜B一次：5S', weight: 15 },
  { id: 'ACCIDENT', label: '判断偏差：−22.5G', weight: 5 },
];
export const isUnagingDemoness = (s: SliceState): boolean => s.progression.pathwayId === 'demoness' && s.progression.sequence === 3;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function unagingDemonessAbilityWheel(s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, weight: weights[i]! / total * 100,
    label: a.id === FLAME && s.town.clubLocation === 'HAND' ? '自己的实际原短棍16×身体、0S，替换黑焰' : a.label }));
}
export function drawUnagingDemonessAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): UnagingDemonessMoveId {
  const weights = tickets(stance); let n = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { n -= weights[i]!; if (n <= 0) return a.id; }
  throw new Error('不老魔女六槽能力盘无效。');
}
export function drawUnagingDemonessEnemyAbility(random: ActionRandomStream): UnagingDemonessEnemyIntent {
  let n = random.nextInt(1, 100); for (const a of UNAGING_DEMONESS_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as UnagingDemonessEnemyIntent; }
  throw new Error('原科宾动作盘无效。');
}
export interface UnagingDemonessCombatSource {
  runId: string; revision: number; week: number; round: number; encounterId: 'UNAGING_DEMONESS_DISPUTE'; targetId: typeof UNAGING_DEMONESS_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetAge: 49; targetSequence: 3; targetPhysique: 20; actualOriginalBody: true; independentMind: true;
  enemyWeapon: 'UD3-CORBIN-ROD'; weaponLocation: 'HAND'; distanceMetres: 2; space: 'UD3-COURT';
  abilitySource: 'ORIGINAL_LIMITED_G'; ordinaryExit: true; pursuit: false; thirdPartiesInArea: 0; automaticAllyImmunity: false;
  playerHealth: number; playerMind: number; playerSpirituality: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyInjuries: SliceInjury[]; enemyRisk: number; clubHeld: boolean; knowledge: number; perception: number; lifeClockSeconds: number;
  mastery: Record<string, number>; tools: WitchTools; scene: UnagingDemonessEncounterScene; sealReady: boolean; silkPrepared: boolean;
  powerUses: Record<UnagingDemonessPowerId, number>;
}
const bounded = (n: number, max: number) => Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
export function currentUnagingDemonessCombatSource(s: SliceState): UnagingDemonessCombatSource | null {
  if (!hasUnagingDemonessDisputeOpponent(s)) return null;
  const e = s.unagingDemoness.encounter, c = s.combat!;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'UNAGING_DEMONESS_DISPUTE', targetId: UNAGING_DEMONESS_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetAge: 49, targetSequence: 3, targetPhysique: 20, actualOriginalBody: true, independentMind: true,
    enemyWeapon: 'UD3-CORBIN-ROD', weaponLocation: 'HAND', distanceMetres: 2, space: 'UD3-COURT', abilitySource: 'ORIGINAL_LIMITED_G',
    ordinaryExit: true, pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality,
    enemyInjuries: structuredClone(c.enemyInjuries), enemyRisk: c.enemyRisk, clubHeld: s.town.clubLocation === 'HAND',
    knowledge: s.character.coreStats.knowledge, perception: s.character.coreStats.perception, lifeClockSeconds: s.unagingDemoness.life.clockSeconds,
    mastery: Object.fromEntries([FLAME, FROST, SUBSTITUTE, SILK, 'assassin.s7.invisibility'].map(id => [id, s.progression.mastery[id] ?? 0])),
    tools: structuredClone(s.witch.tools), scene: structuredClone(e.scene), sealReady: e.sealReady, silkPrepared: e.silkPrepared, powerUses: { ...e.powerUses } };
}
export interface UnagingDemonessCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: false }
interface ActionEvidence extends UnagingDemonessCombatEffect { order: number; paidCost: number; physicalFactor: number; rolls: number[]; mode: string }
export interface UnagingDemonessPlayerAction extends ActionEvidence { id: UnagingDemonessMoveId; from: UnagingDemonessEncounterScene['playerPosition']; to: UnagingDemonessEncounterScene['playerPosition'] }
export interface UnagingDemonessEnemyAction extends ActionEvidence { planned: UnagingDemonessEnemyIntent; actual: UnagingDemonessEnemyIntent; boundConsumed: boolean }
export interface UnagingDemonessRoundContext {
  source: UnagingDemonessCombatSource; stance: SliceStance; finished: boolean; liveState: string; boundReady: boolean;
  playerActions: UnagingDemonessPlayerAction[]; enemyActions: UnagingDemonessEnemyAction[]; label: string; outcome: UnagingDemonessRoundOutcome | null;
}
const none = (label: string): UnagingDemonessCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false });
function liveState(s: SliceState): string { return stableStringify({ spirituality: s.spirituality, encounter: s.unagingDemoness.encounter, tools: s.witch.tools, clockSeconds: s.unagingDemoness.life.clockSeconds }); }
const dynamicSource = new Set(['playerSpirituality', 'enemySpirituality', 'powerUses', 'scene', 'tools', 'sealReady', 'silkPrepared']);
function validRound(s: SliceState, r: UnagingDemonessRoundContext, supplied: UnagingDemonessCombatSource | null): boolean {
  const actual = currentUnagingDemonessCombatSource(s);
  return !r.finished && actual !== null && supplied !== null && same(supplied, r.source) && r.liveState === liveState(s) &&
    Object.entries(r.source).every(([key, value]) => dynamicSource.has(key) || same(actual[key as keyof UnagingDemonessCombatSource], value));
}
export function beginUnagingDemonessCombatRound(s: SliceState, stance: SliceStance, _random: ActionRandomStream): UnagingDemonessRoundContext {
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('不老魔女战斗姿态无效。');
  const source = currentUnagingDemonessCombatSource(s); if (!source) throw new Error('缺少原科宾、原棍、两原镜或连续回合来源。');
  if (stance === 'DEFEND' || stance === 'RETREAT') s.unagingDemoness.encounter.silkPrepared = false;
  return { source, stance, finished: false, liveState: liveState(s), boundReady: false, playerActions: [], enemyActions: [], outcome: null,
    label: `同一49岁原科宾持唯一原棍，独立S${source.enemySpirituality}/120。两原镜相距2米；本人当前在${source.scene.playerPosition}，普通出口分别距A2米/B4米。镜路仅有限当轮定位减势，不同时攻击、不复活。` };
}
export const createUnagingDemonessCombatRound = beginUnagingDemonessCombatRound;
interface Resources { playerS: number; enemyS: number; tools: WitchTools; scene: UnagingDemonessEncounterScene; powers: Record<UnagingDemonessPowerId, number>; seal: boolean; silk: boolean; bound: boolean }
function resources(s: SliceState, r: UnagingDemonessRoundContext): Resources {
  const e = s.unagingDemoness.encounter;
  return { playerS: s.spirituality, enemyS: e.enemySpirituality, tools: structuredClone(s.witch.tools), scene: structuredClone(e.scene), powers: { ...e.powerUses }, seal: e.sealReady, silk: e.silkPrepared, bound: r.boundReady };
}
function commit(s: SliceState, r: UnagingDemonessRoundContext, q: Resources): void {
  const e = s.unagingDemoness.encounter; s.spirituality = q.playerS; e.enemySpirituality = q.enemyS; s.witch.tools = q.tools;
  e.scene = q.scene; e.powerUses = q.powers; e.sealReady = q.seal; e.silkPrepared = q.silk; r.boundReady = q.bound; r.liveState = liveState(s);
}
const mastery = (x: UnagingDemonessCombatSource, id: string) => .65 + .35 * bounded(x.mastery[id] ?? 0, 500) / 500;
function rollsRequired(q: Resources, id: UnagingDemonessMoveId): number {
  return id === MIRROR ? Number(q.playerS >= 6 && q.scene.mirrorA.intact && q.scene.mirrorB.intact && !q.seal)
    : id === SILK ? Number(q.playerS >= 3 && q.silk) : 0;
}
/** Pure ordered resource replay; every returned effect is generated by the same transition used at runtime. */
function playerAction(x: UnagingDemonessCombatSource, q: Resources, id: UnagingDemonessMoveId, physical: number, rolls: number[], order: number): UnagingDemonessPlayerAction {
  const a: UnagingDemonessPlayerAction = { ...none(''), id, order, paidCost: 0, physicalFactor: physical, rolls: [...rolls], mode: 'NONE', from: q.scene.playerPosition, to: q.scene.playerPosition };
  if (id === 'ACCIDENT') { a.selfGain = -22.5; a.label = '本次判断失衡固定−22.5G，0S，不重抽。'; }
  else if (id === FLAME) {
    if (x.clubHeld || q.playerS < 2) { a.mode = 'ORDINARY'; a.selfGain = (x.clubHeld ? 16 : 12) * physical; a.label = `以${x.clubHeld ? '自己实际持有原短棍16' : '原身体徒手12'}×身体普通打击G，0S；不叠黑焰。`; }
    else { a.paidCost = 2; a.selfGain = 59.15 * mastery(x, id); a.label = '继承原黑焰实付2S，59.15×旧掌握系数G；只入共同胜负与伤势盘。'; }
    a.threatens = a.selfGain > 0;
  } else if (id === FROST) {
    if (q.playerS < 2) { a.mode = 'ORDINARY'; a.enemyReduction = 6 * physical; a.label = '不足2S，普通身体牵制6×身体G，不透支。'; }
    else { a.paidCost = 2; a.enemyReduction = 31.85 * mastery(x, id); a.label = '继承原冰霜实付2S，31.85×旧掌握系数G，只减本轮优势，不中断或删除敌槽。'; }
  } else if (id === SUBSTITUTE) {
    if (q.tools.mirrorPrepared && q.tools.mirrorsHeld > 0 && q.playerS >= 3) {
      a.mode = 'ORIGINAL_SMALL_MIRROR'; a.paidCost = 3; q.tools.mirrorsHeld--; q.tools.mirrorsUsed++; q.tools.mirrorPrepared = false;
      a.enemyReduction = 42.25 * mastery(x, id); a.label = '实付3S并碎耗一面实际已备旧小镜，42.25×旧替身掌握G；不消耗院内A/B原镜，不撤销伤势或死亡。';
    } else if (q.tools.powderHeld > 0 && q.playerS >= 2) {
      a.mode = 'ORIGINAL_POWDER'; a.paidCost = 2; q.tools.powderHeld--; q.tools.powderUsed++; a.enemyReduction = 21.125 * mastery(x, 'assassin.s7.invisibility');
      a.label = '实付2S并耗一剂实际旧原粉，21.125×旧隐形掌握G；不生成工具或复活。';
    } else { a.mode = 'ORDINARY'; a.enemyReduction = 10 * physical; a.label = '原镜/原粉或灵性不足，普通避让10×身体G，0S。'; }
  } else if (id === MIRROR) {
    if (!q.scene.mirrorA.intact || !q.scene.mirrorB.intact || q.seal || q.playerS < 6) {
      a.mode = !q.scene.mirrorA.intact || !q.scene.mirrorB.intact ? 'BROKEN_MIRROR' : q.seal ? 'SEALED_MIRROR' : 'LOW_SPIRITUALITY';
      if (q.seal) q.seal = false;
      a.enemyReduction = 10 * physical; a.label = `原镜${a.mode === 'BROKEN_MIRROR' ? '已经破损' : a.mode === 'SEALED_MIRROR' ? '被本次有限封锁；该一次封锁已触发' : '可用但不足6S'}，未施镜路；原身体留${a.from}普通避让10×身体G，0S、不抽检定、不免费穿镜。`;
    } else {
      a.paidCost = 6; const success = rolls[0]! <= computeCheckChance({ ability: 'knowledge', baseAbility: x.knowledge, difficulty: 18, modifiers: [] });
      a.mode = success ? 'MIRROR_SUCCESS' : 'MIRROR_FAILURE';
      if (success) { q.scene.playerPosition = a.from === 'A' ? 'B' : 'A'; q.scene.mirrorPassedMetres += 2; a.to = q.scene.playerPosition; a.enemyReduction = 36; }
      a.label = `同一身体从原镜${a.from}实付6S，知识18实抽${rolls[0]}，${success ? `沿本场唯一2米镜路到原镜${a.to}；仅当轮定位减势36G，不同时攻击` : `失败，留原${a.from}点，0贡献、费用不退`}。不是任意传送、替身或复活。`;
    }
  } else if (id === SILK) {
    if (q.playerS < 3) { a.mode = 'LOW_SPIRITUALITY'; a.label = '不足3S，不能布丝或牵引，不免费检定。'; }
    else {
      a.paidCost = 3;
      if (!q.silk) { q.silk = true; a.mode = 'SILK_PREPARED'; a.label = '实付3S在当前原院布丝，0即时优势，须另槽再付3S牵引。'; }
      else {
        q.silk = false; const chance = Math.max(5, Math.min(95, 50 + .08 * (.5 * x.perception + .5 * (x.mastery[id] ?? 0) - x.targetPhysique)));
        const success = rolls[0]! <= chance; a.mode = success ? 'SILK_BOUND' : 'SILK_RESISTED'; if (success) q.bound = true;
        a.label = `另付3S实体丝线牵引，原科宾身体抵抗实抽${rolls[0]}/${Number(chance.toFixed(2))}，${success ? '仅本轮下一次原棍实体贡献×0.5，触发即解' : '挣脱，0贡献'}；不控心、不削灵性冲击、不删除槽。`;
      }
    }
  }
  q.playerS -= a.paidCost; return a;
}
function enemyAction(q: Resources, planned: UnagingDemonessEnemyIntent, physical: number, order: number): UnagingDemonessEnemyAction {
  const power = UNAGING_DEMONESS_POWERS.find(p => p.id === planned);
  const usable = !!power && q.enemyS >= power.cost && (planned !== 'SEAL_MIRROR' || q.powers.SEAL_MIRROR < 3 && !q.seal && q.scene.mirrorB.intact) &&
    (planned !== 'BREAK_MIRROR' || q.powers.BREAK_MIRROR === 0 && q.scene.mirrorB.intact);
  const actual = power && !usable ? 'BODY_STRIKE' : planned;
  const a: UnagingDemonessEnemyAction = { ...none(''), order, paidCost: usable ? power!.cost : 0, physicalFactor: physical, rolls: [], mode: actual === planned ? 'ORIGINAL' : 'ORDINARY_FALLBACK', planned, actual, boundConsumed: false };
  if (usable) { q.enemyS -= a.paidCost; q.powers[power!.id]++; }
  if (actual === 'ACCIDENT') { a.selfGain = -22.5; a.label = '原科宾本次判断失衡−22.5G，0S，不重抽。'; }
  else if (actual === 'BODY_STRIKE') {
    a.boundConsumed = q.bound; if (q.bound) q.bound = false;
    a.selfGain = 20 * physical * (a.boundConsumed ? .5 : 1); a.threatens = a.selfGain > 0;
    a.label = `${a.mode === 'ORDINARY_FALLBACK' ? '原法术资源不足或原镜已碎/封锁未耗，0S普通回退；' : ''}科宾持同一UD3-CORBIN-ROD打击20×身体G${a.boundConsumed ? '，本轮实体丝缚触发×0.5后解除' : ''}，不复制原棍。`;
  } else if (actual === 'FORCE_STRIKE') { a.selfGain = 70; a.threatens = true; a.label = '同一原科宾原创G灵性冲击实付5S/优势70，不借旧瓦伦能力或资源。'; }
  else if (actual === 'SEAL_MIRROR') { q.seal = true; a.label = '原科宾实付4S使用原三次预算之一，封住本场下一次原镜通行；不叠加、不封普通出口，不保证封锁所有高位镜法。'; }
  else if (actual === 'BREAK_MIRROR') { q.scene.mirrorB.intact = false; q.seal = false; a.label = '原科宾实付5S实际击碎唯一UD3-COMBAT-B；原镜碎裂持久保留，不可再付费重碎或免费修复，普通出口仍开放。'; }
  return a;
}
export function resolveUnagingDemonessCombatAbility(s: SliceState, id: UnagingDemonessMoveId, physical: number, random: ActionRandomStream,
  r: UnagingDemonessRoundContext, source: UnagingDemonessCombatSource | null = r.source): UnagingDemonessCombatEffect {
  if (!validRound(s, r, source) || r.playerActions.length >= 6 || !ABILITIES.some(a => a.id === id)) return none('当前原人、原镜或原资源来源无效，0贡献0消耗，不重抽。');
  const q = resources(s, r), rolls = Array.from({ length: rollsRequired(q, id) }, () => random.nextInt(1, 100));
  const a = playerAction(r.source, q, id, bounded(physical, 1), rolls, r.playerActions.length + r.enemyActions.length);
  r.playerActions.push(a); commit(s, r, q); return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: false };
}
export function resolveUnagingDemonessEnemyAbility(s: SliceState, planned: UnagingDemonessEnemyIntent, physical: number, _random: ActionRandomStream,
  r: UnagingDemonessRoundContext, source: UnagingDemonessCombatSource | null = r.source): UnagingDemonessCombatEffect {
  if (!validRound(s, r, source) || r.enemyActions.length >= 6 || ![...UNAGING_DEMONESS_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned)) return none('当前原科宾、原镜或原资源来源无效，0贡献0消耗，不重抽。');
  const q = resources(s, r), a = enemyAction(q, planned, bounded(physical, 1), r.playerActions.length + r.enemyActions.length);
  r.enemyActions.push(a); commit(s, r, q); return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens, mentalPressure: false };
}
export interface UnagingDemonessRoundOutcome {
  targetId: typeof UNAGING_DEMONESS_TARGET_ID; round: number; source: UnagingDemonessCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  enemyInjuriesAfter: SliceInjury[]; enemyRiskAfter: number; playerSpiritualityBefore: number; playerSpiritualityAfter: number;
  playerHealthAfter: number; playerMindAfter: number; enemySpiritualityBefore: number; powerUses: Record<UnagingDemonessPowerId, number>;
  sceneAfter: UnagingDemonessEncounterScene; toolsAfter: WitchTools; sealReadyAfter: boolean; silkPreparedAfter: boolean; boundReadyAfter: false;
  elapsedSeconds: 60; lifeClockSecondsAfter: number; playerActions: UnagingDemonessPlayerAction[]; enemyActions: UnagingDemonessEnemyAction[];
}
export function finishUnagingDemonessCombatRound(s: SliceState, r: UnagingDemonessRoundContext, continuing = true): UnagingDemonessRoundOutcome {
  const e = s.unagingDemoness.encounter, c = s.combat;
  if (r.finished || !c || c.encounterId !== 'UNAGING_DEMONESS_DISPUTE' || c.round !== r.source.round || r.liveState !== liveState(s)) throw new Error('原回合已结束或原资源来源被改写。');
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus; e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk;
  if (e.enemyStatus !== 'RESISTING') e.weaponLocation = 'COURT';
  if (!continuing) { e.sealReady = false; e.silkPrepared = false;
    if (s.health > 0 && e.scene.playerPosition !== 'EXIT') { e.scene.ordinaryWalkedMetres += e.scene.exits[e.scene.playerPosition]; e.scene.playerPosition = 'EXIT'; }
  }
  advanceUnagingDemonessLifeClock(s, 60); r.boundReady = false; r.finished = true;
  r.outcome = { targetId: UNAGING_DEMONESS_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus,
    enemyInjuriesAfter: structuredClone(c.enemyInjuries), enemyRiskAfter: c.enemyRisk, playerSpiritualityBefore: r.source.playerSpirituality,
    playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind, enemySpiritualityBefore: r.source.enemySpirituality,
    powerUses: { ...e.powerUses }, sceneAfter: structuredClone(e.scene), toolsAfter: structuredClone(s.witch.tools), sealReadyAfter: e.sealReady,
    silkPreparedAfter: e.silkPrepared, boundReadyAfter: false, elapsedSeconds: 60, lifeClockSecondsAfter: s.unagingDemoness.life.clockSeconds,
    playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
  return structuredClone(r.outcome);
}
export function unagingDemonessRoundOutcome(r: UnagingDemonessRoundContext): UnagingDemonessRoundOutcome { if (!r.outcome) throw new Error('先实际结束原回合。'); return structuredClone(r.outcome); }
export function projectUnagingDemonessCombat(s: SliceState) {
  const e = s.unagingDemoness.encounter, visible = isUnagingDemoness(s);
  return { enemyName: visible ? '科宾·里德（49岁，原创有限G3非凡者）' : '', targetId: visible ? e.targetId : null,
    enemyMind: visible ? e.enemyMind : null, enemySpirituality: visible ? e.enemySpirituality : null, powerUses: visible ? { ...e.powerUses } : null,
    scene: visible ? structuredClone(e.scene) : null, source: visible ? currentUnagingDemonessCombatSource(s) : null,
    summary: visible ? '双方1–6次10/15/25/25/15/10，继承绝望4真实核心25/30/30/15；1250/底125、S120，只有CONTINUE恢复12。六槽黑焰30/冰霜15/原替身20/镜路20/丝线10/失衡5。唯一新镜路6S/知识18，实际A↔B2米，成功只减势36G；失败原地实耗，封/碎镜0S普通回退。敌冲击5S、封镜4S最多三次、碎B5S只一次，无免费修镜、治疗或复活。院内两镜不替代原女巫消耗品；旧瓦伦投降与疾病照护历史不改。' : '' };
}
export function validateUnagingDemonessRoundOutcome(value: unknown): value is UnagingDemonessRoundOutcome {
  try {
    const o = value as UnagingDemonessRoundOutcome, x = o?.source;
    if (!o || !x || typeof x.runId !== 'string' || !integer(x.revision) || !integer(x.week, 1) || !integer(x.round, 1) || !integer(x.startHistoryIndex) || x.attemptWeek !== x.week ||
      x.encounterId !== 'UNAGING_DEMONESS_DISPUTE' || x.targetId !== UNAGING_DEMONESS_TARGET_ID || x.targetAge !== 49 || x.targetSequence !== 3 || x.targetPhysique !== 20 ||
      x.actualOriginalBody !== true || x.independentMind !== true || x.enemyWeapon !== 'UD3-CORBIN-ROD' || x.weaponLocation !== 'HAND' || x.distanceMetres !== 2 || x.space !== 'UD3-COURT' ||
      x.ordinaryExit !== true || x.pursuit !== false || x.thirdPartiesInArea !== 0 || x.automaticAllyImmunity !== false || x.abilitySource !== 'ORIGINAL_LIMITED_G' ||
      ![x.playerHealth, x.playerMind, x.enemyHealth, x.enemyMind].every(n => integer(n, 1, 100)) || !integer(x.knowledge, 0, 500) || !integer(x.perception, 0, 500) || typeof x.clubHeld !== 'boolean' ||
      !integer(x.lifeClockSeconds) || o.lifeClockSecondsAfter !== x.lifeClockSeconds + 60 || !Array.isArray(x.enemyInjuries) || !integer(x.enemyRisk) || !Array.isArray(o.enemyInjuriesAfter) || !integer(o.enemyRiskAfter) ||
      o.targetId !== UNAGING_DEMONESS_TARGET_ID || o.round !== x.round || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(o.stance) || typeof o.continuing !== 'boolean' ||
      o.elapsedSeconds !== 60 || o.boundReadyAfter !== false || !integer(o.enemyHealth, 0, x.enemyHealth) || !integer(o.playerHealthAfter, 0, x.playerHealth) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(o.enemyStatus) || (o.enemyStatus === 'DEAD') !== (o.enemyHealth === 0) || o.enemyMind !== x.enemyMind || o.playerMindAfter !== x.playerMind ||
      ![x.playerSpirituality, x.enemySpirituality, o.playerSpiritualityAfter, o.enemySpirituality].every(n => integer(n, 0, 120)) || o.playerSpiritualityBefore !== x.playerSpirituality || o.enemySpiritualityBefore !== x.enemySpirituality ||
      !Array.isArray(o.playerActions) || !Array.isArray(o.enemyActions) || o.playerActions.length > 6 || o.enemyActions.length > 6 || !x.powerUses || Object.keys(x.powerUses).length !== 3 ||
      !UNAGING_DEMONESS_POWER_IDS.every(id => integer(x.powerUses[id])) || x.powerUses.SEAL_MIRROR > 3 || x.powerUses.BREAK_MIRROR > 1 ||
      x.enemySpirituality !== 120 - UNAGING_DEMONESS_POWERS.reduce((n, p) => n + x.powerUses[p.id] * p.cost, 0) || !validScene(x.scene) || x.scene.playerPosition === 'EXIT' ||
      x.scene.mirrorB.intact !== (x.powerUses.BREAK_MIRROR === 0) || typeof x.sealReady !== 'boolean' || typeof x.silkPrepared !== 'boolean' ||
      (x.sealReady && (!x.scene.mirrorB.intact || x.powerUses.SEAL_MIRROR === 0)) || !validTools(x.tools) || !x.mastery ||
      !same(Object.keys(x.mastery).sort(), [FLAME, FROST, SUBSTITUTE, SILK, 'assassin.s7.invisibility'].sort()) || Object.values(x.mastery).some(n => !integer(n, 0, 500))) return false;
    const q: Resources = { playerS: x.playerSpirituality, enemyS: x.enemySpirituality, tools: structuredClone(x.tools), scene: structuredClone(x.scene), powers: { ...x.powerUses }, seal: x.sealReady,
      silk: ['DEFEND', 'RETREAT'].includes(o.stance) ? false : x.silkPrepared, bound: false };
    const actions = [...o.playerActions.map(a => ({ actor: 'PLAYER' as const, a })), ...o.enemyActions.map(a => ({ actor: 'ENEMY' as const, a }))].sort((a, b) => a.a.order - b.a.order);
    for (const [i, entry] of actions.entries()) {
      const a = entry.a;
      if (a.order !== i || !Number.isFinite(a.physicalFactor) || a.physicalFactor < 0 || a.physicalFactor > 1 || !Array.isArray(a.rolls) || a.rolls.some(n => !integer(n, 1, 100))) return false;
      if (entry.actor === 'PLAYER') {
        const b = entry.a; if (!ABILITIES.some(v => v.id === b.id) || b.rolls.length !== rollsRequired(q, b.id) || !same(b, playerAction(x, q, b.id, b.physicalFactor, b.rolls, i))) return false;
      } else { const b = entry.a; if (![...UNAGING_DEMONESS_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(b.planned) || !same(b, enemyAction(q, b.planned, b.physicalFactor, i))) return false; }
    }
    if ((!o.playerActions.some(a => a.threatens) && (o.enemyHealth !== x.enemyHealth || o.enemyStatus !== 'RESISTING' || !same(o.enemyInjuriesAfter, x.enemyInjuries))) ||
        (!o.enemyActions.some(a => a.threatens) && o.playerHealthAfter !== x.playerHealth)) return false;
    if (!o.continuing) { q.seal = false; q.silk = false;
      if (o.playerHealthAfter > 0 && q.scene.playerPosition !== 'EXIT') { q.scene.ordinaryWalkedMetres += q.scene.exits[q.scene.playerPosition]; q.scene.playerPosition = 'EXIT'; }
    }
    return q.playerS === o.playerSpiritualityAfter && q.enemyS === o.enemySpirituality && same(q.powers, o.powerUses) && same(q.tools, o.toolsAfter) && same(q.scene, o.sceneAfter) &&
      q.seal === o.sealReadyAfter && q.silk === o.silkPreparedAfter;
  } catch { return false; }
}
export function validUnagingDemonessCombatScene(scene: unknown): scene is UnagingDemonessEncounterScene { return validScene(scene as UnagingDemonessEncounterScene); }
function validScene(v: UnagingDemonessEncounterScene): boolean {
  return !!v && v.courtId === 'UD3-COURT' && v.ordinaryExit === 'OPEN' && v.thirdPartiesInArea === 0 && v.clearanceConfirmed === true &&
    ['A', 'B', 'EXIT'].includes(v.playerPosition) && v.mirrorsDistanceMetres === 2 && same(v.exits, { A: 2, B: 4 }) && v.mirrorA?.id === 'UD3-COMBAT-A' && v.mirrorA.intact === true &&
    v.mirrorB?.id === 'UD3-COMBAT-B' && typeof v.mirrorB.intact === 'boolean' && integer(v.ordinaryWalkedMetres) && integer(v.mirrorPassedMetres) && v.mirrorPassedMetres % 2 === 0;
}
function validTools(t: WitchTools): boolean { return !!t && ['kitsBought', 'powderHeld', 'powderUsed', 'mirrorsHeld', 'mirrorsUsed'].every(k => integer(t[k as keyof WitchTools])) && typeof t.mirrorPrepared === 'boolean' && (t.lastPurchaseWeek === null || integer(t.lastPurchaseWeek, 1)) && (!t.mirrorPrepared || t.mirrorsHeld > 0); }
