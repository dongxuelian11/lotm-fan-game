import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { PSYCHOLOGIST_COUNT_WHEEL, psychologistActionCount } from '../psychologist/combat.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { DISCERNER_TARGET_ID, DISCERNER_POWER_IDS, DISCERNER_POWERS, hasDiscernerDisputeOpponent,
  type DiscernerEnemyIntent, type DiscernerPowerId } from './encounter.js';

/** Finite S2 G inherits the ACTUAL Audience4 count and 1250/floor125,
 * 30/25/30/15 core, maxS120 and CONTINUE-only12 recovery budgets. */
export const DISCERNER_COUNT_WHEEL = PSYCHOLOGIST_COUNT_WHEEL;
export const DISCERNER_ENEMY_COUNT_WHEEL = PSYCHOLOGIST_COUNT_WHEEL;
export const discernerActionCount = psychologistActionCount;
export const discernerEnemyActionCount = psychologistActionCount;
export const DISCERNER_NEW_ABILITY_IDS = ['audience.s2.mental-imprint', 'audience.s2.insight-window'] as const;
export type DiscernerMoveId = 'audience.s2.mental-imprint' | 'audience.s2.insight-window' | 'audience.s3.external-identity' | 'audience.s3.woven-image' | 'audience.s4.mind-island'
  | 'audience.s4.virtual-persona' | 'audience.s4.mental-plague' | 'audience.s6.scales' | 'STRIKE' | 'OBSERVE' | 'ACCIDENT';
const IMPRINT = 'audience.s2.mental-imprint', INSIGHT = 'audience.s2.insight-window';
const IDENTITY = 'audience.s3.external-identity', IMAGE = 'audience.s3.woven-image';
export const DISCERNER_ABILITIES: readonly { id: DiscernerMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: IMPRINT, label: '近距有限心灵印记（每轮一次6S+2M/意志18；抵抗有效/减势30G）', weight: 15, stance: 'CONTROL' },
  { id: INSIGHT, label: '有限洞察窗口（每轮一次5S+1M/意志18；护持与抵抗有效/优势42×掌握G）', weight: 15, stance: 'PREPARE' },
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
export const DISCERNER_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'PSYCHIC_STRIKE', label: '原有限心灵冲击：7S/贡献95G', weight: 30 },
  { id: 'MENTAL_WARD', label: '原有限精神护持：6S/减势55G；本轮抵挡新印记/窗口', weight: 20 },
  { id: 'COMPOSE', label: '实际精神抵抗：3S/下一次梦像、印记或窗口抵抗30%→70%G', weight: 20 },
  { id: 'BODY_STRIKE', label: '自己的唯一原棍：20×身体G', weight: 20 },
  { id: 'OBSERVE', label: '普通观察原身体与原出口：0贡献', weight: 5 },
  { id: 'ACCIDENT', label: '判断偏差：−22.5G', weight: 5 },
];
export const isDiscerner = (s: SliceState) => s.progression.pathwayId === 'audience' && s.progression.sequence === 2;
const tickets = (stance: SliceStance | null) => DISCERNER_ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function discernerAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return DISCERNER_ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: weights[i]! / total * 100 }));
}
export function drawDiscernerAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): DiscernerMoveId {
  const weights = tickets(stance); let n = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (const [i, a] of DISCERNER_ABILITIES.entries()) { n -= weights[i]!; if (n <= 0) return a.id; } throw new Error('洞察者能力盘无效。');
}
export function drawDiscernerEnemyAbility(random: ActionRandomStream): DiscernerEnemyIntent {
  let n = random.nextInt(1, 100); for (const a of DISCERNER_ENEMY_ABILITY_WHEEL) { n -= a.weight; if (n <= 0) return a.id as DiscernerEnemyIntent; } throw new Error('原阿尔里克·维尔能力盘无效。');
}
interface MentalState {
  mentalPlague: number; plagueApplications: number; infectedRound: number | null; lastPlagueRound: number | null;
  personaGuards: number; identityUses: number; wovenImageUses: number; totalOwnerMindSpent: number;
  mentalImprintUses: number; mentalImprintSuccesses: number; insightWindowUses: number; insightWindowSuccesses: number;
}
export interface DiscernerCombatSource extends MentalState {
  runId: string; revision: number; week: number; round: number; encounterId: 'DISCERNER_DISPUTE'; targetId: typeof DISCERNER_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; targetAge: 47; targetSequence: 2; targetPhysique: 22; actualOriginalBody: true; independentMind: true;
  enemyWeapon: 'DCR2-ALRIC-CLUB'; weaponLocation: 'HAND'; distanceMetres: 2; space: 'DCR2-OPEN-STONE-YARD'; ordinaryExit: true; pursuit: false; noBystanders: true;
  playerHealth: number; playerMind: number; playerSpirituality: number; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  clubHeld: boolean; will: number; mastery: Record<string, number>; powerUses: Record<DiscernerPowerId, number>;
}
const bounded = (n: number, max: number) => Math.max(0, Math.min(max, Number.isFinite(n) ? n : 0));
function mentalState(e: MentalState): MentalState { return { mentalPlague: e.mentalPlague, plagueApplications: e.plagueApplications, infectedRound: e.infectedRound,
  lastPlagueRound: e.lastPlagueRound, personaGuards: e.personaGuards, identityUses: e.identityUses, wovenImageUses: e.wovenImageUses, totalOwnerMindSpent: e.totalOwnerMindSpent,
  mentalImprintUses: e.mentalImprintUses, mentalImprintSuccesses: e.mentalImprintSuccesses, insightWindowUses: e.insightWindowUses, insightWindowSuccesses: e.insightWindowSuccesses }; }
export function currentDiscernerCombatSource(s: SliceState): DiscernerCombatSource | null {
  if (!hasDiscernerDisputeOpponent(s)) return null;
  const e = s.discerner.encounter, c = s.combat!;
  return { ...mentalState(e), runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'DISCERNER_DISPUTE', targetId: DISCERNER_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, targetAge: 47, targetSequence: 2, targetPhysique: 22, actualOriginalBody: true, independentMind: true,
    enemyWeapon: 'DCR2-ALRIC-CLUB', weaponLocation: 'HAND', distanceMetres: 2, space: 'DCR2-OPEN-STONE-YARD', ordinaryExit: true, pursuit: false, noBystanders: true,
    playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality,
    clubHeld: s.town.clubLocation === 'HAND', will: s.character.coreStats.will,
    mastery: Object.fromEntries(DISCERNER_ABILITIES.filter(a => a.id.startsWith('audience.')).map(a => [a.id, bounded(s.progression.mastery[a.id] ?? 0, 500)])), powerUses: { ...e.powerUses } };
}
export interface DiscernerCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean; mentalPressure: boolean }
interface ActionEvidence extends DiscernerCombatEffect { order: number; paidCost: number; ownerMindSpent: number; physicalFactor: number; rolls: number[]; mindDamage: number }
export interface DiscernerPlayerAction extends ActionEvidence {
  id: DiscernerMoveId; finiteResult: 'NONE' | 'ALREADY_ATTEMPTED' | 'INSUFFICIENT' | 'FAILED' | 'WARDED' | 'RESISTED' | 'APPLIED'; imageResult: 'NONE' | 'FAILED' | 'RECOGNIZED' | 'RESISTED' | 'BELIEVED'; identityCreated: boolean; identityRejoined: true;
}
export interface DiscernerEnemyAction extends ActionEvidence { planned: DiscernerEnemyIntent; actual: DiscernerEnemyIntent }
interface RoundModel extends MentalState {
  playerSpirituality: number; playerMind: number; enemySpirituality: number; enemyMind: number; powerUses: Record<DiscernerPowerId, number>;
  composed: boolean; warded: boolean; imprintAttempted: boolean; insightAttempted: boolean; plagueMindDamage: number; islandMindDamage: number; wovenMindDamage: number;
}
export interface DiscernerRoundContext {
  source: DiscernerCombatSource; stance: SliceStance; finished: boolean; liveState: string; model: RoundModel;
  playerSpiritualityBefore: number; enemySpiritualityBefore: number; playerActions: DiscernerPlayerAction[]; enemyActions: DiscernerEnemyAction[]; label: string;
}
const none = (label: string): DiscernerCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false, mentalPressure: false });
function initialModel(source: DiscernerCombatSource): RoundModel {
  const m: RoundModel = { ...mentalState(source), playerSpirituality: source.playerSpirituality, playerMind: source.playerMind, enemySpirituality: source.enemySpirituality,
    enemyMind: source.enemyMind, powerUses: { ...source.powerUses }, composed: false, warded: false, imprintAttempted: false, insightAttempted: false, plagueMindDamage: 0, islandMindDamage: 0, wovenMindDamage: 0 };
  if (m.mentalPlague > 0 && m.infectedRound !== null && m.infectedRound < source.round && m.lastPlagueRound !== source.round) {
    m.plagueMindDamage = Math.min(m.enemyMind, m.mentalPlague * 4); m.enemyMind -= m.plagueMindDamage; m.lastPlagueRound = source.round; m.mentalPlague = Math.min(3, m.mentalPlague + 1);
  }
  return m;
}
function liveState(s: SliceState): string { const e = s.discerner.encounter; return stableStringify({ ...mentalState(e), playerMind: s.mind, playerSpirituality: s.spirituality,
  enemyMind: e.enemyMind, combatMind: s.combat?.enemyMind, enemySpirituality: e.enemySpirituality, powerUses: e.powerUses }); }
function commit(s: SliceState, r: DiscernerRoundContext): void {
  const m = r.model, e = s.discerner.encounter;
  s.spirituality = m.playerSpirituality; s.mind = m.playerMind; e.enemySpirituality = m.enemySpirituality; e.enemyMind = m.enemyMind; s.combat!.enemyMind = m.enemyMind;
  Object.assign(e, mentalState(m)); e.powerUses = { ...m.powerUses }; r.liveState = liveState(s);
}
const dynamicSource = new Set(['playerMind', 'playerSpirituality', 'enemyMind', 'enemySpirituality', 'powerUses', 'mentalPlague', 'plagueApplications', 'infectedRound', 'lastPlagueRound', 'personaGuards', 'identityUses', 'wovenImageUses', 'totalOwnerMindSpent', 'mentalImprintUses', 'mentalImprintSuccesses', 'insightWindowUses', 'insightWindowSuccesses']);
function validRound(s: SliceState, r: DiscernerRoundContext, supplied: DiscernerCombatSource | null): boolean {
  const actual = currentDiscernerCombatSource(s);
  const replay = replayActions(r.source, r.playerActions, r.enemyActions);
  return !r.finished && validSource(r.source) && replay !== null && same(replay, r.model) && actual !== null && supplied !== null && stableStringify(supplied) === stableStringify(r.source) && r.liveState === liveState(s) &&
    Object.entries(r.source).every(([key, value]) => dynamicSource.has(key) || stableStringify(actual[key as keyof DiscernerCombatSource]) === stableStringify(value));
}
export function beginDiscernerCombatRound(s: SliceState, stance: SliceStance, _random: ActionRandomStream): DiscernerRoundContext {
  if (!['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(stance)) throw new TypeError('洞察者本轮姿态无效。');
  const source = currentDiscernerCombatSource(s); if (!source || !validSource(source)) throw new Error('缺少原阿尔里克·维尔、原棍与本场真实身体和连续资源来源。');
  const r: DiscernerRoundContext = { source, stance, finished: false, liveState: '', model: initialModel(source), playerSpiritualityBefore: s.spirituality,
    enemySpiritualityBefore: s.discerner.encounter.enemySpirituality, playerActions: [], enemyActions: [], label: '' };
  commit(s, r);
  r.label = `同一原阿尔里克·维尔在独立净空石院2米外，独立灵性${r.enemySpiritualityBefore}/120。${r.model.plagueMindDamage ? `原精神瘟疫本轮实际−${r.model.plagueMindDamage}M、余${r.model.enemyMind}，病势现${r.model.mentalPlague}（G）；离场不自动治愈。` : ''}`;
  return r;
}
export const createDiscernerCombatRound = beginDiscernerCombatRound;
function actionBase(order: number, physical: number): ActionEvidence { return { ...none(''), order, paidCost: 0, ownerMindSpent: 0, physicalFactor: physical, rolls: [], mindDamage: 0 }; }
function playerAction(source: DiscernerCombatSource, m: RoundModel, id: DiscernerMoveId, physical: number, order: number, roll: () => number): DiscernerPlayerAction {
  const a: DiscernerPlayerAction = { ...actionBase(order, physical), id, finiteResult: 'NONE', imageResult: 'NONE', identityCreated: false, identityRejoined: true };
  const pay = (n: number, mind = 0) => { if (m.playerSpirituality < n || m.playerMind <= mind) return false; m.playerSpirituality -= n; m.playerMind -= mind; m.totalOwnerMindSpent += mind; a.paidCost = n; a.ownerMindSpent = mind; return true; };
  const block = (why: string) => { a.enemyReduction = 10; a.label = `${why}本人原身体普通自保减势10G，不重抽、不产生身份或免伤。`; };
  const strike = (why = '') => { a.selfGain = (source.clubHeld ? 16 : 12) * physical; a.threatens = a.selfGain > 0; a.label = `${why}本人${source.clubHeld ? '实际在手自有原短棍16' : '原身体空手12'}×身体G普通打击，不借用敌棍或复制装备。`; };
  const check = (difficulty: number) => { const n = roll(); a.rolls.push(n); return { roll: n, chance: computeCheckChance({ ability: 'will', baseAbility: source.will, difficulty, modifiers: [] }) }; };
  const mastery = 1 + (source.mastery[id] ?? 0) / 500;
  if (id === 'STRIKE') strike();
  else if (id === 'OBSERVE') a.label = '观察眼前独立原人和真实出口，0灵性0贡献，不凭空得到未知记忆、第二轮盘或控制。';
  else if (id === 'ACCIDENT') { a.selfGain = -22.5; a.label = '本槽判断失衡，固定优势−22.5G，不重抽。'; }
  else if (id === IMPRINT || id === INSIGHT) {
    const imprint = id === IMPRINT, flag = imprint ? 'imprintAttempted' : 'insightAttempted';
    if (m[flag]) { a.finiteResult = 'ALREADY_ATTEMPTED'; block('本轮该有限能力已经尝试一次，不能重试或重骰；'); }
    else {
      m[flag] = true;
      const cost = imprint ? 6 : 5, mind = imprint ? 2 : 1;
      if (!pay(cost, mind)) { a.finiteResult = 'INSUFFICIENT'; block(`缺少本人${cost}S与可支付的${mind}M，未施术；`); }
      else {
        if (imprint) m.mentalImprintUses++; else m.insightWindowUses++;
        const c = check(18), name = imprint ? '近距有限心灵印记' : '有限洞察窗口';
        if (c.roll > c.chance) { a.finiteResult = 'FAILED'; a.label = `${name}意志检定${c.roll}>${c.chance}失败，实付${cost}S+${mind}M不退；没有优势、未知记忆或真相结论。`; }
        else if (m.warded) { a.finiteResult = 'WARDED'; a.label = `${name}意志检定${c.roll}≤${c.chance}，但同一原阿尔里克·维尔本轮已实付6S的精神护持仍在，拒绝这次接触；本人实付${cost}S+${mind}M不退，优势0、不泄漏秘密、不判定敌意。`; }
        else {
          const resistance = m.composed ? 70 : 30, prepared = m.composed, n = roll(); a.rolls.push(n); m.composed = false;
          if (n <= resistance) { a.finiteResult = 'RESISTED'; a.label = `${name}意志检定${c.roll}≤${c.chance}，对方${prepared ? '实付3S整理精神的' : '独立普通'}抵抗${n}≤${resistance}G；本人已付${cost}S+${mind}M，优势0，无秘密或全知判断。`; }
          else {
            a.finiteResult = 'APPLIED'; a.mentalPressure = true;
            if (imprint) { m.mentalImprintSuccesses++; a.enemyReduction = 30; }
            else { m.insightWindowSuccesses++; a.selfGain = 42 * mastery; }
            a.label = `${name}意志检定${c.roll}≤${c.chance}、对方抵抗${n}>${resistance}G，实付${cost}S+${mind}M；${imprint ? '仅对当下有限动作形成牵制减势30G' : '仅取得本动作有限观察优势42×掌握G'}，不读取库存或未知记忆、不证明真相或预知未来，动作结束即停止。`;
          }
        }
      }
    }
  }
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
      if (c.roll > c.chance) { a.imageResult = 'FAILED'; a.label = `近真梦像意志检定${c.roll}>${c.chance}失败，6S已付，未使原阿尔里克·维尔相信，无精神后果。`; }
      else {
        const resistance = m.composed ? 70 : 30, prepared = m.composed, n = roll(); a.rolls.push(n); m.composed = false;
        if (n <= resistance) { a.imageResult = prepared ? 'RESISTED' : 'RECOGNIZED'; a.label = `梦像施术${c.roll}≤${c.chance}，但原阿尔里克·维尔${prepared ? '实付过3S的本轮一次精神抵抗' : '凭自己的辨认'}检定${n}≤${resistance}G，未信以为真；本人已付6S，精神损耗0、优势0，原病况不被抵抗治愈。`; }
        else { a.imageResult = 'BELIEVED'; a.mindDamage = Math.min(6, m.enemyMind); m.enemyMind -= a.mindDamage; m.wovenMindDamage += a.mindDamage; a.selfGain = 38 * mastery; a.mentalPressure = true;
          a.label = `梦像施术${c.roll}≤${c.chance}、对方抵抗${n}>${resistance}G，同一原阿尔里克·维尔本次信以为真，精神实际−${a.mindDamage}、余${m.enemyMind}，有限优势38×掌握；没有实体召神、物理伤害或永久控制，梦像本动作结束。`; }
      }
    }
  } else if (id === 'audience.s4.mental-plague' && m.plagueApplications > 0) a.label = '同一原阿尔里克·维尔已经实际播种一次，本槽0消耗不重复播种、不刷新；已有病况仍保留。';
  else if (!pay(4)) strike('本人当前灵性不足4，继承心灵能力未施展；');
  else {
    const island = id === 'audience.s4.mind-island', c = check(island ? 16 : 18);
    if (c.roll > c.chance) a.label = `原阿尔里克·维尔当前心灵抵抗${c.roll}>${c.chance}，已付4S；本次未${island ? '深入心灵或损耗精神' : '造成精神瘟疫'}，无必然控制。`;
    else if (island) { a.mindDamage = Math.min(8, m.enemyMind); m.enemyMind -= a.mindDamage; m.islandMindDamage += a.mindDamage; a.selfGain = 42 * mastery; a.mentalPressure = true;
      a.label = `继承有限心灵岛屿检定${c.roll}≤${c.chance}：已付4S，原阿尔里克·维尔精神实际−${a.mindDamage}、余${m.enemyMind}，优势42×掌握G；本动作已退出，不读取全部记忆或强制驱动行为。`; }
    else { m.mentalPlague = 1; m.plagueApplications = 1; m.infectedRound = source.round; m.lastPlagueRound = source.round; a.mentalPressure = true;
      a.label = `继承有限精神瘟疫检定${c.roll}≤${c.chance}：已付4S，仅同一原阿尔里克·维尔形成病势1G；本轮不提前扣病况精神，后续真实回合−4/8/12M。离场不自动治愈，没有旁人传播或友军免疫。`; }
  }
  return a;
}
function enemyAction(m: RoundModel, planned: DiscernerEnemyIntent, physical: number, order: number): DiscernerEnemyAction {
  const a: DiscernerEnemyAction = { ...actionBase(order, physical), planned, actual: planned }, power = DISCERNER_POWERS.find(p => p.id === planned);
  if (planned === 'COMPOSE' && m.composed) { a.actual = 'OBSERVE'; a.label = '同一原阿尔里克·维尔本轮已有一次未消费精神抵抗，普通观察0贡献0消耗，不叠加抵抗、补S或清除瘟疫。'; }
  else if (power && m.enemySpirituality >= power.cost) {
    m.enemySpirituality -= power.cost; m.powerUses[power.id]++; a.paidCost = power.cost; a.selfGain = power.selfGain; a.enemyReduction = power.enemyReduction; a.threatens = power.selfGain > 0;
    if (planned === 'COMPOSE') m.composed = true;
    if (planned === 'MENTAL_WARD') m.warded = true;
    a.label = `原阿尔里克·维尔本人${power.label}：实际独立原灵性−${power.cost}、余${m.enemySpirituality}/120；${planned === 'COMPOSE' ? '本轮下一次成功施展的梦像、印记或窗口抵抗30%提高到70%G，消费后或本轮结束失效，不无限抵抗' : `贡献${a.selfGain}/减势${a.enemyReduction}G${planned === 'MENTAL_WARD' ? '，本轮余下新印记/窗口接触均可被当前护持拒绝' : ''}`}，不借本人资源。`;
  } else if (planned === 'OBSERVE') a.label = '原阿尔里克·维尔普通观察眼前原身体与出口，0消耗0贡献，没有免费精神抵抗。';
  else if (planned === 'ACCIDENT') { a.selfGain = -22.5; a.label = '原阿尔里克·维尔本槽判断偏差，贡献−22.5G，不重抽。'; }
  else { a.actual = 'BODY_STRIKE'; a.selfGain = 20 * physical; a.threatens = a.selfGain > 0; a.label = `${power ? '独立灵性不足，未施法、不重抽；' : ''}原阿尔里克·维尔用自己的唯一原棍DCR2-ALRIC-CLUB作普通打击20×身体G。`; }
  return a;
}
const allowed = (id: string): id is DiscernerMoveId => DISCERNER_ABILITIES.some(a => a.id === id);
const enemyAllowed = (id: string): id is DiscernerEnemyIntent => DISCERNER_ENEMY_ABILITY_WHEEL.some(a => a.id === id);
export function resolveDiscernerCombatAbility(s: SliceState, id: DiscernerMoveId, physical: number, random: ActionRandomStream,
  r: DiscernerRoundContext, source: DiscernerCombatSource | null = r.source): DiscernerCombatEffect {
  if (!allowed(id) || r.playerActions.length >= 6 || !validRound(s, r, source)) return none('本轮原身体、原阿尔里克·维尔或实际资源来源不符：0贡献0消耗，不重抽。');
  const a = playerAction(r.source, r.model, id, bounded(physical, 1), r.playerActions.length + r.enemyActions.length, () => random.nextInt(1, 100));
  r.playerActions.push(a); commit(s, r); return a;
}
export function resolveDiscernerEnemyAbility(s: SliceState, planned: DiscernerEnemyIntent, physical: number, _random: ActionRandomStream,
  r: DiscernerRoundContext, source: DiscernerCombatSource | null = r.source): DiscernerCombatEffect {
  if (!enemyAllowed(planned) || r.enemyActions.length >= 6 || !validRound(s, r, source)) return none('本轮原阿尔里克·维尔独立身体/资源来源不符：0贡献0消耗，不重抽。');
  const a = enemyAction(r.model, planned, bounded(physical, 1), r.playerActions.length + r.enemyActions.length); r.enemyActions.push(a); commit(s, r); return a;
}
export interface DiscernerRoundOutcome {
  targetId: typeof DISCERNER_TARGET_ID; round: number; source: DiscernerCombatSource; stance: SliceStance; continuing: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number; enemySpiritualityBefore: number;
  powerUses: Record<DiscernerPowerId, number>; enemyMentalPlague: number; plagueApplications: number; infectedRound: number | null; lastPlagueRound: number | null;
  personaGuards: number; identityUses: number; wovenImageUses: number; totalOwnerMindSpent: number;
  mentalImprintUses: number; mentalImprintSuccesses: number; insightWindowUses: number; insightWindowSuccesses: number; ownerMindSpent: number;
  islandMindDamage: number; wovenMindDamage: number; plagueMindDamage: number; identityActiveAfter: false; wovenImageActiveAfter: false; resistanceActiveAfter: false; wardActiveAfter: false;
  elapsedSeconds: 60; playerActions: DiscernerPlayerAction[]; enemyActions: DiscernerEnemyAction[];
}
export function finishDiscernerCombatRound(s: SliceState, r: DiscernerRoundContext, continuing = true): DiscernerRoundOutcome {
  const e = s.discerner.encounter, c = s.combat, m = r.model;
  if (r.finished || !validSource(r.source) || !same(replayActions(r.source, r.playerActions, r.enemyActions), r.model) ||
      r.source.runId !== s.runId || r.source.revision !== s.revision || r.source.week !== s.week ||
      !same(r.source.mastery, Object.fromEntries(DISCERNER_ABILITIES.filter(a => a.id.startsWith('audience.')).map(a => [a.id, bounded(s.progression.mastery[a.id] ?? 0, 500)]))) ||
      r.source.will !== s.character.coreStats.will || r.source.clubHeld !== (s.town.clubLocation === 'HAND') ||
      r.playerSpiritualityBefore !== r.source.playerSpirituality || r.enemySpiritualityBefore !== r.source.enemySpirituality || !c || c.encounterId !== 'DISCERNER_DISPUTE' || c.round !== r.source.round || r.liveState !== liveState(s)) throw new Error('原洞察者回合已结束或实际资源被改写。');
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus; e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk;
  if (e.enemyStatus !== 'RESISTING') e.weaponLocation = 'YARD'; r.finished = true; m.composed = false; m.warded = false;
  return { targetId: DISCERNER_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus,
    playerSpiritualityBefore: r.playerSpiritualityBefore, playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind, enemySpiritualityBefore: r.enemySpiritualityBefore,
    powerUses: { ...e.powerUses }, enemyMentalPlague: e.mentalPlague, plagueApplications: e.plagueApplications, infectedRound: e.infectedRound, lastPlagueRound: e.lastPlagueRound,
    personaGuards: e.personaGuards, identityUses: e.identityUses, wovenImageUses: e.wovenImageUses, totalOwnerMindSpent: e.totalOwnerMindSpent,
    mentalImprintUses: e.mentalImprintUses, mentalImprintSuccesses: e.mentalImprintSuccesses, insightWindowUses: e.insightWindowUses, insightWindowSuccesses: e.insightWindowSuccesses,
    ownerMindSpent: r.source.playerMind - s.mind, islandMindDamage: m.islandMindDamage, wovenMindDamage: m.wovenMindDamage, plagueMindDamage: m.plagueMindDamage,
    identityActiveAfter: false, wovenImageActiveAfter: false, resistanceActiveAfter: false, wardActiveAfter: false, elapsedSeconds: 60,
    playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
}
export function projectDiscernerCombat(s: SliceState) {
  const e = s.discerner.encounter;
  return { enemyName: '阿尔里克·维尔（47岁，原创有限G2非凡者）', targetId: e.targetId, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, mentalPlague: e.mentalPlague,
    mentalImprintUses: e.mentalImprintUses, mentalImprintSuccesses: e.mentalImprintSuccesses, insightWindowUses: e.insightWindowUses, insightWindowSuccesses: e.insightWindowSuccesses,
    powerUses: { ...e.powerUses }, originalExit: true, pursuit: false, distanceMetres: 2, source: currentDiscernerCombatSource(s),
    summary: '新印记6S+2M/意志18、本轮一次，成功且未被当前护持或抵抗拒绝才减势30G；新窗口5S+1M/意志18、本轮一次，成功才优势42×掌握G。失败照付成本，不全知、不判真相。原阿尔里克·维尔身体22G；独立心灵冲击7S/95G、精神护持6S/55G，真实资源不足回退原棍。双方1–6次权重15/20/25/20/15/5；继承观众实际核心体30/感25/意30/知15、1250/底125、灵性120，仅继续轮恢复12（G）。一具身份5S+2M/意志16、至多60秒6米，牵制26后归并，无第二份资源或轮盘；梦像6S/意志18，经本人施术与对方辨认抵抗，实际相信才−6M/优势38×掌握。COMPOSE实付3S令本轮下一次成功梦像、印记或窗口抵抗30%→70%。精神0停战投降不是死亡，身体伤势仍走共同盘，离场不治愈瘟疫。' };
}
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const shape = (value: unknown, keys: readonly string[]): boolean => !!value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join('|') === [...keys].sort().join('|');
function validSource(source: DiscernerCombatSource): boolean {
  return shape(source, ['runId', 'revision', 'week', 'round', 'encounterId', 'targetId', 'attemptWeek', 'startHistoryIndex', 'targetAge', 'targetSequence', 'targetPhysique', 'actualOriginalBody', 'independentMind', 'enemyWeapon', 'weaponLocation', 'distanceMetres', 'space', 'ordinaryExit', 'pursuit', 'noBystanders', 'playerHealth', 'playerMind', 'playerSpirituality', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'clubHeld', 'will', 'mastery', 'powerUses', 'mentalPlague', 'plagueApplications', 'infectedRound', 'lastPlagueRound', 'personaGuards', 'identityUses', 'wovenImageUses', 'totalOwnerMindSpent', 'mentalImprintUses', 'mentalImprintSuccesses', 'insightWindowUses', 'insightWindowSuccesses']) && typeof source.runId === 'string' && integer(source.revision) && integer(source.week, 1) && integer(source.round, 1) && source.attemptWeek === source.week && integer(source.startHistoryIndex) &&
    source.encounterId === 'DISCERNER_DISPUTE' && source.targetId === DISCERNER_TARGET_ID && source.targetAge === 47 && source.targetSequence === 2 && source.targetPhysique === 22 && source.actualOriginalBody === true && source.independentMind === true &&
    source.enemyWeapon === 'DCR2-ALRIC-CLUB' && source.weaponLocation === 'HAND' && source.distanceMetres === 2 && source.space === 'DCR2-OPEN-STONE-YARD' && source.ordinaryExit === true && source.pursuit === false && source.noBystanders === true &&
    [source.playerHealth, source.playerMind, source.enemyHealth, source.enemyMind].every(n => integer(n, 1, 100)) && [source.playerSpirituality, source.enemySpirituality].every(n => integer(n, 0, 120)) && typeof source.clubHeld === 'boolean' && integer(source.will, 0, 500) &&
    (source.round !== 1 || source.enemyHealth === 100 && source.enemyMind === 100) &&
    !!source.mastery && same(Object.keys(source.mastery).sort(), DISCERNER_ABILITIES.filter(a => a.id.startsWith('audience.')).map(a => a.id).sort()) && Object.values(source.mastery).every(n => integer(n, 0, 500)) &&
    shape(source.powerUses, DISCERNER_POWER_IDS) && DISCERNER_POWER_IDS.every(id => integer(source.powerUses[id])) && source.enemySpirituality === 120 - DISCERNER_POWERS.reduce((n, p) => n + source.powerUses[p.id] * p.cost, 0) &&
    DISCERNER_POWER_IDS.reduce((n, id) => n + source.powerUses[id], 0) <= 6 * (source.round - 1) &&
    source.personaGuards + source.identityUses + source.wovenImageUses + source.mentalImprintUses + source.insightWindowUses <= 6 * (source.round - 1) &&
    integer(source.mentalPlague, 0, 3) && integer(source.plagueApplications, 0, 1) && [source.personaGuards, source.identityUses, source.wovenImageUses].every(n => integer(n)) &&
    integer(source.mentalImprintUses, 0, source.round - 1) && integer(source.mentalImprintSuccesses, 0, source.mentalImprintUses) &&
    integer(source.insightWindowUses, 0, source.round - 1) && integer(source.insightWindowSuccesses, 0, source.insightWindowUses) &&
    source.totalOwnerMindSpent === source.personaGuards + 2 * source.identityUses + 2 * source.mentalImprintUses + source.insightWindowUses &&
    (source.plagueApplications === 0 ? source.mentalPlague === 0 && source.infectedRound === null && source.lastPlagueRound === null : integer(source.infectedRound, 1, source.round - 1) && integer(source.lastPlagueRound, source.infectedRound, source.round - 1));
}
/** Replays only this finite encounter's recorded effects, without drawing RNG or mutating a save. */
function replayActions(source: DiscernerCombatSource, playerActions: DiscernerPlayerAction[], enemyActions: DiscernerEnemyAction[]): RoundModel | null {
  try {
    if (!validSource(source) || !Array.isArray(playerActions) || !Array.isArray(enemyActions) || playerActions.length > 6 || enemyActions.length > 6) return null;
    const m = initialModel(source);
    const all = [...playerActions.map(a => ({ actor: 'PLAYER', action: a })), ...enemyActions.map(a => ({ actor: 'ENEMY', action: a }))].sort((a, b) => a.action.order - b.action.order);
    for (const [i, item] of all.entries()) {
      const a = item.action;
      if (m.enemyMind <= 0 || m.playerMind <= 0 || a.order !== i || !Number.isFinite(a.physicalFactor) || a.physicalFactor < 0 || a.physicalFactor > 1 || !Array.isArray(a.rolls) || a.rolls.some(n => !integer(n, 1, 100))) return null;
      let expected: DiscernerPlayerAction | DiscernerEnemyAction;
      if (item.actor === 'PLAYER') {
        const p = a as DiscernerPlayerAction; if (!allowed(p.id)) return null;
        let cursor = 0; expected = playerAction(source, m, p.id, p.physicalFactor, i, () => { const n = a.rolls[cursor++]; if (n === undefined) throw new Error('Missing recorded check'); return n; });
        if (cursor !== a.rolls.length) return null;
      } else { const e = a as DiscernerEnemyAction; if (!enemyAllowed(e.planned)) return null; expected = enemyAction(m, e.planned, e.physicalFactor, i); }
      if (!same(a, expected)) return null;
    }
    return m;
  } catch { return null; }
}
/** Check only this finite encounter's paid actions and mental effects.
 * Physical injury/death remain the existing common combat result. */
export function validateDiscernerRoundOutcome(value: unknown): value is DiscernerRoundOutcome {
  try {
    const o = value as DiscernerRoundOutcome;
    if (!shape(o, ['targetId', 'round', 'source', 'stance', 'continuing', 'enemyHealth', 'enemyMind', 'enemySpirituality', 'enemyStatus', 'playerSpiritualityBefore', 'playerSpiritualityAfter', 'playerHealthAfter', 'playerMindAfter', 'enemySpiritualityBefore', 'powerUses', 'enemyMentalPlague', 'plagueApplications', 'infectedRound', 'lastPlagueRound', 'personaGuards', 'identityUses', 'wovenImageUses', 'totalOwnerMindSpent', 'mentalImprintUses', 'mentalImprintSuccesses', 'insightWindowUses', 'insightWindowSuccesses', 'ownerMindSpent', 'islandMindDamage', 'wovenMindDamage', 'plagueMindDamage', 'identityActiveAfter', 'wovenImageActiveAfter', 'resistanceActiveAfter', 'wardActiveAfter', 'elapsedSeconds', 'playerActions', 'enemyActions']) || !validSource(o.source) || o.targetId !== DISCERNER_TARGET_ID || o.round !== o.source.round || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(o.stance) || typeof o.continuing !== 'boolean' || o.elapsedSeconds !== 60 ||
        ![o.enemyHealth, o.enemyMind, o.playerHealthAfter, o.playerMindAfter].every(n => integer(n, 0, 100)) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(o.enemyStatus) || (o.enemyStatus === 'DEAD') !== (o.enemyHealth === 0) || o.enemyMind === 0 && o.enemyStatus === 'RESISTING' ||
        ![o.playerSpiritualityBefore, o.playerSpiritualityAfter, o.enemySpiritualityBefore, o.enemySpirituality].every(n => integer(n, 0, 120)) || o.playerHealthAfter > o.source.playerHealth || o.enemyHealth > o.source.enemyHealth ||
        o.playerSpiritualityBefore !== o.source.playerSpirituality || o.enemySpiritualityBefore !== o.source.enemySpirituality ||
        !Array.isArray(o.playerActions) || !Array.isArray(o.enemyActions) || o.playerActions.length > 6 || o.enemyActions.length > 6 || o.identityActiveAfter !== false || o.wovenImageActiveAfter !== false || o.resistanceActiveAfter !== false || o.wardActiveAfter !== false ||
        o.continuing && (o.enemyStatus !== 'RESISTING' || o.playerHealthAfter <= 0 || o.playerMindAfter <= 0)) return false;
    const m = replayActions(o.source, o.playerActions, o.enemyActions); if (!m) return false;
    return o.playerSpiritualityAfter === m.playerSpirituality && o.playerMindAfter === m.playerMind && o.enemySpirituality === m.enemySpirituality && o.enemyMind === m.enemyMind && same(o.powerUses, m.powerUses) &&
      o.enemyMentalPlague === m.mentalPlague && o.plagueApplications === m.plagueApplications && o.infectedRound === m.infectedRound && o.lastPlagueRound === m.lastPlagueRound &&
      o.personaGuards === m.personaGuards && o.identityUses === m.identityUses && o.wovenImageUses === m.wovenImageUses && o.totalOwnerMindSpent === m.totalOwnerMindSpent &&
      o.mentalImprintUses === m.mentalImprintUses && o.mentalImprintSuccesses === m.mentalImprintSuccesses && o.insightWindowUses === m.insightWindowUses && o.insightWindowSuccesses === m.insightWindowSuccesses &&
      o.ownerMindSpent === o.source.playerMind - m.playerMind && o.islandMindDamage === m.islandMindDamage && o.wovenMindDamage === m.wovenMindDamage && o.plagueMindDamage === m.plagueMindDamage;
  } catch { return false; }
}
