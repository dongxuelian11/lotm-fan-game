import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PSYCHOLOGIST_COUNT_WHEEL, psychologistActionCount } from '../psychologist/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { DREAM_WEAVER_TARGET_ID, DREAM_WEAVER_POWER_IDS, DREAM_WEAVER_POWERS, hasDreamWeaverDisputeOpponent,
  type DreamWeaverEnemyIntent, type DreamWeaverPowerId } from './encounter.js';

/** Finite S3 G inherits the ACTUAL Audience4 count and 1250/floor125,
 * 30/25/30/15 core, maxS120 and CONTINUE-only12 recovery budgets. */
export const DREAM_WEAVER_COUNT_WHEEL = PSYCHOLOGIST_COUNT_WHEEL;
export const DREAM_WEAVER_ENEMY_COUNT_WHEEL = PSYCHOLOGIST_COUNT_WHEEL;
export const dreamWeaverActionCount = psychologistActionCount;
export const dreamWeaverEnemyActionCount = psychologistActionCount;
export type DreamWeaverMoveId = 'audience.s3.external-identity' | 'audience.s3.woven-image' | 'audience.s4.mind-island'
  | 'audience.s4.virtual-persona' | 'audience.s4.mental-plague' | 'audience.s6.scales' | 'STRIKE' | 'OBSERVE' | 'ACCIDENT';
const IDENTITY = 'audience.s3.external-identity', IMAGE = 'audience.s3.woven-image';
const ABILITIES: readonly { id: DreamWeaverMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: IMAGE, label: '近真梦像（6S/意志18；实际信以为真才−6M/优势38×掌握G）', weight: 20, stance: 'ATTACK' },
  { id: IDENTITY, label: '一具外部身份牵制（5S+2M/意志16；至多60秒6米/减势26G）', weight: 15, stance: 'CONTROL' },
  { id: 'audience.s4.mind-island', label: '继承心灵岛屿（4S/意志16；−8M/优势42×掌握G）', weight: 15, stance: 'ATTACK' },
  { id: 'audience.s4.virtual-persona', label: '继承本人防守人格（3S+1M；减势24G）', weight: 10, stance: 'DEFEND' },
  { id: 'audience.s6.scales', label: '继承鳞片（2S/减势14×掌握G；不足普通自保）', weight: 15, stance: 'DEFEND' },
  { id: 'audience.s4.mental-plague', label: '继承有限精神瘟疫（4S/意志18；仅播种一次，离场不净化）', weight: 10, stance: 'CONTROL' },
  { id: 'STRIKE', label: '本人原身体/实际在手原棍（12/16×身体G）', weight: 5, stance: 'ATTACK' },
  { id: 'OBSERVE', label: '观察真实原人（0消耗/0贡献，不全知）', weight: 5, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡（固定−22.5G）', weight: 5, stance: null },
];
export const DREAM_WEAVER_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'ARC_BOLT', label: '原有限弧光术：5S/贡献75G', weight: 30 },
  { id: 'WARD', label: '原有限护术：4S/减势45G', weight: 20 },
  { id: 'COMPOSE', label: '实际精神抵抗：3S/一次梦像抵抗30%→70%G', weight: 20 },
  { id: 'BODY_STRIKE', label: '自己的唯一原棍：20×身体G', weight: 20 },
  { id: 'OBSERVE', label: '普通观察原身体与原出口：0贡献', weight: 5 },
  { id: 'ACCIDENT', label: '判断偏差：−22.5G', weight: 5 },
];
export const isDreamWeaver = (s: SliceState) => s.progression.pathwayId === 'audience' && s.progression.sequence === 3;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function dreamWeaverAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: weights[i]! / total * 100 }));
}
export function drawDreamWeaverAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): DreamWeaverMoveId {
  const weights = tickets(stance); let n = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { n -= weights[i]!; if (n <= 0) return a.id; } throw new Error('织梦人能力盘无效。');
}
export function drawDreamWeaverEnemyAbility(random: ActionRandomStream): DreamWeaverEnemyIntent {
  let n = random.nextInt(1, 100); for (const a of DREAM_WEAVER_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as DreamWeaverEnemyIntent; } throw new Error('原奥斯蒙德能力盘无效。');
}
interface MentalState {
  mentalPlague: number; plagueApplications: number; infectedRound: number | null; lastPlagueRound: number | null;
  personaGuards: number; identityUses: number; wovenImageUses: number; totalOwnerMindSpent: number;
}
export interface DreamWeaverCombatSource extends MentalState {
  runId: string; revision: number; week: number; round: number; encounterId: 'DREAM_WEAVER_DISPUTE'; targetId: typeof DREAM_WEAVER_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetAge: 45; targetSequence: 3; actualOriginalBody: true; independentMind: true;
  enemyWeapon: 'DWV3-OSMOND-CLUB'; weaponLocation: 'HAND'; distanceMetres: 2; space: 'DWV3-OPEN-STONE-YARD'; ordinaryExit: true; pursuit: false; noBystanders: true;
  playerHealth: number; playerMind: number; playerSpirituality: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  clubHeld: boolean; will: number; mastery: Record<string, number>; powerUses: Record<DreamWeaverPowerId, number>;
}
const bounded = (n: number, max: number) => Math.max(0, Math.min(max, Number.isFinite(n) ? n : 0));
function mentalState(e: MentalState): MentalState { return { mentalPlague: e.mentalPlague, plagueApplications: e.plagueApplications, infectedRound: e.infectedRound,
  lastPlagueRound: e.lastPlagueRound, personaGuards: e.personaGuards, identityUses: e.identityUses, wovenImageUses: e.wovenImageUses, totalOwnerMindSpent: e.totalOwnerMindSpent }; }
export function currentDreamWeaverCombatSource(s: SliceState): DreamWeaverCombatSource | null {
  if (!hasDreamWeaverDisputeOpponent(s)) return null;
  const e = s.dreamWeaver.encounter, c = s.combat!;
  return { ...mentalState(e), runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'DREAM_WEAVER_DISPUTE', targetId: DREAM_WEAVER_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetAge: 45, targetSequence: 3, actualOriginalBody: true, independentMind: true,
    enemyWeapon: 'DWV3-OSMOND-CLUB', weaponLocation: 'HAND', distanceMetres: 2, space: 'DWV3-OPEN-STONE-YARD', ordinaryExit: true, pursuit: false, noBystanders: true,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality,
    clubHeld: s.town.clubLocation === 'HAND', will: s.character.coreStats.will,
    mastery: Object.fromEntries(ABILITIES.filter(a => a.id.startsWith('audience.')).map(a => [a.id, bounded(s.progression.mastery[a.id] ?? 0, 500)])), powerUses: { ...e.powerUses } };
}
export interface DreamWeaverCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: boolean }
interface ActionEvidence extends DreamWeaverCombatEffect { order: number; paidCost: number; ownerMindSpent: number; physicalFactor: number; rolls: number[]; mindDamage: number }
export interface DreamWeaverPlayerAction extends ActionEvidence {
  id: DreamWeaverMoveId; imageResult: 'NONE' | 'FAILED' | 'RECOGNIZED' | 'RESISTED' | 'BELIEVED'; identityCreated: boolean; identityRejoined: true;
}
export interface DreamWeaverEnemyAction extends ActionEvidence { planned: DreamWeaverEnemyIntent; actual: DreamWeaverEnemyIntent }
interface RoundModel extends MentalState {
  playerSpirituality: number; playerMind: number; enemySpirituality: number; enemyMind: number; powerUses: Record<DreamWeaverPowerId, number>;
  composed: boolean; plagueMindDamage: number; islandMindDamage: number; wovenMindDamage: number;
}
export interface DreamWeaverRoundContext {
  source: DreamWeaverCombatSource; stance: SliceStance; finished: boolean; liveState: string; model: RoundModel;
  playerSpiritualityBefore: number; enemySpiritualityBefore: number; playerActions: DreamWeaverPlayerAction[]; enemyActions: DreamWeaverEnemyAction[]; label: string;
}
const none = (label: string): DreamWeaverCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false });
function initialModel(source: DreamWeaverCombatSource): RoundModel {
  const m: RoundModel = { ...mentalState(source), playerSpirituality: source.playerSpirituality, playerMind: source.playerMind, enemySpirituality: source.enemySpirituality,
    enemyMind: source.enemyMind, powerUses: { ...source.powerUses }, composed: false, plagueMindDamage: 0, islandMindDamage: 0, wovenMindDamage: 0 };
  if (m.mentalPlague > 0 && m.infectedRound !== null && m.infectedRound < source.round && m.lastPlagueRound !== source.round) {
    m.plagueMindDamage = Math.min(m.enemyMind, m.mentalPlague * 4); m.enemyMind -= m.plagueMindDamage; m.lastPlagueRound = source.round; m.mentalPlague = Math.min(3, m.mentalPlague + 1);
  }
  return m;
}
function liveState(s: SliceState): string { const e = s.dreamWeaver.encounter; return stableStringify({ ...mentalState(e), playerMind: s.mind, playerSpirituality: s.spirituality,
  enemyMind: e.enemyMind, combatMind: s.combat?.enemyMind, enemySpirituality: e.enemySpirituality, powerUses: e.powerUses }); }
function commit(s: SliceState, r: DreamWeaverRoundContext): void {
  const m = r.model, e = s.dreamWeaver.encounter;
  s.spirituality = m.playerSpirituality; s.mind = m.playerMind; e.enemySpirituality = m.enemySpirituality; e.enemyMind = m.enemyMind; s.combat!.enemyMind = m.enemyMind;
  Object.assign(e, mentalState(m)); e.powerUses = { ...m.powerUses }; r.liveState = liveState(s);
}
const dynamicSource = new Set(['playerMind', 'playerSpirituality', 'enemyMind', 'enemySpirituality', 'powerUses', 'mentalPlague', 'plagueApplications', 'infectedRound', 'lastPlagueRound', 'personaGuards', 'identityUses', 'wovenImageUses', 'totalOwnerMindSpent']);
function validRound(s: SliceState, r: DreamWeaverRoundContext, supplied: DreamWeaverCombatSource | null): boolean {
  const actual = currentDreamWeaverCombatSource(s);
  return !r.finished && actual !== null && supplied !== null && stableStringify(supplied) === stableStringify(r.source) && r.liveState === liveState(s) &&
    Object.entries(r.source).every(([key, value]) => dynamicSource.has(key) || stableStringify(actual[key as keyof DreamWeaverCombatSource]) === stableStringify(value));
}
export function beginDreamWeaverCombatRound(s: SliceState, stance: SliceStance, _random: ActionRandomStream): DreamWeaverRoundContext {
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('织梦人本轮姿态无效。');
  const source = currentDreamWeaverCombatSource(s); if (!source) throw new Error('缺少原奥斯蒙德、原棍与本场真实身体和连续资源来源。');
  const r: DreamWeaverRoundContext = { source, stance, finished: false, liveState: '', model: initialModel(source), playerSpiritualityBefore: s.spirituality,
    enemySpiritualityBefore: s.dreamWeaver.encounter.enemySpirituality, playerActions: [], enemyActions: [], label: '' };
  commit(s, r);
  r.label = `同一原奥斯蒙德在独立净空石院2米外，独立灵性${r.enemySpiritualityBefore}/120。${r.model.plagueMindDamage ? `原精神瘟疫本轮实际−${r.model.plagueMindDamage}M、余${r.model.enemyMind}，病势现${r.model.mentalPlague}（G）；离场不自动治愈。` : ''}`;
  return r;
}
export const createDreamWeaverCombatRound = beginDreamWeaverCombatRound;
function actionBase(order: number, physical: number): ActionEvidence { return { ...none(''), order, paidCost: 0, ownerMindSpent: 0, physicalFactor: physical, rolls: [], mindDamage: 0 }; }
function playerAction(source: DreamWeaverCombatSource, m: RoundModel, id: DreamWeaverMoveId, physical: number, order: number, roll: () => number): DreamWeaverPlayerAction {
  const a: DreamWeaverPlayerAction = { ...actionBase(order, physical), id, imageResult: 'NONE', identityCreated: false, identityRejoined: true };
  const pay = (n: number, mind = 0) => { if (m.playerSpirituality < n || m.playerMind <= mind) return false; m.playerSpirituality -= n; m.playerMind -= mind; m.totalOwnerMindSpent += mind; a.paidCost = n; a.ownerMindSpent = mind; return true; };
  const block = (why: string) => { a.enemyReduction = 10; a.label = `${why}本人原身体普通自保减势10G，不重抽、不产生身份或免伤。`; };
  const strike = (why = '') => { a.selfGain = (source.clubHeld ? 16 : 12) * physical; a.threatens = a.selfGain > 0; a.label = `${why}本人${source.clubHeld ? '实际在手自有原短棍16' : '原身体空手12'}×身体G普通打击，不借用敌棍或复制装备。`; };
  const check = (difficulty: number) => { const n = roll(); a.rolls.push(n); return { roll: n, chance: computeCheckChance({ ability: 'will', baseAbility: source.will, difficulty, modifiers: [] }) }; };
  const mastery = 1 + (source.mastery[id] ?? 0) / 500;
  if (id === 'STRIKE') strike();
  else if (id === 'OBSERVE') a.label = '观察眼前独立原人和真实出口，0灵性0贡献，不凭空得到未知记忆、第二轮盘或控制。';
  else if (id === 'ACCIDENT') { a.selfGain = -22.5; a.label = '本槽判断失衡，固定优势−22.5G，不重抽。'; }
  else if (id === 'audience.s6.scales') {
    if (!pay(2)) block('原灵性不足2，继承鳞片未施展；');
    else { a.enemyReduction = 14 * mastery; a.label = '继承有限鳞片：实际2S、减势14×掌握G，不豁免精神、身体伤势或死亡。'; }
  } else if (id === 'audience.s4.virtual-persona') {
    if (!pay(3, 1)) block('缺少本人3S与可支付的1M，未产生防守人格；');
    else { m.personaGuards++; a.enemyReduction = 24; a.label = '继承本人有限防守人格：实际3S+本人1M、减势24G，本动作结束真实重归；无实体代打、额外次数或伤害免疫。'; }
  } else if (id === IDENTITY) {
    if (!pay(5, 2)) block('缺少本人5S与可支付的2M，外部身份未形成；');
    else {
      m.identityUses++; const c = check(16);
      if (c.roll > c.chance) a.label = `外部身份意志检定${c.roll}>${c.chance}失败，已付5S+2M不退，未出现第二身体或牵制。`;
      else { a.identityCreated = true; a.enemyReduction = 26; a.label = `意志检定${c.roll}≤${c.chance}，本人5S+2M实付，一具有限外部身份在6米内短暂牵制减势26G、与本人思想共通；至多60秒且本动作结束重归，没有第二份资源、装备、独立攻击次数或替死。`; }
    }
  } else if (id === IMAGE) {
    if (!pay(6)) strike('本人原灵性不足6，梦像未织成；');
    else {
      m.wovenImageUses++; const c = check(18);
      if (c.roll > c.chance) { a.imageResult = 'FAILED'; a.label = `近真梦像意志检定${c.roll}>${c.chance}失败，6S已付，未使原奥斯蒙德相信，无精神后果。`; }
      else {
        const resistance = m.composed ? 70 : 30, prepared = m.composed, n = roll(); a.rolls.push(n); m.composed = false;
        if (n <= resistance) { a.imageResult = prepared ? 'RESISTED' : 'RECOGNIZED'; a.label = `梦像施术${c.roll}≤${c.chance}，但原奥斯蒙德${prepared ? '实付过3S的本轮一次精神抵抗' : '凭自己的辨认'}检定${n}≤${resistance}G，未信以为真；本人已付6S，精神损耗0、优势0，原病况不被抵抗治愈。`; }
        else { a.imageResult = 'BELIEVED'; a.mindDamage = Math.min(6, m.enemyMind); m.enemyMind -= a.mindDamage; m.wovenMindDamage += a.mindDamage; a.selfGain = 38 * mastery; a.mentalPressure = true;
          a.label = `梦像施术${c.roll}≤${c.chance}、对方抵抗${n}>${resistance}G，同一原奥斯蒙德本次信以为真，精神实际−${a.mindDamage}、余${m.enemyMind}，有限优势38×掌握；没有实体召神、物理伤害或永久控制，梦像本动作结束。`; }
      }
    }
  } else if (id === 'audience.s4.mental-plague' && m.plagueApplications > 0) a.label = '同一原奥斯蒙德已经实际播种一次，本槽0消耗不重复播种、不刷新；已有病况仍保留。';
  else if (!pay(4)) strike('本人当前灵性不足4，继承心灵能力未施展；');
  else {
    const island = id === 'audience.s4.mind-island', c = check(island ? 16 : 18);
    if (c.roll > c.chance) a.label = `原奥斯蒙德当前心灵抵抗${c.roll}>${c.chance}，已付4S；本次未${island ? '深入心灵或损耗精神' : '造成精神瘟疫'}，无必然控制。`;
    else if (island) { a.mindDamage = Math.min(8, m.enemyMind); m.enemyMind -= a.mindDamage; m.islandMindDamage += a.mindDamage; a.selfGain = 42 * mastery; a.mentalPressure = true;
      a.label = `继承有限心灵岛屿检定${c.roll}≤${c.chance}：已付4S，原奥斯蒙德精神实际−${a.mindDamage}、余${m.enemyMind}，优势42×掌握G；本动作已退出，不读取全部记忆或强制驱动行为。`; }
    else { m.mentalPlague = 1; m.plagueApplications = 1; m.infectedRound = source.round; m.lastPlagueRound = source.round; a.mentalPressure = true;
      a.label = `继承有限精神瘟疫检定${c.roll}≤${c.chance}：已付4S，仅同一原奥斯蒙德形成病势1G；本轮不提前扣病况精神，后续真实回合−4/8/12M。离场不自动治愈，没有旁人传播或友军免疫。`; }
  }
  return a;
}
function enemyAction(m: RoundModel, planned: DreamWeaverEnemyIntent, physical: number, order: number): DreamWeaverEnemyAction {
  const a: DreamWeaverEnemyAction = { ...actionBase(order, physical), planned, actual: planned }, power = DREAM_WEAVER_POWERS.find(p => p.id === planned);
  if (planned === 'COMPOSE' && m.composed) a.label = '同一原奥斯蒙德本轮已有一次未消费精神抵抗，普通观察0贡献0消耗，不叠加抵抗、补S或清除瘟疫。';
  else if (power && m.enemySpirituality >= power.cost) {
    m.enemySpirituality -= power.cost; m.powerUses[power.id]++; a.paidCost = power.cost; a.selfGain = power.selfGain; a.enemyReduction = power.enemyReduction; a.threatens = power.selfGain > 0;
    if (planned === 'COMPOSE') m.composed = true;
    a.label = `原奥斯蒙德本人${power.label}：实际独立原灵性−${power.cost}、余${m.enemySpirituality}/120；${planned === 'COMPOSE' ? '本轮下一次成功织成的梦像抵抗30%提高到70%G，消费后或本轮结束失效，不无限抵抗' : `贡献${a.selfGain}/减势${a.enemyReduction}G`}，不借本人资源。`;
  } else if (planned === 'OBSERVE') a.label = '原奥斯蒙德普通观察眼前原身体与出口，0消耗0贡献，没有免费精神抵抗。';
  else if (planned === 'ACCIDENT') { a.selfGain = -22.5; a.label = '原奥斯蒙德本槽判断偏差，贡献−22.5G，不重抽。'; }
  else { a.actual = 'BODY_STRIKE'; a.selfGain = 20 * physical; a.threatens = a.selfGain > 0; a.label = `${power ? '独立灵性不足，未施法、不重抽；' : ''}原奥斯蒙德用自己的唯一原棍DWV3-OSMOND-CLUB作普通打击20×身体G。`; }
  return a;
}
const allowed = (id: string): id is DreamWeaverMoveId => ABILITIES.some(a => a.id === id);
const enemyAllowed = (id: string): id is DreamWeaverEnemyIntent => DREAM_WEAVER_ENEMY_ABILITY_WHEEL.some(a => a.id === id);
export function resolveDreamWeaverCombatAbility(s: SliceState, id: DreamWeaverMoveId, physical: number, random: ActionRandomStream,
  r: DreamWeaverRoundContext, source: DreamWeaverCombatSource | null = r.source): DreamWeaverCombatEffect {
  if (!allowed(id) || r.playerActions.length >= 6 || !validRound(s, r, source)) return none('本轮原身体、原奥斯蒙德或实际资源来源不符：0贡献0消耗，不重抽。');
  const a = playerAction(r.source, r.model, id, bounded(physical, 1), r.playerActions.length + r.enemyActions.length, () => random.nextInt(1, 100));
  r.playerActions.push(a); commit(s, r); return a;
}
export function resolveDreamWeaverEnemyAbility(s: SliceState, planned: DreamWeaverEnemyIntent, physical: number, _random: ActionRandomStream,
  r: DreamWeaverRoundContext, source: DreamWeaverCombatSource | null = r.source): DreamWeaverCombatEffect {
  if (!enemyAllowed(planned) || r.enemyActions.length >= 6 || !validRound(s, r, source)) return none('本轮原奥斯蒙德独立身体/资源来源不符：0贡献0消耗，不重抽。');
  const a = enemyAction(r.model, planned, bounded(physical, 1), r.playerActions.length + r.enemyActions.length); r.enemyActions.push(a); commit(s, r); return a;
}
export interface DreamWeaverRoundOutcome {
  targetId: typeof DREAM_WEAVER_TARGET_ID; round: number; source: DreamWeaverCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number; enemySpiritualityBefore: number;
  powerUses: Record<DreamWeaverPowerId, number>; enemyMentalPlague: number; plagueApplications: number; infectedRound: number | null; lastPlagueRound: number | null;
  personaGuards: number; identityUses: number; wovenImageUses: number; totalOwnerMindSpent: number; ownerMindSpent: number;
  islandMindDamage: number; wovenMindDamage: number; plagueMindDamage: number; identityActiveAfter: false; wovenImageActiveAfter: false; resistanceActiveAfter: false;
  elapsedSeconds: 60; playerActions: DreamWeaverPlayerAction[]; enemyActions: DreamWeaverEnemyAction[];
}
export function finishDreamWeaverCombatRound(s: SliceState, r: DreamWeaverRoundContext, continuing = true): DreamWeaverRoundOutcome {
  const e = s.dreamWeaver.encounter, c = s.combat, m = r.model;
  if (r.finished || !c || c.encounterId !== 'DREAM_WEAVER_DISPUTE' || c.round !== r.source.round || r.liveState !== liveState(s)) throw new Error('原织梦人回合已结束或实际资源被改写。');
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus; e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk;
  if (e.enemyStatus !== 'RESISTING') e.weaponLocation = 'YARD'; r.finished = true; m.composed = false;
  return { targetId: DREAM_WEAVER_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus,
    playerSpiritualityBefore: r.playerSpiritualityBefore, playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind, enemySpiritualityBefore: r.enemySpiritualityBefore,
    powerUses: { ...e.powerUses }, enemyMentalPlague: e.mentalPlague, plagueApplications: e.plagueApplications, infectedRound: e.infectedRound, lastPlagueRound: e.lastPlagueRound,
    personaGuards: e.personaGuards, identityUses: e.identityUses, wovenImageUses: e.wovenImageUses, totalOwnerMindSpent: e.totalOwnerMindSpent,
    ownerMindSpent: r.source.playerMind - s.mind, islandMindDamage: m.islandMindDamage, wovenMindDamage: m.wovenMindDamage, plagueMindDamage: m.plagueMindDamage,
    identityActiveAfter: false, wovenImageActiveAfter: false, resistanceActiveAfter: false, elapsedSeconds: 60,
    playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
}
export function projectDreamWeaverCombat(s: SliceState) {
  const e = s.dreamWeaver.encounter;
  return { enemyName: '奥斯蒙德（45岁，原创有限G3非凡者）', targetId: e.targetId, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, mentalPlague: e.mentalPlague,
    powerUses: { ...e.powerUses }, originalExit: true, pursuit: false, distanceMetres: 2, source: currentDreamWeaverCombatSource(s),
    summary: '双方1–6次权重15/20/25/20/15/5；继承观众实际核心体30/感25/意30/知15、1250/底125、灵性120，仅继续轮恢复12（G）。一具身份5S+2M/意志16、至多60秒6米，牵制26后归并，无第二份资源或轮盘；梦像6S/意志18，经本人施术与对方辨认抵抗，实际相信才−6M/优势38×掌握。COMPOSE实付3S令本轮下一次抵抗30%→70%。精神0停战投降不是死亡，身体伤势仍走共同盘，离场不治愈瘟疫。' };
}
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
function validSource(source: DreamWeaverCombatSource): boolean {
  return !!source && typeof source.runId === 'string' && integer(source.revision) && integer(source.week, 1) && integer(source.round, 1) && source.attemptWeek === source.week && integer(source.startHistoryIndex) &&
    source.encounterId === 'DREAM_WEAVER_DISPUTE' && source.targetId === DREAM_WEAVER_TARGET_ID && source.targetAge === 45 && source.targetSequence === 3 && source.actualOriginalBody === true && source.independentMind === true &&
    source.enemyWeapon === 'DWV3-OSMOND-CLUB' && source.weaponLocation === 'HAND' && source.distanceMetres === 2 && source.space === 'DWV3-OPEN-STONE-YARD' && source.ordinaryExit === true && source.pursuit === false && source.noBystanders === true &&
    [source.playerHealth, source.playerMind, source.enemyHealth, source.enemyMind].every(n => integer(n, 1, 100)) && [source.playerSpirituality, source.enemySpirituality].every(n => integer(n, 0, 120)) && typeof source.clubHeld === 'boolean' && integer(source.will, 0, 500) &&
    !!source.mastery && same(Object.keys(source.mastery).sort(), ABILITIES.filter(a => a.id.startsWith('audience.')).map(a => a.id).sort()) && Object.values(source.mastery).every(n => integer(n, 0, 500)) &&
    !!source.powerUses && Object.keys(source.powerUses).length === 3 && DREAM_WEAVER_POWER_IDS.every(id => integer(source.powerUses[id])) && source.enemySpirituality === 120 - DREAM_WEAVER_POWERS.reduce((n, p) => n + source.powerUses[p.id] * p.cost, 0) &&
    integer(source.mentalPlague, 0, 3) && integer(source.plagueApplications, 0, 1) && [source.personaGuards, source.identityUses, source.wovenImageUses].every(n => integer(n)) && source.totalOwnerMindSpent === source.personaGuards + 2 * source.identityUses &&
    (source.plagueApplications === 0 ? source.mentalPlague === 0 && source.infectedRound === null && source.lastPlagueRound === null : integer(source.infectedRound, 1, source.round - 1) && integer(source.lastPlagueRound, source.infectedRound, source.round - 1));
}
/** Check only this finite encounter's paid actions and mental effects.
 * Physical injury/death remain the existing common combat result. */
export function validateDreamWeaverRoundOutcome(value: unknown): value is DreamWeaverRoundOutcome {
  try {
    const o = value as DreamWeaverRoundOutcome;
    if (!o || !validSource(o.source) || o.targetId !== DREAM_WEAVER_TARGET_ID || o.round !== o.source.round || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(o.stance) || typeof o.continuing !== 'boolean' || o.elapsedSeconds !== 60 ||
        ![o.enemyHealth, o.enemyMind, o.playerHealthAfter, o.playerMindAfter].every(n => integer(n, 0, 100)) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(o.enemyStatus) || (o.enemyStatus === 'DEAD') !== (o.enemyHealth === 0) || o.enemyMind === 0 && o.enemyStatus === 'RESISTING' ||
        ![o.playerSpiritualityBefore, o.playerSpiritualityAfter, o.enemySpiritualityBefore, o.enemySpirituality].every(n => integer(n, 0, 120)) || o.playerHealthAfter > o.source.playerHealth || o.enemyHealth > o.source.enemyHealth ||
        o.playerSpiritualityBefore !== o.source.playerSpirituality || o.enemySpiritualityBefore !== o.source.enemySpirituality ||
        !Array.isArray(o.playerActions) || !Array.isArray(o.enemyActions) || o.playerActions.length > 6 || o.enemyActions.length > 6 || o.identityActiveAfter !== false || o.wovenImageActiveAfter !== false || o.resistanceActiveAfter !== false ||
        o.continuing && (o.enemyStatus !== 'RESISTING' || o.playerHealthAfter <= 0 || o.playerMindAfter <= 0)) return false;
    const m = initialModel(o.source);
    const all = [...o.playerActions.map(a => ({ actor: 'PLAYER', action: a })), ...o.enemyActions.map(a => ({ actor: 'ENEMY', action: a }))].sort((a, b) => a.action.order - b.action.order);
    for (const [i, item] of all.entries()) {
      const a = item.action;
      if (m.enemyMind <= 0 || m.playerMind <= 0 || a.order !== i || !Number.isFinite(a.physicalFactor) || a.physicalFactor < 0 || a.physicalFactor > 1 || !Array.isArray(a.rolls) || a.rolls.some(n => !integer(n, 1, 100))) return false;
      let expected: DreamWeaverPlayerAction | DreamWeaverEnemyAction;
      if (item.actor === 'PLAYER') {
        const p = a as DreamWeaverPlayerAction; if (!allowed(p.id)) return false;
        let cursor = 0; expected = playerAction(o.source, m, p.id, p.physicalFactor, i, () => { const n = a.rolls[cursor++]; if (n === undefined) throw new Error('Missing recorded check'); return n; });
        if (cursor !== a.rolls.length) return false;
      } else { const e = a as DreamWeaverEnemyAction; if (!enemyAllowed(e.planned)) return false; expected = enemyAction(m, e.planned, e.physicalFactor, i); }
      if (!same(a, expected)) return false;
    }
    return o.playerSpiritualityAfter === m.playerSpirituality && o.playerMindAfter === m.playerMind && o.enemySpirituality === m.enemySpirituality && o.enemyMind === m.enemyMind && same(o.powerUses, m.powerUses) &&
      o.enemyMentalPlague === m.mentalPlague && o.plagueApplications === m.plagueApplications && o.infectedRound === m.infectedRound && o.lastPlagueRound === m.lastPlagueRound &&
      o.personaGuards === m.personaGuards && o.identityUses === m.identityUses && o.wovenImageUses === m.wovenImageUses && o.totalOwnerMindSpent === m.totalOwnerMindSpent &&
      o.ownerMindSpent === o.source.playerMind - m.playerMind && o.islandMindDamage === m.islandMindDamage && o.wovenMindDamage === m.wovenMindDamage && o.plagueMindDamage === m.plagueMindDamage;
  } catch { return false; }
}
