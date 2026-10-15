import { DeterministicActionRandomStream, type ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { PublicGameDate, PublicCheckResult } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { isValidGameDate } from '../game-calendar.js';
import { DISCERNER_COUNT_WHEEL, discernerActionCount } from '../discerner/combat.js';
import type { SliceCombatRound, SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { WRITER_TARGET_ID, WRITER_SITE, WRITER_POWER_IDS, WRITER_POWERS, combatBody, initialWriterBody, hasWriterDisputeOpponent,
  validateWriterPreparation, validWriterMaterials, validWriterScene, type WriterCombatBody, type WriterEnemyIntent,
  type WriterPreparation, type WriterMaterials, type WriterScene, type WriterPolicy } from './encounter.js';

/** The actual Discerner/Audience S4-derived six-slot count wheel, 30/25/30/15
 * weighted core, 1250/floor125, max120 and CONTINUE-only12 profile are retained. */
export const WRITER_COUNT_WHEEL = DISCERNER_COUNT_WHEEL;
export const WRITER_ENEMY_COUNT_WHEEL = DISCERNER_COUNT_WHEEL;
export const writerActionCount = discernerActionCount;
export const writerEnemyActionCount = discernerActionCount;
export const RECIPROCAL_INSIGHT = 'audience.s1.reciprocal-insight', PLAUSIBLE_ARRANGEMENT = 'audience.s1.plausible-arrangement';
export const WRITER_NEW_ABILITY_IDS = [RECIPROCAL_INSIGHT, PLAUSIBLE_ARRANGEMENT] as const;
export const WRITER_INHERITED_SKILL_IDS = ['audience.observation', 'audience.behavior-analysis', 'audience.memory-deduction', 'audience.mind-reading',
  'audience.s7.awe', 'audience.s7.frenzy', 'audience.s7.suggestion', 'audience.s7.soothe', 'audience.s7.mental-communication',
  'audience.s6.hypnosis', 'audience.s6.combat-hypnosis', 'audience.s6.psychological-invisibility', 'audience.s6.scales',
  'audience.s5.dream-guidance', 'audience.s5.dream-modification', 'audience.s5.dream-travel', 'audience.s4.mind-island',
  'audience.s4.virtual-persona', 'audience.s4.mental-plague', 'audience.s3.external-identity', 'audience.s3.woven-image',
  'audience.s2.mental-imprint', 'audience.s2.insight-window'] as const;
export type WriterMoveId = typeof WRITER_INHERITED_SKILL_IDS[number] | typeof WRITER_NEW_ABILITY_IDS[number] | 'STRIKE' | 'BLOCK' | 'EVADE' | 'OBSERVE' | 'ACCIDENT';
export const WRITER_ABILITIES: readonly { id: WriterMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'STRIKE', label: '本人普通打击：空手12或实际在手原棍16', weight: 5, stance: 'ATTACK' },
  { id: 'BLOCK', label: '普通防备：减势10', weight: 4, stance: 'DEFEND' },
  { id: 'EVADE', label: '实际避让：减势18', weight: 4, stance: 'DEFEND' },
  { id: 'OBSERVE', label: '观察眼前原人：不取得未知秘密', weight: 3, stance: 'PREPARE' },
  { id: 'audience.observation', label: '敏锐观察当前动作', weight: 3, stance: 'PREPARE' },
  { id: 'audience.behavior-analysis', label: '依据当前持杖动作分析', weight: 3, stance: 'CONTROL' },
  { id: 'audience.memory-deduction', label: '比较本场已亲历动作', weight: 2, stance: 'PREPARE' },
  { id: 'audience.mind-reading', label: '浅层读心：1灵性、感知12', weight: 3, stance: 'CONTROL' },
  { id: 'audience.s7.awe', label: '有限震慑：2灵性、有限减势22', weight: 3, stance: 'CONTROL' },
  { id: 'audience.s7.frenzy', label: '有限狂乱：3灵性、意志14', weight: 3, stance: 'ATTACK' },
  { id: 'audience.s7.suggestion', label: '有限暗示：2灵性、意志14', weight: 3, stance: 'CONTROL' },
  { id: 'audience.s7.soothe', label: '安抚须有实际安静自愿情境；本场普通防备', weight: 1, stance: 'DEFEND' },
  { id: 'audience.s7.mental-communication', label: '心理沟通须自愿媒介；本场普通观察', weight: 1, stance: 'PREPARE' },
  { id: 'audience.s6.hypnosis', label: '非战斗催眠须真实集中注意；本场普通防备', weight: 1, stance: 'CONTROL' },
  { id: 'audience.s6.combat-hypnosis', label: '短暂战斗催眠：3灵性、意志14', weight: 4, stance: 'CONTROL' },
  { id: 'audience.s6.psychological-invisibility', label: '当面行动仍被注意；本场普通避让', weight: 1, stance: 'DEFEND' },
  { id: 'audience.s6.scales', label: '继承鳞片：2灵性、有限防护', weight: 7, stance: 'DEFEND' },
  { id: 'audience.s5.dream-guidance', label: '对方清醒，无可进入原梦境', weight: 1, stance: 'PREPARE' },
  { id: 'audience.s5.dream-modification', label: '对方清醒，无可修改原梦境', weight: 1, stance: 'CONTROL' },
  { id: 'audience.s5.dream-travel', label: '没有已建立原梦境通路，不能传送', weight: 1, stance: 'PREPARE' },
  { id: 'audience.s4.mind-island', label: '继承心灵岛屿：4灵性、意志16', weight: 7, stance: 'ATTACK' },
  { id: 'audience.s4.virtual-persona', label: '本人防守人格：3灵性1精神', weight: 6, stance: 'DEFEND' },
  { id: 'audience.s4.mental-plague', label: '精神瘟疫：4灵性、意志18，仅播种一次', weight: 5, stance: 'CONTROL' },
  { id: 'audience.s3.external-identity', label: '短暂有限身份：5灵性2精神、意志16，行动后归并', weight: 6, stance: 'CONTROL' },
  { id: 'audience.s3.woven-image', label: '近真梦像：6灵性、意志18，仍可识破', weight: 7, stance: 'ATTACK' },
  { id: 'audience.s2.mental-imprint', label: '继承有限心灵印记：6灵性2精神、意志18，每轮一次', weight: 8, stance: 'CONTROL' },
  { id: 'audience.s2.insight-window', label: '继承洞察窗口：5灵性1精神、意志18，每轮一次', weight: 8, stance: 'PREPARE' },
  { id: RECIPROCAL_INSIGHT, label: '互知线索：6灵性2精神、意志18，每轮一次', weight: 14, stance: 'PREPARE' },
  { id: PLAUSIBLE_ARRANGEMENT, label: '合理安排：8灵性3精神、意志20，只影响下一项待执行动作', weight: 14, stance: 'CONTROL' },
  { id: 'ACCIDENT', label: '实际判断失衡：贡献−22.5', weight: 3, stance: null },
];
export const WRITER_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'MIND_PULSE', label: '有限心灵冲击：7灵性、95精神贡献', weight: 30 },
  { id: 'WARD', label: '一次精神护持：6灵性，30秒内一次精神攻击最多减60', weight: 20 },
  { id: 'ATTENTION', label: '集中抵抗：3灵性，30秒内一次精神抵抗提高到70%', weight: 20 },
  { id: 'BODY_STRIKE', label: '自己的唯一原杖：22×身体状态', weight: 20 },
  { id: 'OBSERVE', label: '普通观察眼前动作', weight: 5 },
  { id: 'ACCIDENT', label: '判断偏差：贡献−22.5', weight: 5 },
];
export const isWriter = (s: SliceState) => s.progression.pathwayId === 'audience' && s.progression.sequence === 1;
const tickets = (stance: SliceStance | null) => WRITER_ABILITIES.map(a => a.weight * (a.stance === stance && stance !== null ? 5 : 4));
export function writerAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((n, v) => n + v, 0); return WRITER_ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: weights[i]! / total * 100 }));
}
export function drawWriterAbility(random: ActionRandomStream, _s: SliceState | null, stance: SliceStance | null): WriterMoveId {
  const weights = tickets(stance); let n = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (const [i, a] of WRITER_ABILITIES.entries()) { n -= weights[i]!; if (n <= 0) return a.id; } throw new Error('作家行动盘无效。');
}
export function drawWriterEnemyAbility(random: ActionRandomStream): WriterEnemyIntent {
  let n = random.nextInt(1, 100); for (const a of WRITER_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as WriterEnemyIntent; } throw new Error('卢西安行动盘无效。');
}
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const shape = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), [...keys].sort());
const physicalAt = (n: number) => n > 75 ? 1 : n > 50 ? .95 : n > 25 ? .9 : .8;
export interface WriterCombatSource {
  runId: string; revision: number; week: number; date: PublicGameDate; round: number; encounterId: 'WRITER_DISPUTE'; targetId: typeof WRITER_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetName: '卢西安·维尔'; targetAge: 46; targetPathway: 'original-caster'; targetSequence: 1; targetCore: 22;
  actualBody: true; independentMind: true; automaticTrueGod: false; playerBodyId: string; enemyWeapon: 'WR1-LUCIAN-ROD'; weaponOwner: typeof WRITER_TARGET_ID;
  ordinaryExit: 'OPEN'; pursuit: false; thirdPartiesInArea: 0; automaticAllyImmunity: false; freeSkillLibrary: false; policy: WriterPolicy; clubHeld: boolean;
  playerHealth: number; playerMind: number; playerSpirituality: number; playerInjuries: SliceInjury[]; playerRisk: number;
  physique: number; perception: number; will: number; knowledge: number; mastery: Record<string, number>;
  preparation: WriterPreparation; root: WriterScene; materials: WriterMaterials; body: WriterCombatBody; randomSeed: string; randomCursor: number;
}
export function currentWriterCombatSource(s: SliceState): WriterCombatSource | null {
  if (!hasWriterDisputeOpponent(s)) return null; const e = s.writer.encounter, c = s.combat!;
  return { runId: s.runId, revision: s.revision, week: s.week, date: { ...s.date }, round: c.round, encounterId: 'WRITER_DISPUTE', targetId: WRITER_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetName: '卢西安·维尔', targetAge: 46, targetPathway: 'original-caster', targetSequence: 1, targetCore: 22,
    actualBody: true, independentMind: true, automaticTrueGod: false, playerBodyId: `${s.runId}:body`, enemyWeapon: 'WR1-LUCIAN-ROD', weaponOwner: WRITER_TARGET_ID,
    ordinaryExit: 'OPEN', pursuit: false, thirdPartiesInArea: 0, automaticAllyImmunity: false, freeSkillLibrary: false, policy: e.policy, clubHeld: s.town.clubLocation === 'HAND',
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, playerInjuries: structuredClone(s.injuries), playerRisk: s.injuryRisk,
    ...s.character.coreStats, mastery: { ...s.progression.mastery }, preparation: structuredClone(e.preparation!), root: structuredClone(e.scene), materials: structuredClone(e.materials), body: combatBody(e), randomSeed: s.random.seed, randomCursor: s.random.cursor };
}
export interface WriterPendingAction { id: string; planned: WriterEnemyIntent; actual: WriterEnemyIntent; declaredAt: number; visibleIntent: string }
export interface WriterWindow { id: string; kind: 'WARD' | 'ATTENTION' | 'RECIPROCAL' | 'ARRANGEMENT'; createdAt: number; expiresAt: number; targetActionId: string | null; magnitude: number }
export interface WriterWindows { ward: WriterWindow | null; attention: WriterWindow | null; reciprocal: WriterWindow | null; arrangement: WriterWindow | null }
export interface WriterActionEvidence {
  order: number; actor: 'PLAYER' | 'ENEMY'; id: string; planned: string; selectedAbility: string; fallbackReason: string | null; mode: string; label: string;
  selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: boolean; attackKind: 'NONE' | 'BODY' | 'MENTAL'; rawContribution: number; rawReduction: number;
  paidCost: number; mindCost: number; physicalFactor: number; check: PublicCheckResult | null; resistanceRoll: number | null; resistanceChance: number | null; succeeded: boolean; mindDamage: number; wardAbsorption: number; playerObservationGain: number;
  finiteResult: 'NONE' | 'UNAVAILABLE' | 'ALREADY_ATTEMPTED' | 'INSUFFICIENT' | 'FAILED' | 'RESISTED' | 'PENDING' | 'APPLIED';
  windowsBefore: WriterWindows; windowsAfter: WriterWindows; pendingBefore: WriterPendingAction | null; pendingAfter: WriterPendingAction | null; countered: string[]; masteryApplied: string[];
  identityCreated: boolean; identityRejoined: true; knownPlayerName: string | null; learnedClue: string | null;
  atSeconds: number; elapsedSeconds: 5; travelMetres: number; randomCursorBefore: number; randomCursorAfter: number;
  playerHealthAfter: number; playerMindAfter: number; playerSpiritualityAfter: number; enemyMindAfter: number; enemySpiritualityAfter: number;
}
export interface WriterRuntime {
  body: WriterCombatBody; root: WriterScene; materials: WriterMaterials; playerH: number; playerS: number; playerM: number;
  mastery: Record<string, number>; windows: WriterWindows; expiredWindows: WriterWindow[]; pendingEnemyAction: WriterPendingAction | null;
  reciprocalAttempted: boolean; arrangementAttempted: boolean; imprintAttempted: boolean; insightAttempted: boolean; plagueMindDamage: number;
}
export function createWriterRuntime(x: WriterCombatSource): WriterRuntime {
  const r: WriterRuntime = { body: structuredClone(x.body), root: structuredClone(x.root), materials: structuredClone(x.materials), playerH: x.playerHealth, playerS: x.playerSpirituality, playerM: x.playerMind,
    mastery: { ...x.mastery }, windows: { ward: null, attention: null, reciprocal: null, arrangement: null }, expiredWindows: [], pendingEnemyAction: null,
    reciprocalAttempted: false, arrangementAttempted: false, imprintAttempted: false, insightAttempted: false, plagueMindDamage: 0 };
  if (r.body.mentalPlague > 0 && r.body.infectedRound !== null && r.body.infectedRound < x.round && r.body.lastPlagueRound !== x.round) {
    r.plagueMindDamage = Math.min(r.body.enemyMind, 4 * r.body.mentalPlague); r.body.enemyMind -= r.plagueMindDamage;
    r.body.mentalPlague = Math.min(3, r.body.mentalPlague + 1); r.body.lastPlagueRound = x.round;
    if (r.body.enemyMind === 0) r.body.enemyStatus = 'SURRENDERED';
  }
  return r;
}
export function advanceWriterCombatClock(r: WriterRuntime, seconds: number): void {
  if (!integer(seconds)) throw new Error('实际时间无效。'); r.root.clockSeconds += seconds; r.root.externalSeconds += seconds;
  for (const key of ['ward', 'attention', 'reciprocal', 'arrangement'] as const) if (r.windows[key] && r.windows[key]!.expiresAt <= r.root.clockSeconds) {
    r.expiredWindows.push(structuredClone(r.windows[key]!)); r.windows[key] = null;
  }
}
export function declareWriterEnemyAction(x: WriterCombatSource, r: WriterRuntime, planned: WriterEnemyIntent, index: number): WriterPendingAction {
  if (r.pendingEnemyAction || !WRITER_ENEMY_ABILITY_WHEEL.some(a => a.id === planned) || r.body.enemyMind <= 0) throw new Error('不能覆盖待执行动作或替已停战者安排动作。');
  const power = WRITER_POWERS.find(p => p.id === planned);
  const actual = power && r.body.enemySpirituality < power.cost ? 'BODY_STRIKE' : planned === 'WARD' && r.windows.ward || planned === 'ATTENTION' && r.windows.attention ? 'OBSERVE' : planned;
  const visibleIntent = actual === 'BODY_STRIKE' ? '握紧自己的原杖，准备普通打击' : actual === 'MIND_PULSE' ? '集中精神准备有限心灵冲击' : actual === 'WARD' ? '抬手准备一次精神护持' : actual === 'ATTENTION' ? '收束注意，准备抵抗精神接触' : actual === 'OBSERVE' ? '观察眼前站位' : '当前动作出现判断偏差';
  r.pendingEnemyAction = { id: `${x.runId}:WR1-PENDING:${x.round}:${index}`, planned, actual, declaredAt: r.root.clockSeconds, visibleIntent }; return structuredClone(r.pendingEnemyAction);
}
function baseAction(r: WriterRuntime, actor: 'PLAYER' | 'ENEMY', id: string, order: number, random: ActionRandomStream): WriterActionEvidence {
  return { actor, id, planned: id, selectedAbility: id, fallbackReason: null, order, mode: 'OBSERVE', label: '', selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false,
    attackKind: 'NONE', rawContribution: 0, rawReduction: 0, paidCost: 0, mindCost: 0, physicalFactor: physicalAt(actor === 'PLAYER' ? r.playerH : r.body.enemyHealth), check: null,
    resistanceRoll: null, resistanceChance: null, succeeded: false, mindDamage: 0, wardAbsorption: 0, playerObservationGain: 0, finiteResult: 'NONE', windowsBefore: structuredClone(r.windows), windowsAfter: structuredClone(r.windows),
    pendingBefore: structuredClone(r.pendingEnemyAction), pendingAfter: null, countered: [], masteryApplied: [], identityCreated: false, identityRejoined: true,
    knownPlayerName: r.root.knownPlayerName, learnedClue: null, atSeconds: r.root.clockSeconds, elapsedSeconds: 5, travelMetres: 0, randomCursorBefore: random.cursor, randomCursorAfter: random.cursor,
    playerHealthAfter: r.playerH, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, enemyMindAfter: r.body.enemyMind, enemySpiritualityAfter: r.body.enemySpirituality };
}
function closeAction(a: WriterActionEvidence, r: WriterRuntime, random: ActionRandomStream): WriterActionEvidence {
  advanceWriterCombatClock(r, 5); a.windowsAfter = structuredClone(r.windows); a.pendingAfter = structuredClone(r.pendingEnemyAction); a.randomCursorAfter = random.cursor;
  a.playerHealthAfter = r.playerH; a.playerMindAfter = r.playerM; a.playerSpiritualityAfter = r.playerS; a.enemyMindAfter = r.body.enemyMind; a.enemySpiritualityAfter = r.body.enemySpirituality;
  a.label += ` 实际用时5秒；本人灵性${r.playerS}、精神${r.playerM}，卢西安灵性${r.body.enemySpirituality}、精神${r.body.enemyMind}。`; return a;
}
function ordinary(x: WriterCombatSource, r: WriterRuntime, a: WriterActionEvidence, why: string, attack = false): void {
  a.selectedAbility = attack ? 'STRIKE' : 'BLOCK'; a.mode = attack ? 'BODY' : 'GUARD'; a.fallbackReason = why;
  if (attack) { a.selfGain = (x.clubHeld ? 16 : 12) * a.physicalFactor; a.attackKind = 'BODY'; a.threatens = true; a.travelMetres = 4; r.root.playerTravelMetres += 4; }
  else a.enemyReduction = 10 * a.physicalFactor;
  a.label = `${why}本槽仅${attack ? '用本人原身体及实际在手原物，近前2米普通打击，再退回2米' : '本人普通防备'}，不施放、不扣施法成本、不重抽。`;
}
function pay(r: WriterRuntime, a: WriterActionEvidence, spirit: number, mind = 0): boolean {
  if (r.playerS < spirit || r.playerM <= mind) return false; r.playerS -= spirit; r.playerM -= mind; r.body.totalOwnerMindSpent += mind; a.paidCost = spirit; a.mindCost = mind; return true;
}
function check(x: WriterCombatSource, a: WriterActionEvidence, ability: 'will' | 'perception', difficulty: number, random: ActionRandomStream): boolean {
  a.check = resolveNormalCheck({ ability, baseAbility: x[ability], difficulty, modifiers: [], roll: random.nextInt(1, 100) });
  a.succeeded = ['SUCCESS', 'GREAT_SUCCESS'].includes(a.check.tier); return a.succeeded;
}
function resist(r: WriterRuntime, a: WriterActionEvidence, random: ActionRandomStream): boolean {
  const attention = r.windows.attention, ward = r.windows.ward;
  a.resistanceChance = Math.max(30, attention?.magnitude ?? 0, ward ? 70 : 0); a.resistanceRoll = random.nextInt(1, 100);
  if (attention) { a.countered.push(attention.id); r.windows.attention = null; }
  if (ward) { a.countered.push(ward.id); a.wardAbsorption = ward.magnitude; r.windows.ward = null; }
  if (a.resistanceRoll <= a.resistanceChance) {
    a.succeeded = false; a.finiteResult = 'RESISTED';
    a.label += `对方以${a.resistanceChance}%抵抗，实掷${a.resistanceRoll}，拒绝本次接触；已付灵性精神不退。`; return false;
  }
  a.label += `对方抵抗${a.resistanceRoll}>${a.resistanceChance}，本次有限接触成立。`; return true;
}
function gainMastery(r: WriterRuntime, a: WriterActionEvidence, id: typeof WRITER_NEW_ABILITY_IDS[number]): void {
  r.mastery[id] = Math.min(500, r.mastery[id]! + 8); a.masteryApplied.push(id);
}
function newWindow(x: WriterCombatSource, r: WriterRuntime, a: WriterActionEvidence, kind: WriterWindow['kind'], magnitude: number, targetActionId: string | null): WriterWindow {
  return { id: `${x.runId}:WR1-${kind}:${x.round}:${a.order}`, kind, createdAt: r.root.clockSeconds, expiresAt: r.root.clockSeconds + 30, targetActionId, magnitude };
}
function mentalAttack(r: WriterRuntime, a: WriterActionEvidence, contribution: number, damage = 0): void {
  a.mode = 'MENTAL'; a.attackKind = 'MENTAL'; a.rawContribution = contribution; a.selfGain = contribution;
  if (r.windows.ward) { a.wardAbsorption = r.windows.ward.magnitude; a.countered.push(r.windows.ward.id); r.windows.ward = null; }
  if (a.wardAbsorption > 0) { a.selfGain = Math.max(0, a.selfGain - a.wardAbsorption); a.label += `此前实付的护持仅抵挡这次精神作用，贡献最多减少${a.wardAbsorption}，余${a.selfGain}。`; }
  a.mindDamage = a.selfGain > 0 ? Math.min(damage, r.body.enemyMind) : 0; r.body.enemyMind -= a.mindDamage;
  a.mentalPressure = a.selfGain > 0 || a.mindDamage > 0; if (r.body.enemyMind === 0) r.body.enemyStatus = 'SURRENDERED';
}
/** Original learned zero-mastery abilities remain learned. Every supernatural
 * attempt spends actual finite resources; no old identity or object is imported. */
export function resolveWriterPlayerSlot(x: WriterCombatSource, r: WriterRuntime, id: WriterMoveId, order: number, random: ActionRandomStream): WriterActionEvidence {
  if (!WRITER_ABILITIES.some(a => a.id === id)) throw new Error('作家行动无效。'); const a = baseAction(r, 'PLAYER', id, order, random), factor = 1 + (x.mastery[id] ?? 0) / 500;
  if (id.startsWith('audience.') && !Object.hasOwn(x.mastery, id)) ordinary(x, r, a, '没有实际学会这项能力。');
  else if (id === 'ACCIDENT') { a.mode = 'ACCIDENT'; a.selfGain = -22.5; a.label = '判断失衡，固定贡献−22.5。'; }
  else if (id === 'STRIKE') ordinary(x, r, a, '', true);
  else if (id === 'BLOCK' || id === 'EVADE') { a.mode = 'GUARD'; a.enemyReduction = (id === 'BLOCK' ? 10 : 18) * a.physicalFactor; a.label = '本人实际防备或避让，有限降低对方优势。'; }
  else if (id === 'OBSERVE') a.label = '普通观察眼前持杖成人与开放出口，不读取未知秘密。';
  else if (['audience.observation', 'audience.behavior-analysis', 'audience.memory-deduction'].includes(id)) {
    a.selfGain = id === 'audience.observation' ? 8 : id === 'audience.memory-deduction' && x.round === 1 ? 0 : 6;
    a.label = id === 'audience.memory-deduction' && x.round === 1 ? '尚无本场已经亲历的上一轮动作，推理不提供优势。' : '依据眼前原身体的实际站位与本场已见动作作有限分析，不预知下一步。';
  } else if (['audience.s7.soothe', 'audience.s7.mental-communication', 'audience.s6.hypnosis', 'audience.s6.psychological-invisibility', 'audience.s5.dream-guidance', 'audience.s5.dream-modification', 'audience.s5.dream-travel'].includes(id)) {
    ordinary(x, r, a, '眼前对手清醒并正面注意你，没有自愿安静会谈、可用原梦境或隐蔽通路。');
  } else if (id === RECIPROCAL_INSIGHT || id === PLAUSIBLE_ARRANGEMENT) {
    const reciprocal = id === RECIPROCAL_INSIGHT, flag = reciprocal ? 'reciprocalAttempted' : 'arrangementAttempted';
    const pending = r.pendingEnemyAction, authorized = x.policy === 'BOTH' || x.policy === (reciprocal ? 'RECIPROCAL_INSIGHT' : 'PLAUSIBLE_ARRANGEMENT');
    if (!authorized || !r.root.knownPlayerName || r.root.knownPlayerName !== x.preparation.playerName || r.root.knownEnemyName !== '卢西安·维尔' || !pending || ['OBSERVE', 'ACCIDENT'].includes(pending.actual)) {
      a.finiteResult = 'UNAVAILABLE'; ordinary(x, r, a, '未允许此能力、没有真实互报姓名，或没有尚未执行且可影响的可见动作。');
    } else if (r[flag]) { a.finiteResult = 'ALREADY_ATTEMPTED'; ordinary(x, r, a, '本轮已尝试该能力，不能为成功重试。'); }
    else if (r.playerS < (reciprocal ? 6 : 8) || r.playerM <= (reciprocal ? 2 : 3)) { a.finiteResult = 'INSUFFICIENT'; ordinary(x, r, a, '当前实际灵性或精神不足。'); }
    else {
      r[flag] = true; pay(r, a, reciprocal ? 6 : 8, reciprocal ? 2 : 3); if (reciprocal) r.body.reciprocalAttempts++; else r.body.arrangementAttempts++;
      a.mode = reciprocal ? 'RECIPROCAL_INSIGHT' : 'PLAUSIBLE_ARRANGEMENT'; a.label = `${reciprocal ? '互知线索' : '合理安排'}已实付${a.paidCost}灵性${a.mindCost}精神；`;
      if (!check(x, a, 'will', reciprocal ? 18 : 20, random)) { a.finiteResult = 'FAILED'; a.label += `意志检定${a.check!.roll}/${a.check!.chance}失败，没有线索或安排，费用不退。`; }
      else if (resist(r, a, random)) {
        const key = reciprocal ? 'reciprocal' : 'arrangement'; r.windows[key] = newWindow(x, r, a, reciprocal ? 'RECIPROCAL' : 'ARRANGEMENT', reciprocal ? 36 : 40, pending.id);
        a.finiteResult = 'PENDING'; a.learnedClue = reciprocal ? pending.visibleIntent : null;
        a.label += reciprocal ? `只辨认他此刻已有的意图：“${pending.visibleIntent}”。须该动作随后实际执行才取得一次36优势。` : `只对“${pending.visibleIntent}”这项尚未执行的动作形成30秒安排，随后实际作用最多40；未执行不产生减势，不能倒改已完成动作。`;
      }
    }
  } else if (id === 'audience.s6.scales' || id === 'audience.s4.virtual-persona') {
    const persona = id === 'audience.s4.virtual-persona';
    if (!pay(r, a, persona ? 3 : 2, persona ? 1 : 0)) ordinary(x, r, a, '实际灵性或精神不足，防护没有施展。');
    else { a.mode = 'GUARD'; a.succeeded = true; a.enemyReduction = persona ? 24 : 14 * factor; if (persona) r.body.personaGuards++; a.label = persona ? '本人有限防守人格实付3灵性1精神，只减势24，动作后归并。' : '继承鳞片实付2灵性，只提供有限防护，不修复既有伤势。'; }
  } else if (id === 'audience.s3.external-identity') {
    if (!pay(r, a, 5, 2)) ordinary(x, r, a, '没有可支付的5灵性2精神，未产生身份。');
    else { r.body.identityUses++; a.mode = 'IDENTITY'; if (check(x, a, 'will', 16, random)) { a.identityCreated = true; a.enemyReduction = 26; }
      a.label = `本人实付5灵性2精神，意志${a.check!.roll}/${a.check!.chance}；${a.identityCreated ? '仅从本人当次形成一具6米内短暂身份，牵制26，本动作结束归并' : '未形成身份'}。不调用旧身份，不复制原物、资源、身体生命或额外行动。`; }
  } else if (id === 'audience.s4.mental-plague' && r.body.plagueApplications > 0) { a.label = '该原人已经实际播种过一次精神瘟疫；不重复收费或刷新，已有病况保留。'; }
  else {
    const imprint = id === 'audience.s2.mental-imprint', insight = id === 'audience.s2.insight-window';
    const flag = imprint ? 'imprintAttempted' : 'insightAttempted';
    const cost = imprint ? 6 : insight ? 5 : id === 'audience.s3.woven-image' ? 6 : id === 'audience.mind-reading' ? 1 : ['audience.s7.awe', 'audience.s7.suggestion'].includes(id) ? 2 : ['audience.s7.frenzy', 'audience.s6.combat-hypnosis'].includes(id) ? 3 : 4;
    const mind = imprint ? 2 : insight ? 1 : 0;
    if ((imprint || insight) && r[flag]) { a.finiteResult = 'ALREADY_ATTEMPTED'; ordinary(x, r, a, '本轮这项继承有限能力已尝试一次。'); }
    else if (!pay(r, a, cost, mind)) { a.finiteResult = 'INSUFFICIENT'; ordinary(x, r, a, '实际灵性或精神不足，继承能力没有施展。', true); }
    else {
      if (imprint || insight) { r[flag] = true; if (imprint) r.body.mentalImprintUses++; else r.body.insightWindowUses++; }
      if (id === 'audience.s3.woven-image') r.body.wovenImageUses++;
      const difficulty = id === 'audience.mind-reading' ? 12 : ['audience.s7.awe', 'audience.s7.suggestion', 'audience.s6.combat-hypnosis', 'audience.s7.frenzy'].includes(id) ? 14 : id === 'audience.s4.mind-island' ? 16 : 18;
      a.label = `继承能力实付${cost}灵性${mind ? `与${mind}精神` : ''}；`;
      if (!check(x, a, id === 'audience.mind-reading' ? 'perception' : 'will', difficulty, random)) { a.finiteResult = 'FAILED'; a.label += `检定${a.check!.roll}/${a.check!.chance}失败，成本不退。`; }
      else if ([ 'audience.s2.mental-imprint', 'audience.s2.insight-window', 'audience.s3.woven-image', 'audience.s6.combat-hypnosis', 'audience.mind-reading' ].includes(id) && !resist(r, a, random)) { /* Paid resisted attempt. */ }
      else {
        a.finiteResult = 'APPLIED';
        if (imprint) { r.body.mentalImprintSuccesses++; a.enemyReduction = 30; a.label += '当下有限心灵印记牵制减势30，动作结束，不读取隐藏记忆。'; }
        else if (insight) { r.body.insightWindowSuccesses++; a.selfGain = 42 * factor; a.label += '本动作取得有限观察优势，不预知未来或产生身体伤害。'; }
        else if (id === 'audience.mind-reading') { a.selfGain = 10; a.learnedClue = '他此刻想守住原杖前方的空间'; a.label += '仅辨明他当下想守住原杖前方空间，观察优势10。'; }
        else if (id === 'audience.s4.mental-plague') { r.body.mentalPlague = 1; r.body.plagueApplications = 1; r.body.infectedRound = x.round; r.body.lastPlagueRound = x.round; a.label += '只给同一卢西安播种病势1；后续真实回合精神减少4、8、12，离场不自动治愈。'; }
        else if (id === 'audience.s3.woven-image') { mentalAttack(r, a, 38 * factor, 6); a.label += `本次近真梦像被相信，真实精神减少${a.mindDamage}，没有实体生成或物理伤口。`; }
        else if (id === 'audience.s4.mind-island') { mentalAttack(r, a, 42 * factor, 8); a.label += `有限心灵岛屿接触，精神实际减少${a.mindDamage}；已经退出，不得全知供词或永久控制。`; }
        else if (id === 'audience.s6.combat-hypnosis') { a.enemyReduction = 18 * factor; a.label += '短暂精神干扰，只减势18×掌握，不命令自伤或永久服从。'; }
        else if (id === 'audience.s7.awe' || id === 'audience.s7.suggestion') { a.enemyReduction = id === 'audience.s7.awe' ? 22 : 18; a.label += '只形成有限迟疑减势，不取消动作或强迫服从。'; }
        else { mentalAttack(r, a, 28); a.label += '只形成有限精神压力，不视作原身体打击。'; }
      }
    }
  }
  if (a.rawContribution === 0) a.rawContribution = a.selfGain; a.rawReduction = a.enemyReduction; return closeAction(a, r, random);
}
export function resolveWriterEnemySlot(x: WriterCombatSource, r: WriterRuntime, planned: WriterEnemyIntent, order: number, random: ActionRandomStream): WriterActionEvidence {
  if (!WRITER_ENEMY_ABILITY_WHEEL.some(a => a.id === planned)) throw new Error('对手行动无效。');
  if (!r.pendingEnemyAction) declareWriterEnemyAction(x, r, planned, order);
  const pending = r.pendingEnemyAction!; if (pending.planned !== planned) throw new Error('不能更换已经可见的待执行动作。');
  const a = baseAction(r, 'ENEMY', planned, order, random), power = WRITER_POWERS.find(p => p.id === pending.actual);
  a.selectedAbility = a.id = pending.actual; a.mode = pending.actual;
  if (power && r.body.enemySpirituality >= power.cost) {
    a.paidCost = power.cost; r.body.enemySpirituality -= power.cost; r.body.powerUses[power.id]++;
    if (power.id === 'MIND_PULSE') { a.selfGain = 95; a.attackKind = 'MENTAL'; a.mentalPressure = true; a.label = '卢西安实付7灵性，执行已经显露的有限心灵冲击，精神贡献95。'; }
    else if (power.id === 'WARD') { r.windows.ward = newWindow(x, r, a, 'WARD', 60, null); a.label = '卢西安实付6灵性形成30秒单次精神护持；后来一次精神贡献最多减60，也能抵抗一次接触，不抵挡原身体打击。'; }
    else { r.windows.attention = newWindow(x, r, a, 'ATTENTION', 70, null); a.label = '卢西安实付3灵性集中注意；30秒内下一次实际精神接触抵抗提高到70%，用后或到时结束。'; }
  } else if (pending.actual === 'OBSERVE') a.label = '卢西安普通观察眼前动作；不补充灵性或叠加已有护持。';
  else if (pending.actual === 'ACCIDENT') { a.selfGain = -22.5; a.label = '卢西安本动作判断偏差，贡献−22.5。'; }
  else { a.id = a.selectedAbility = 'BODY_STRIKE'; a.mode = 'BODY'; a.attackKind = 'BODY'; a.threatens = true; a.selfGain = 22 * a.physicalFactor; a.travelMetres = 4;
    a.fallbackReason = planned === 'BODY_STRIKE' ? null : '独立灵性不足，无法施法。'; a.label = '卢西安使用自己唯一原杖，实际近前2米打击再退回2米；不复制武器，不重抽或补灵性。'; }
  a.rawContribution = a.selfGain; a.rawReduction = a.enemyReduction;
  const arrangement = r.windows.arrangement;
  if (arrangement && arrangement.targetActionId === pending.id && arrangement.expiresAt > r.root.clockSeconds) {
    let applied = 0;
    if (a.selfGain > 0) { applied = Math.min(arrangement.magnitude, a.selfGain); a.selfGain -= applied; }
    else if (a.mode === 'WARD' && r.windows.ward) { applied = Math.min(40, r.windows.ward.magnitude); r.windows.ward.magnitude -= applied; }
    else if (a.mode === 'ATTENTION' && r.windows.attention) { applied = Math.min(30, r.windows.attention.magnitude - 30); r.windows.attention.magnitude -= applied; }
    r.windows.arrangement = null; a.countered.push(arrangement.id);
    if (applied > 0) { r.body.arrangementSuccesses++; gainMastery(r, a, PLAUSIBLE_ARRANGEMENT); a.label += `此前已经付费的合理安排仅在本动作执行时生效${applied}，消耗后结束；余下动作不受益。`; }
    else a.label += '此前安排未对这项普通动作产生实际影响，无掌握或减势奖励。';
  }
  const reciprocal = r.windows.reciprocal;
  if (reciprocal && reciprocal.targetActionId === pending.id && reciprocal.expiresAt > r.root.clockSeconds) {
    a.playerObservationGain = reciprocal.magnitude; r.body.reciprocalSuccesses++; gainMastery(r, a, RECIPROCAL_INSIGHT); a.countered.push(reciprocal.id); r.windows.reciprocal = null;
    a.label += `此前互知线索与这项真实执行动作相符，本人取得一次36观察优势；此窗口已经用尽，不能免除原身体打击。`;
  }
  a.threatens = a.attackKind === 'BODY' && a.selfGain > 0;
  a.mentalPressure = a.attackKind === 'MENTAL' && a.selfGain > 0;
  r.pendingEnemyAction = null; return closeAction(a, r, random);
}

export interface WriterRoundOutcome extends WriterCombatBody {
  targetId: typeof WRITER_TARGET_ID; round: number; source: WriterCombatSource; stance: SliceStance; continuing: boolean;
  playerHealthAfter: number; playerMindAfter: number; playerSpiritualityAfter: number; playerInjuriesAfter: SliceInjury[]; playerRiskAfter: number; materialsAfter: WriterMaterials; masteryAfter: Record<string, number>;
  rootAfter: WriterScene; elapsedSeconds: 60; randomCursorAfter: number; playerActions: WriterActionEvidence[]; enemyActions: WriterActionEvidence[];
  expiredWindows: WriterWindow[]; windowsAfter: WriterWindows; pendingEnemyActionAfter: null; plagueMindDamage: number;
}
export type WriterResolution = 'CONTINUE' | 'PLAYER_DEAD' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED' | 'RETREATED';
function penalty(n: number, max: number) { const f = n / max; return f > .75 ? 0 : f > .5 ? .05 : f > .25 ? .1 : .2; }
function base(core: number, h: number, m: number, s: number) { return (1250 + Math.min(core, 250)) * (1 - Math.min(.4, penalty(h, 100) + penalty(m, 100) + penalty(s, 120))); }
function weights(risk: number) { const death = Math.min(100, 5 + Math.min(risk, 10) * 10), shifted = death - 5; return { light: Math.max(0, 65 - shifted), heavy: Math.max(0, 30 - Math.max(0, shifted - 65)), death }; }
export function validWriterBody(b: WriterCombatBody): boolean {
  return integer(b.enemyHealth, 0, 100) && integer(b.enemyMind, 0, 100) && integer(b.enemySpirituality, 0, 120) && integer(b.enemyRisk) && Array.isArray(b.enemyInjuries) &&
    ['RESISTING', 'SURRENDERED', 'DEAD'].includes(b.enemyStatus) && (b.enemyStatus === 'DEAD') === (b.enemyHealth === 0) && (b.enemyMind > 0 || b.enemyStatus !== 'RESISTING') && ['HAND', 'COURT'].includes(b.weaponLocation) && (b.enemyStatus === 'RESISTING' || b.weaponLocation === 'COURT') &&
    shape(b.powerUses, WRITER_POWER_IDS) && WRITER_POWER_IDS.every(id => integer(b.powerUses[id])) && b.enemySpirituality === 120 - WRITER_POWERS.reduce((n, p) => n + p.cost * b.powerUses[p.id], 0) &&
    integer(b.mentalPlague, 0, 3) && integer(b.plagueApplications, 0, 1) && (b.plagueApplications === 0 ? b.mentalPlague === 0 && b.infectedRound === null && b.lastPlagueRound === null : b.mentalPlague > 0 && integer(b.infectedRound, 1) && integer(b.lastPlagueRound, b.infectedRound)) &&
    ['personaGuards', 'identityUses', 'wovenImageUses', 'totalOwnerMindSpent', 'mentalImprintUses', 'insightWindowUses', 'reciprocalAttempts', 'arrangementAttempts'].every(k => integer(b[k as keyof WriterCombatBody])) &&
    integer(b.mentalImprintSuccesses, 0, b.mentalImprintUses) && integer(b.insightWindowSuccesses, 0, b.insightWindowUses) && integer(b.reciprocalSuccesses, 0, b.reciprocalAttempts) && integer(b.arrangementSuccesses, 0, b.arrangementAttempts);
}
export function validWriterInjuries(injuries: SliceInjury[], revision: number): boolean {
  return Array.isArray(injuries) && new Set(injuries.map(i => i.id)).size === injuries.length && injuries.every(i => shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) && typeof i.id === 'string' && !!i.id && ['LIGHT', 'HEAVY'].includes(i.severity) && integer(i.acquiredRevision, 0, revision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision, revision)));
}
const SOURCE_KEYS = ['runId', 'revision', 'week', 'date', 'round', 'encounterId', 'targetId', 'attemptWeek', 'startHistoryIndex', 'targetName', 'targetAge', 'targetPathway', 'targetSequence', 'targetCore',
  'actualBody', 'independentMind', 'automaticTrueGod', 'playerBodyId', 'enemyWeapon', 'weaponOwner', 'ordinaryExit', 'pursuit', 'thirdPartiesInArea', 'automaticAllyImmunity', 'freeSkillLibrary', 'policy', 'clubHeld',
  'playerHealth', 'playerMind', 'playerSpirituality', 'playerInjuries', 'playerRisk', 'physique', 'perception', 'will', 'knowledge', 'mastery', 'preparation', 'root', 'materials', 'body', 'randomSeed', 'randomCursor'];
export function validWriterCombatSource(x: WriterCombatSource): boolean {
  try { const p = x.root, prep = x.preparation;
    return shape(x, SOURCE_KEYS) && shape(x.body, Object.keys(initialWriterBody())) && validateWriterPreparation(prep) && typeof x.runId === 'string' && !!x.runId && integer(x.revision) &&
      x.week === prep.week && isValidGameDate(x.date) && same(x.date, prep.date) && integer(x.round, 1) && integer(x.startHistoryIndex) && x.attemptWeek === x.week && x.encounterId === 'WRITER_DISPUTE' && x.targetId === WRITER_TARGET_ID &&
      x.targetName === '卢西安·维尔' && x.targetAge === 46 && x.targetPathway === 'original-caster' && x.targetSequence === 1 && x.targetCore === 22 &&
      x.actualBody === true && x.independentMind === true && x.automaticTrueGod === false && x.playerBodyId === `${x.runId}:body` && x.enemyWeapon === 'WR1-LUCIAN-ROD' && x.weaponOwner === WRITER_TARGET_ID &&
      x.ordinaryExit === 'OPEN' && x.pursuit === false && x.thirdPartiesInArea === 0 && x.automaticAllyImmunity === false && x.freeSkillLibrary === false && ['HOLD', 'RECIPROCAL_INSIGHT', 'PLAUSIBLE_ARRANGEMENT', 'BOTH'].includes(x.policy) && typeof x.clubHeld === 'boolean' && x.clubHeld === prep.playerClubHeld &&
      [x.playerHealth, x.playerMind].every(n => integer(n, 1, 100)) && integer(x.playerSpirituality, 0, 120) && [x.physique, x.perception, x.will, x.knowledge].every(n => integer(n, 0, 500)) &&
      same({ physique: x.physique, perception: x.perception, will: x.will, knowledge: x.knowledge }, prep.after.coreStats) &&
      !!x.mastery && typeof x.mastery === 'object' && !Array.isArray(x.mastery) && same(Object.keys(x.mastery).sort(), Object.keys(prep.after.mastery).sort()) && Object.values(x.mastery).every(n => integer(n, 0, 500)) &&
      [...WRITER_INHERITED_SKILL_IDS, ...WRITER_NEW_ABILITY_IDS].every(id => Object.hasOwn(x.mastery, id)) &&
      Object.entries(prep.after.mastery).every(([id, value]) => (WRITER_NEW_ABILITY_IDS as readonly string[]).includes(id) ? x.mastery[id]! >= value : x.mastery[id] === value) &&
      integer(x.playerRisk) && validWriterInjuries(x.playerInjuries, x.revision) && validWriterInjuries(x.body.enemyInjuries, x.revision) && validWriterMaterials(x.materials) && x.materials.weapon.location === x.body.weaponLocation &&
      validWriterScene(p) && p.siteId === WRITER_SITE && p.playerLocation === 'COURT' && p.observedSourceId === `${x.runId}:WR1-COURT:${prep.revision}` && p.observationWeek === prep.week &&
      p.knownPlayerName === prep.playerName && p.knownEnemyName === '卢西安·维尔' && p.clockSeconds === 6 + 60 * (x.round - 1) &&
      validWriterBody(x.body) && x.body.enemyStatus === 'RESISTING' && x.body.enemyMind > 0 && typeof x.randomSeed === 'string' && !!x.randomSeed && integer(x.randomCursor) &&
      prep.runId === x.runId && prep.randomSeed === x.randomSeed && prep.randomCursor <= x.randomCursor && prep.revision <= x.revision - x.round;
  } catch { return false; }
}
export function replayWriterCombatRound(x: WriterCombatSource, stance: SliceStance): { round: SliceCombatRound; outcome: WriterResolution } {
  if (!validWriterCombatSource(x) || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new Error('缺少真实原来源。');
  const rng = new DeterministicActionRandomStream(x.randomSeed, x.randomCursor), r = createWriterRuntime(x), b = r.body;
  const playerCountRoll = rng.nextInt(1, 100), enemyCountRoll = rng.nextInt(1, 100), playerCount = writerActionCount(playerCountRoll), enemyCount = writerEnemyActionCount(enemyCountRoll);
  const first = x.round % 2 === 1 ? 'PLAYER' : 'ENEMY', order = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const;
  const players: WriterActionEvidence[] = [], enemies: WriterActionEvidence[] = [], remaining = { PLAYER: playerCount, ENEMY: enemyCount }; let retreat: SliceCombatRound['retreat'] = 'NONE';
  if (b.enemyMind === 0) remaining.PLAYER = remaining.ENEMY = 0;
  while (remaining.PLAYER > 0 || remaining.ENEMY > 0) for (const actor of order) {
    if (!remaining[actor]) continue;
    if (actor === 'PLAYER' && stance === 'RETREAT') { remaining.PLAYER = 0; retreat = rng.nextInt(1, 100) <= 50 ? 'SUCCESS' : 'FAILURE'; if (retreat === 'SUCCESS') { remaining.ENEMY = 0; break; } continue; }
    if (remaining.ENEMY > 0 && !r.pendingEnemyAction) declareWriterEnemyAction(x, r, drawWriterEnemyAbility(rng), enemies.length);
    remaining[actor]--; const index = players.length + enemies.length;
    if (actor === 'PLAYER') players.push(resolveWriterPlayerSlot(x, r, drawWriterAbility(rng, null, stance), index, rng));
    else enemies.push(resolveWriterEnemySlot(x, r, r.pendingEnemyAction!.planned, index, rng));
    if (b.enemyMind === 0) { b.enemyStatus = 'SURRENDERED'; remaining.PLAYER = remaining.ENEMY = 0; break; }
  }
  const sum = (a: WriterActionEvidence[], key: 'selfGain' | 'enemyReduction') => a.reduce((n, v) => n + v[key], 0);
  const core = x.physique * .30 + x.perception * .25 + x.will * .30 + x.knowledge * .15;
  const playerAdvantage = Math.max(125, base(core, x.playerHealth, x.playerMind, x.playerSpirituality) + sum(players, 'selfGain') + enemies.reduce((n, a) => n + a.playerObservationGain, 0) - sum(enemies, 'enemyReduction'));
  const enemyAdvantage = Math.max(125, base(x.targetCore, x.body.enemyHealth, x.body.enemyMind, x.body.enemySpirituality) + sum(enemies, 'selfGain') - sum(players, 'enemyReduction'));
  const winChance = playerAdvantage / (playerAdvantage + enemyAdvantage) * 100, winner = retreat === 'SUCCESS' ? 'ENEMY' : b.enemyMind === 0 ? 'PLAYER' : rng.nextInt(1, 1_000_000) <= winChance * 10_000 ? 'PLAYER' : 'ENEMY';
  let playerHealth = r.playerH, playerRisk = x.playerRisk, outcome: WriterResolution = retreat === 'SUCCESS' ? 'RETREATED' : b.enemyMind === 0 ? 'ENEMY_SURRENDERED' : 'CONTINUE';
  const playerInjuries = structuredClone(x.playerInjuries); let consequenceWeights: SliceCombatRound['consequenceWeights'] = null, consequenceRoll: number | undefined, consequenceDomain: SliceCombatRound['consequenceDomain'];
  if (retreat !== 'SUCCESS' && b.enemyMind > 0) {
    const loser = winner === 'PLAYER' ? 'ENEMY' : 'PLAYER', attacks = loser === 'PLAYER' ? enemies : players, injuries = loser === 'PLAYER' ? playerInjuries : b.enemyInjuries;
    if (attacks.some(a => a.threatens && a.attackKind === 'BODY')) {
      let risk = loser === 'PLAYER' ? playerRisk : b.enemyRisk; if (injuries.length) risk++; if (loser === 'PLAYER') playerRisk = risk; else b.enemyRisk = risk;
      consequenceDomain = 'BODY'; consequenceWeights = weights(risk); consequenceRoll = rng.nextInt(1, 100);
      const severity = consequenceRoll <= consequenceWeights.light ? 'LIGHT' : consequenceRoll <= consequenceWeights.light + consequenceWeights.heavy ? 'HEAVY' : 'DEATH';
      if (severity === 'DEATH') { if (loser === 'PLAYER') playerHealth = 0; else { b.enemyHealth = 0; b.enemyStatus = 'DEAD'; } }
      else { injuries.push({ id: `${x.runId}:combat:${x.round}:${loser}:${x.revision + 1}:${injuries.length}`, severity, acquiredRevision: x.revision + 1, treatedRevision: null });
        const damage = severity === 'LIGHT' ? 10 : 30; if (loser === 'PLAYER') playerHealth = Math.max(0, playerHealth - damage); else b.enemyHealth = Math.max(0, b.enemyHealth - damage);
        if (b.enemyHealth === 0) b.enemyStatus = 'DEAD'; else if (loser === 'ENEMY' && severity === 'HEAVY') b.enemyStatus = 'SURRENDERED'; }
    } else if (attacks.some(a => a.mentalPressure)) {
      consequenceDomain = 'MENTAL'; if (loser === 'PLAYER') r.playerM = Math.max(0, r.playerM - 10); else { b.enemyMind = Math.max(0, b.enemyMind - 10); if (b.enemyMind === 0) b.enemyStatus = 'SURRENDERED'; }
    }
    if (playerHealth === 0) outcome = 'PLAYER_DEAD'; else if (b.enemyHealth === 0) outcome = 'ENEMY_DEAD'; else if (b.enemyStatus === 'SURRENDERED') outcome = 'ENEMY_SURRENDERED';
  }
  if (outcome === 'CONTINUE' && r.playerM === 0) outcome = 'RETREATED';
  advanceWriterCombatClock(r, x.root.clockSeconds + 60 - r.root.clockSeconds);
  for (const key of ['ward', 'attention', 'reciprocal', 'arrangement'] as const) { if (r.windows[key]) r.expiredWindows.push(structuredClone(r.windows[key]!)); r.windows[key] = null; }
  r.pendingEnemyAction = null; if (b.enemyStatus !== 'RESISTING') r.materials.weapon.location = 'COURT'; b.weaponLocation = r.materials.weapon.location;
  const o: WriterRoundOutcome = { ...structuredClone(b), targetId: WRITER_TARGET_ID, round: x.round, source: structuredClone(x), stance, continuing: outcome === 'CONTINUE',
    playerHealthAfter: playerHealth, playerMindAfter: r.playerM, playerSpiritualityAfter: r.playerS, playerInjuriesAfter: playerInjuries, playerRiskAfter: playerRisk, materialsAfter: structuredClone(r.materials), masteryAfter: { ...r.mastery },
    rootAfter: structuredClone(r.root), elapsedSeconds: 60, randomCursorAfter: rng.cursor, playerActions: players, enemyActions: enemies, expiredWindows: r.expiredWindows,
    windowsAfter: structuredClone(r.windows), pendingEnemyActionAfter: null, plagueMindDamage: r.plagueMindDamage };
  const round: SliceCombatRound = { round: x.round, stance, first, playerCount, enemyCount, playerCountRoll, enemyCountRoll,
    moves: [...players, ...enemies].sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction })),
    playerAdvantage, enemyAdvantage, winChance, winner, consequence: '', consequenceWeights, retreat, ...(consequenceDomain === undefined ? {} : { consequenceDomain }), ...(consequenceRoll === undefined ? {} : { consequenceRoll }), writerOutcome: o };
  round.consequence = writerCombatConsequence(round); return { round, outcome };
}
export function validateWriterRoundOutcome(v: unknown): v is WriterRoundOutcome { try { const o = v as WriterRoundOutcome; return !!o && same(o, replayWriterCombatRound(o.source, o.stance).round.writerOutcome); } catch { return false; } }
export function validateWriterCombatRound(round: SliceCombatRound): boolean { try { const o = round.writerOutcome; return !!o && same(round, replayWriterCombatRound(o.source, o.stance).round); } catch { return false; } }
export function nextWriterCombatSource(o: WriterRoundOutcome): WriterCombatSource {
  return { ...structuredClone(o.source), revision: o.source.revision + 1, round: o.round + 1, playerHealth: o.playerHealthAfter, playerMind: o.playerMindAfter,
    playerSpirituality: Math.min(120, o.playerSpiritualityAfter + 12), playerInjuries: structuredClone(o.playerInjuriesAfter), playerRisk: o.playerRiskAfter,
    root: structuredClone(o.rootAfter), body: combatBody(o), materials: structuredClone(o.materialsAfter), mastery: { ...o.masteryAfter }, randomCursor: o.randomCursorAfter };
}
export function writerCombatConsequence(round: SliceCombatRound): string {
  const o = round.writerOutcome!, who = round.winner === 'PLAYER' ? '卢西安' : '你';
  let text = round.retreat === 'SUCCESS' ? '撤离判定成功，将沿普通6米出口实际离开。' : round.consequenceDomain === 'MENTAL' ? `${who}承受实际精神压力，精神减少10，没有新增身体伤口或身体风险。` : round.consequenceDomain === 'BODY' ? `${who}承受实际原身体打击，按共同伤势盘结算。` : '本轮没有实际致伤来源，不掷身体伤势盘、不增加身体风险。';
  if (o.plagueMindDamage) text += `此前实际播种的精神瘟疫本轮消耗卢西安${o.plagueMindDamage}精神。`;
  if (o.playerHealthAfter === 0) text += '本人的原身体真实死亡，本周目终结。'; else if (o.enemyHealth === 0) text += '卢西安原身体真实死亡，唯一原杖留地。'; else if (o.enemyStatus === 'SURRENDERED') text += '卢西安因实际伤势或精神耗尽自主停止抵抗，仍活着，原杖放在地面。';
  return text + ' 本轮实际60秒；未使用窗口到时结束，已经花费的灵性与精神不退。精神瘟疫保留，旧身份和两位生活参与者不在场。';
}
export function projectWriterCombat(s: SliceState) {
  const e = s.writer.encounter, last = s.combat?.encounterId === 'WRITER_DISPUTE' ? s.combat.lastRound?.writerOutcome : e.terminal ? s.combatHistory[e.terminal.historyIndex]?.writerOutcome : null;
  return { enemyName: isWriter(s) ? '卢西安·维尔（46岁，独立非凡者）' : '', targetId: e.targetId, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality,
    weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses }, policy: e.policy, materials: structuredClone(e.materials),
    lastActionSequence: last ? [...last.playerActions, ...last.enemyActions].sort((a, b) => a.order - b.order) : [], countWheel: WRITER_COUNT_WHEEL, enemyCountWheel: WRITER_ENEMY_COUNT_WHEEL,
    enemyAbilityWheel: WRITER_ENEMY_ABILITY_WHEEL, facts: [
      '本人核心仍按体质30%、感知25%、意志30%、知识15%；双方最多六动作，基础1250、最低125，灵性上限120。',
      '互知线索须真实互报姓名与当前待执行动作；合理安排只影响那一个真实动作，不改写过去，不对每个动作自动生效。',
      '两项新能力各每轮一次，实付、检定与抵抗全部保留；原23项能力与旧人物资源保持实际来源。',
      '卢西安心灵冲击7灵性、护持6灵性、集中抵抗3灵性；灵性不足使用自己的原杖。精神与身体后果分别结算。' ] };
}
