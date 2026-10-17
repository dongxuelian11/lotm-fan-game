import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import type { MadmanBurstPolicy, MadmanRoundPolicy } from '../madman/combat.js';
import type { SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacActionCount } from '../pyromaniac/combat.js';
import { advanceSilentDiscipleLifeClock } from './life.js';
import { SILENT_DISCIPLE_TARGET_ID, SILENT_DISCIPLE_BLOCK_IDS, SILENT_DISCIPLE_POWERS, SILENT_DISCIPLE_POWER_IDS, hasSilentDiscipleDisputeOpponent,
  type SilentDiscipleBlock, type SilentDiscipleReflection, type SilentDiscipleEnemyIntent, type SilentDisciplePowerId, type SilentDiscipleEncounterScene } from './encounter.js';

/** Original adults, body-changing rules, durations, budgets and all numerical effects are finite G. */
export const SILENT_DISCIPLE_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const SILENT_DISCIPLE_ENEMY_COUNT_WHEEL = PYROMANIAC_COUNT_WHEEL;
export const silentDiscipleActionCount = pyromaniacActionCount;
export const silentDiscipleEnemyActionCount = pyromaniacActionCount;
const H = 'chained.s4.object-motion', J = 'BODY_FOLLOWUP', B = 'GHOST_DODGE', K = 'chained.s3.short-transfiguration';
export type SilentDiscipleMoveId = typeof H | typeof J | typeof B | typeof K | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly { id: SilentDiscipleMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: H, label: '本人新原木块物动：3S／55×旧掌握；无原块或灵性则普通16×身体（H30，G）', weight: 30, stance: 'ATTACK' },
  { id: J, label: '继承身体次击：29.575×钢铁身体掌握×身体，0S（J15，G）', weight: 15, stance: 'ATTACK' },
  { id: B, label: '本槽灵化避让：2S／减势17.55；不足则8×身体（B20，G）', weight: 20, stance: 'DEFEND' },
  { id: K, label: '实接触4S1M／知识18，再短变形5S2M／知识20；可选旧自伤诅咒源4S（K20，G）', weight: 20, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '观察同一身体、原棍及普通出口，0S（R10）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作偏差固定−22.5（A5，G）', weight: 5, stance: null },
];
export const SILENT_DISCIPLE_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'ARC_BOLT', label: '原弧光5S／70G；兔形不能手势，普通无武器10×身体', weight: 35 },
  { id: 'WARD', label: '原屏护4S／减势30G；兔形不能手势，普通无武器10×身体', weight: 25 },
  { id: 'BODY_STRIKE', label: '本人原棍20×身体；无棍或兔形10×身体（G）', weight: 25 },
  { id: 'BREAK_CURSE', label: '心智挣断4S／8G，可破同一身体变形和真实联系', weight: 10 },
  { id: 'ACCIDENT', label: '实际失衡0S／0贡献', weight: 5 },
];
export const isSilentDisciple = (s: SliceState): boolean => s.progression.pathwayId === 'chained' && s.progression.sequence === 3;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function silentDiscipleAbilityWheel(s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, weight: total === 400 ? weights[i]! / 4 : weights[i]! / total * 100,
    label: a.id === H && s.town.clubLocation === 'HAND' ? '持握本人原短棍：普通16×身体，0S、不使用木块（H30）' : a.label }));
}
export function drawSilentDiscipleAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): SilentDiscipleMoveId {
  const weights = tickets(stance); let roll = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (const [i, a] of ABILITIES.entries()) { roll -= weights[i]!; if (roll <= 0) return a.id; }
  throw new Error('沉默门徒动作盘权重无效。');
}
export function drawSilentDiscipleEnemyAbility(random: ActionRandomStream): SilentDiscipleEnemyIntent {
  let roll = random.nextInt(1, 100);
  for (const a of SILENT_DISCIPLE_ENEMY_ABILITY_WHEEL) { roll -= a.weight; if (roll <= 0) return a.id as SilentDiscipleEnemyIntent; }
  throw new Error('原卡尔德动作盘权重无效。');
}
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= min && n <= max;
const bounded = (n: number, max: number) => Math.max(0, Math.min(max, Number.isFinite(n) ? n : 0));
const masteryFactor = (n: number) => .65 + .35 * bounded(n, 500) / 500;
const mastery = (s: SliceState, id: string) => bounded(s.progression.mastery[id] ?? 0, 500);
export interface SilentDiscipleCombatSource {
  runId: string; revision: number; week: number; round: number; encounterId: 'SILENT_DISCIPLE_DISPUTE'; targetId: typeof SILENT_DISCIPLE_TARGET_ID;
  attemptWeek: number; startHistoryIndex: number; playerHealth: number; playerMind: number; playerSpirituality: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyInjuries: SliceInjury[]; enemyRisk: number; knowledge: number;
  clubLocation: SliceState['town']['clubLocation']; actualOriginalBody: true; mutuallyVisible: true; independentMind: true;
  distanceMetres: 2; noBystanders: true; ordinaryExit: true; pursuit: false; targetAge: 47; targetSequence: 4; targetPhysique: 22;
  enemyWeapon: 'SD3-CALDER-ROD'; weaponOwner: typeof SILENT_DISCIPLE_TARGET_ID; weaponLocation: 'HAND' | 'COURT'; space: 'SD3-COURT';
  blocksPurchased: boolean; blocks: SilentDiscipleBlock[]; link: 'NONE' | 'LINKED'; linkRound: number | null; lastFormRound: number | null;
  contactAttempts: number; formAttempts: number; breakLinkUses: number; contactDistanceMetres: number; enemyForm: 'HUMAN';
  enemyFormUntilSeconds: null; transfigurationAttempts: number; transfigurationSuccesses: number; pickUpUses: number;
  objectMastery: number; bodyMastery: number; burstMastery: number; powerUses: Record<SilentDisciplePowerId, number>;
  lifeClockSeconds: number; scene: SilentDiscipleEncounterScene;
}
export function currentSilentDiscipleCombatSource(s: SliceState): SilentDiscipleCombatSource | null {
  if (!hasSilentDiscipleDisputeOpponent(s)) return null;
  const e = s.silentDisciple.encounter, c = s.combat!;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'SILENT_DISCIPLE_DISPUTE', targetId: SILENT_DISCIPLE_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, playerHealth: s.health, playerMind: s.mind, playerSpirituality: s.spirituality,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyInjuries: structuredClone(c.enemyInjuries), enemyRisk: c.enemyRisk,
    knowledge: s.character.coreStats.knowledge, clubLocation: s.town.clubLocation, actualOriginalBody: true, mutuallyVisible: true, independentMind: true,
    distanceMetres: 2, noBystanders: true, ordinaryExit: true, pursuit: false, targetAge: 47, targetSequence: 4, targetPhysique: 22,
    enemyWeapon: 'SD3-CALDER-ROD', weaponOwner: SILENT_DISCIPLE_TARGET_ID, weaponLocation: e.weaponLocation, space: 'SD3-COURT',
    blocksPurchased: e.blocksPurchased, blocks: structuredClone(e.blocks), link: e.link, linkRound: e.linkRound, lastFormRound: e.lastFormRound,
    contactAttempts: e.contactAttempts, formAttempts: e.formAttempts, breakLinkUses: e.breakLinkUses, contactDistanceMetres: e.contactDistanceMetres,
    enemyForm: e.enemyForm as 'HUMAN', enemyFormUntilSeconds: e.enemyFormUntilSeconds as null,
    transfigurationAttempts: e.transfigurationAttempts, transfigurationSuccesses: e.transfigurationSuccesses, pickUpUses: e.pickUpUses,
    objectMastery: mastery(s, H), bodyMastery: mastery(s, 'chained.s6.steel-body'), burstMastery: mastery(s, 'chained.s8.reason-sacrifice'),
    powerUses: { ...e.powerUses }, lifeClockSeconds: s.silentDisciple.life.clockSeconds, scene: structuredClone(e.scene) };
}
export interface SilentDiscipleCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
export interface SilentDisciplePlayerAction extends SilentDiscipleCombatEffect {
  order: number; id: SilentDiscipleMoveId; paidCost: number; physicalFactor: number; blockId: SilentDiscipleBlock['id'] | null;
  checkChance: number | null; checkRoll: number | null; contactAttempted: boolean; formAttempted: boolean; succeeded: boolean;
  mode: 'ORDINARY' | 'CONTACT' | 'TARGET_FORM' | 'SELF_FORM'; burstTriggered: boolean; mentalCost: number; burstSpiritualCost: number;
  enemyFormBefore: 'HUMAN' | 'RABBIT'; enemyFormAfter: 'HUMAN' | 'RABBIT'; weaponBefore: 'HAND' | 'COURT'; weaponAfter: 'HAND' | 'COURT';
}
export interface SilentDiscipleEnemyAction extends SilentDiscipleCombatEffect {
  order: number; planned: SilentDiscipleEnemyIntent; actual: SilentDiscipleEnemyIntent | 'PICK_UP'; paidCost: number; physicalFactor: number;
  linkBroken: boolean; formBroken: boolean; enemyFormBefore: 'HUMAN' | 'RABBIT'; enemyFormAfter: 'HUMAN' | 'RABBIT';
  weaponBefore: 'HAND' | 'COURT'; weaponAfter: 'HAND' | 'COURT';
}
interface Resources {
  playerS: number; playerM: number; enemyS: number; blocks: SilentDiscipleBlock[]; link: 'NONE' | 'LINKED'; linkRound: number | null;
  lastFormRound: number | null; contacts: number; forms: number; breaks: number; selfForm: 'HUMAN' | 'WOOD';
  enemyForm: 'HUMAN' | 'RABBIT'; until: number | null; weapon: 'HAND' | 'COURT'; transfigurations: number; successes: number; pickups: number;
  uses: Record<SilentDisciplePowerId, number>; madman: MadmanRoundPolicy;
}
function resources(x: SilentDiscipleCombatSource, policy: MadmanBurstPolicy): Resources {
  return { playerS: x.playerSpirituality, playerM: x.playerMind, enemyS: x.enemySpirituality, blocks: structuredClone(x.blocks),
    link: x.link === 'LINKED' && x.linkRound !== null && x.round <= x.linkRound + 2 ? 'LINKED' : 'NONE', linkRound: x.linkRound,
    lastFormRound: x.lastFormRound, contacts: x.contactAttempts, forms: x.formAttempts, breaks: x.breakLinkUses, selfForm: 'HUMAN',
    enemyForm: x.enemyForm, until: x.enemyFormUntilSeconds, weapon: x.weaponLocation, transfigurations: x.transfigurationAttempts,
    successes: x.transfigurationSuccesses, pickups: x.pickUpUses, uses: { ...x.powerUses }, madman: { policy, triggered: false, mentalCost: 0, spiritualCost: 0 } };
}
const none = (label: string): SilentDiscipleCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
function attemptKind(x: SilentDiscipleCombatSource, q: Resources, id: SilentDiscipleMoveId, curse: boolean): 'CONTACT' | 'SELF_FORM' | 'TARGET_FORM' | null {
  if (id !== K) return null;
  if (q.link !== 'LINKED') return q.playerS >= 4 && q.playerM >= 1 ? 'CONTACT' : null;
  if (q.lastFormRound === x.round) return null;
  return curse ? q.playerS >= 4 ? 'SELF_FORM' : null : q.playerS >= 5 && q.playerM >= 2 && q.enemyForm === 'HUMAN' ? 'TARGET_FORM' : null;
}
function playerAction(x: SilentDiscipleCombatSource, q: Resources, id: SilentDiscipleMoveId, physical: number, curse: boolean, roll: number | null, order: number): SilentDisciplePlayerAction {
  const a: SilentDisciplePlayerAction = { ...none(''), order, id, paidCost: 0, physicalFactor: physical, blockId: null,
    checkChance: null, checkRoll: null, contactAttempted: false, formAttempted: false, succeeded: false, mode: 'ORDINARY',
    burstTriggered: false, mentalCost: 0, burstSpiritualCost: 0, enemyFormBefore: q.enemyForm, enemyFormAfter: q.enemyForm, weaponBefore: q.weapon, weaponAfter: q.weapon };
  const body = (gain: number, label: string) => {
    a.selfGain = gain; a.threatens = gain > 0; a.label = label;
    if (gain > 0 && q.madman.policy === 'BURST_FIRST' && !q.madman.triggered && q.playerM >= 10 && q.playerS >= 2) {
      q.playerS -= 2; q.playerM -= 10; q.madman.triggered = true; q.madman.mentalCost = 10; q.madman.spiritualCost = 2;
      a.selfGain *= 1 + .25 * masteryFactor(x.burstMastery); a.burstTriggered = true; a.mentalCost = 10; a.burstSpiritualCost = 2;
      a.label += '；本轮主动首次旧疯子爆发，实际另付2S10M，不自动返还。';
    } else a.label += '；未发生额外爆发费用。';
  };
  if (id === 'ACCIDENT') { a.selfGain = -22.5; a.label = '动作偏差固定−22.5（G），0费用。'; }
  else if (id === J) body(29.575 * masteryFactor(x.bodyMastery) * physical, '继承身体次击29.575×钢铁身体旧掌握×身体（G），占本槽、基础0S');
  else if (id === H) {
    const block = q.blocks.find(b => b.status === 'READY');
    if (x.clubLocation === 'HAND') body(16 * physical, '持握本人原短棍普通16×身体（G），0S，不使用木块或夺敌原棍');
    else if (!block || q.playerS < 3) body(16 * physical, '没有本人READY原木块或不足3S，普通身体16×身体（G），0S，不补旧块');
    else { q.playerS -= 3; a.paidCost = 3; a.blockId = block.id; block.status = 'SPENT'; block.location = 'TARGET_GROUND'; block.usedRound = x.round;
      a.selfGain = 55 * masteryFactor(x.objectMastery); a.threatens = true;
      a.label = `${block.id}本人唯一原木块实际从SOURCE移到2米外TARGET_GROUND，实付3S、55×旧物动掌握（G）；原物用后留原地，不复制或免费回箱。`; }
  } else if (id === B) {
    if (q.playerS >= 2) { q.playerS -= 2; a.paidCost = 2; a.enemyReduction = 17.55; a.label = '继承本槽短暂灵化避让，实付2S、减势17.55（G）；同一原身体当次显形，不治疗或跨槽免伤。'; }
    else { a.enemyReduction = 8 * physical; a.label = '不足2S，普通格挡8×身体（G），0费用。'; }
  } else if (id === K) {
    const mode = attemptKind(x, q, id, curse);
    if (!mode) a.label = '当前联系／本轮尝试／实际资源不满足下一步：普通观察0贡献0费用，不重试同轮变形或延长原窗口。';
    else {
      a.mode = mode; a.paidCost = mode === 'TARGET_FORM' ? 5 : 4; a.mentalCost = mode === 'CONTACT' ? 1 : mode === 'TARGET_FORM' ? 2 : 0;
      q.playerS -= a.paidCost; q.playerM -= a.mentalCost; a.checkRoll = roll;
      a.checkChance = computeCheckChance({ ability: 'knowledge', baseAbility: x.knowledge, difficulty: mode === 'TARGET_FORM' ? 20 : 18, modifiers: [] });
      a.succeeded = roll !== null && roll <= a.checkChance;
      if (mode === 'CONTACT') {
        a.contactAttempted = true; q.contacts++;
        if (a.succeeded) { q.link = 'LINKED'; q.linkRound = x.round; }
        a.label = `实际接近2米接触同一原卡尔德，再原路返回2米，共4米（G）；实付4S1M，知识18：${roll}/${a.checkChance}。${a.succeeded ? '当前真实联系建立，有效至本轮后两轮末' : '原敌抵抗，联系未成、费用照付'}，没有伤害或控制。`;
      } else {
        a.formAttempted = true; q.forms++; q.lastFormRound = x.round;
        if (mode === 'SELF_FORM') {
          if (a.succeeded) q.selfForm = 'WOOD';
          a.label = `主动选择旧本人诅咒源，沿用实际4S、0M与知识18：${roll}/${a.checkChance}。${a.succeeded ? '自己的同一原身体成为WOOD，原伤与资源保留；之后本人真实轻重伤10/30才可能映射5/15' : '遭抵抗仍人形，费用不退'}；绝非零自伤或免死。`;
        } else {
          q.transfigurations++;
          if (a.succeeded) { q.successes++; q.enemyForm = 'RABBIT'; q.until = x.lifeClockSeconds + 60; q.weapon = 'COURT'; }
          a.label = `实付5S2M、知识20：${roll}/${a.checkChance}。${a.succeeded ? '同一原卡尔德身体短变RABBIT，原健康精神灵性和全部伤势不变，原棍实际掉落COURT仍归他；真实60秒到期复原，后续拾棍须另占一槽' : '原卡尔德抵抗、保持原人形，实付费用不退'}（有限G），不影响此前已执行动作、不叠加或续期。`;
        }
      }
    }
  } else a.label = `普通观察原卡尔德${q.enemyForm}、原棍${q.weapon}、当前联系${q.link}和4米开放出口；0费用0贡献。`;
  a.enemyFormAfter = q.enemyForm; a.weaponAfter = q.weapon; return a;
}
function enemyAction(_x: SilentDiscipleCombatSource, q: Resources, planned: SilentDiscipleEnemyIntent, physical: number, order: number): SilentDiscipleEnemyAction {
  const a: SilentDiscipleEnemyAction = { ...none(''), order, planned, actual: planned, paidCost: 0, physicalFactor: physical,
    linkBroken: false, formBroken: false, enemyFormBefore: q.enemyForm, enemyFormAfter: q.enemyForm, weaponBefore: q.weapon, weaponAfter: q.weapon };
  if (q.enemyForm === 'HUMAN' && q.weapon === 'COURT') {
    a.actual = 'PICK_UP'; q.weapon = 'HAND'; q.pickups++; a.label = '同一原卡尔德实际拾起自己落在原院的唯一原棍，本次PICK_UP独占一槽，0攻击0S；不同时执行已抽原法术。';
  } else if (planned === 'ACCIDENT') a.label = '原卡尔德实际失衡，0贡献0费用，不恢复灵性。';
  else {
    const power = SILENT_DISCIPLE_POWERS.find(p => p.id === planned);
    const handsBlocked = q.enemyForm === 'RABBIT' && (planned === 'ARC_BOLT' || planned === 'WARD');
    if (power && !handsBlocked && q.enemyS >= power.cost) {
      a.paidCost = power.cost; q.enemyS -= power.cost; q.uses[power.id]++; a.selfGain = power.selfGain; a.enemyReduction = power.enemyReduction;
      a.threatens = planned === 'ARC_BOLT';
      if (planned === 'BREAK_CURSE') {
        a.linkBroken = q.link === 'LINKED'; a.formBroken = q.enemyForm === 'RABBIT'; q.link = 'NONE'; q.enemyForm = 'HUMAN'; q.until = null; q.breaks++;
      }
      a.label = `原卡尔德实际${power.label}，实付${power.cost}S、余${q.enemyS}/120${planned === 'BREAK_CURSE' ? '；本槽精神挣断真实联系及自己的当前兔形，原棍保持原位置，已发动作不撤销' : ''}（G）。`;
    } else {
      a.actual = 'BODY_STRIKE'; const armed = q.enemyForm === 'HUMAN' && q.weapon === 'HAND';
      a.selfGain = (armed ? 20 : 10) * physical; a.threatens = a.selfGain > 0;
      a.label = `${handsBlocked ? '同一兔形身体不能执行原手势法术' : power ? '原法术灵性不足' : '原身体行动'}，实际${armed ? '持自己原棍20' : '无武器10'}×身体（G），0S；不凭空拿棍或补资源。`;
    }
  }
  a.enemyFormAfter = q.enemyForm; a.weaponAfter = q.weapon; return a;
}
export interface SilentDiscipleRoundContext {
  source: SilentDiscipleCombatSource; stance: SliceStance; cursePolicy: boolean; madman: MadmanRoundPolicy; finished: boolean; liveState: string;
  playerSpiritualityBefore: number; enemySpiritualityBefore: number; playerActions: SilentDisciplePlayerAction[]; enemyActions: SilentDiscipleEnemyAction[];
  reflection: SilentDiscipleReflection | null; label: string; resources: Resources;
}
function liveState(s: SliceState): string {
  const e = s.silentDisciple.encounter;
  return stableStringify({ spirituality: s.spirituality, mind: s.mind, encounter: e, clock: s.silentDisciple.life.clockSeconds });
}
function sync(s: SliceState, r: SilentDiscipleRoundContext): void {
  const e = s.silentDisciple.encounter, q = r.resources;
  s.spirituality = q.playerS; s.mind = q.playerM; e.enemySpirituality = q.enemyS; e.blocks = structuredClone(q.blocks);
  e.link = q.link; e.linkRound = q.linkRound; e.lastFormRound = q.lastFormRound; e.contactAttempts = q.contacts; e.formAttempts = q.forms;
  e.breakLinkUses = q.breaks; e.contactDistanceMetres = q.contacts * 4; e.form = q.selfForm; e.enemyForm = q.enemyForm; e.enemyFormUntilSeconds = q.until;
  e.weaponLocation = q.weapon; e.transfigurationAttempts = q.transfigurations; e.transfigurationSuccesses = q.successes; e.pickUpUses = q.pickups;
  e.powerUses = { ...q.uses }; r.madman = { ...q.madman }; r.liveState = liveState(s);
}
const dynamicSource = new Set(['playerMind', 'playerSpirituality', 'enemySpirituality', 'blocks', 'link', 'linkRound', 'lastFormRound', 'contactAttempts', 'formAttempts', 'breakLinkUses', 'contactDistanceMetres', 'powerUses', 'enemyForm', 'enemyFormUntilSeconds', 'weaponLocation', 'transfigurationAttempts', 'transfigurationSuccesses', 'pickUpUses']);
function validRound(s: SliceState, r: SilentDiscipleRoundContext, source: SilentDiscipleCombatSource | null): boolean {
  const current = currentSilentDiscipleCombatSource(s);
  return !r.finished && !!current && !!source && same(source, r.source) && r.liveState === liveState(s) &&
    Object.entries(r.source).every(([k, v]) => dynamicSource.has(k) || same(current[k as keyof SilentDiscipleCombatSource], v));
}
export function beginSilentDiscipleCombatRound(s: SliceState, stance: SliceStance, cursePolicy = false, madmanPolicy: MadmanBurstPolicy = 'HOLD'): SilentDiscipleRoundContext {
  const source = currentSilentDiscipleCombatSource(s);
  if (!source || s.silentDisciple.encounter.form !== 'HUMAN' || source.enemyForm !== 'HUMAN' || source.enemyFormUntilSeconds !== null) throw new Error('缺少沉默门徒同一原卡尔德、原身体或已收束上一回合来源。');
  if (typeof cursePolicy !== 'boolean' || !['HOLD', 'BURST_FIRST'].includes(madmanPolicy)) throw new TypeError('本轮沉默门徒策略无效。');
  const q = resources(source, madmanPolicy);
  return { source, stance, cursePolicy, madman: { ...q.madman }, finished: false, liveState: liveState(s), resources: q,
    playerSpiritualityBefore: s.spirituality, enemySpiritualityBefore: source.enemySpirituality, playerActions: [], enemyActions: [], reflection: null,
    label: `同一原卡尔德在原院2米外；本轮${cursePolicy ? '明确选择旧本人诅咒源与真实自伤风险' : '默认有限目标变形，不主动启用本人自伤诅咒源'}，疯子策略${madmanPolicy}，普通出口4米开放（G）。` };
}
export function resolveSilentDiscipleCombatAbility(s: SliceState, id: SilentDiscipleMoveId, physicalStateFactor: number, random: ActionRandomStream,
  r: SilentDiscipleRoundContext, source: SilentDiscipleCombatSource | null = r.source): SilentDiscipleCombatEffect {
  if (!validRound(s, r, source) || !ABILITIES.some(a => a.id === id) || r.playerActions.length >= 6) return none('缺少本轮同一身体、实际资源来源或已无动作槽；0贡献0消耗，不重抽。');
  const roll = attemptKind(r.source, r.resources, id, r.cursePolicy) ? random.nextInt(1, 100) : null;
  const a = playerAction(r.source, r.resources, id, bounded(physicalStateFactor, 1), r.cursePolicy, roll, r.playerActions.length + r.enemyActions.length);
  r.playerActions.push(a); sync(s, r); return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens };
}
export function resolveSilentDiscipleEnemyAbility(s: SliceState, planned: SilentDiscipleEnemyIntent, physicalStateFactor: number, _random: ActionRandomStream,
  r: SilentDiscipleRoundContext, source: SilentDiscipleCombatSource | null = r.source): SilentDiscipleCombatEffect {
  if (!validRound(s, r, source) || ![...SILENT_DISCIPLE_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned) || r.enemyActions.length >= 6) return none('缺少本轮同一原卡尔德来源或已无动作槽，原敌不补资源。');
  const a = enemyAction(r.source, r.resources, planned, bounded(physicalStateFactor, 1), r.playerActions.length + r.enemyActions.length);
  r.enemyActions.push(a); sync(s, r); return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens };
}
/** Called only after common injury has really reduced the player's one original body. No costless reflection. */
export function reflectSilentDiscipleActualWound(s: SliceState, injury: SliceInjury, r: SilentDiscipleRoundContext): SilentDiscipleReflection | null {
  const e = s.silentDisciple.encounter, c = s.combat;
  if (r.finished || r.reflection || !r.cursePolicy || !c || c.encounterId !== 'SILENT_DISCIPLE_DISPUTE' || c.round !== r.source.round ||
      r.liveState !== liveState(s) || e.form !== 'WOOD' || e.link !== 'LINKED' || e.linkRound === null || c.round > e.linkRound + 2 ||
      !s.injuries.some(i => i.id === injury.id && same(i, injury)) || injury.acquiredRevision !== s.revision + 1 || !['LIGHT', 'HEAVY'].includes(injury.severity)) return null;
  const playerDamage = injury.severity === 'LIGHT' ? 10 : 30, enemyDamage = injury.severity === 'LIGHT' ? 5 : 15;
  if (s.health !== Math.max(0, r.source.playerHealth - playerDamage)) return null;
  const enemyInjury: SliceInjury = { id: `${s.runId}:silent-disciple-reflection:${c.round}:${s.revision + 1}`, severity: injury.severity, acquiredRevision: s.revision + 1, treatedRevision: null };
  c.enemyHealth = Math.max(0, c.enemyHealth - enemyDamage); c.enemyInjuries.push(enemyInjury); if (c.enemyHealth === 0) c.enemyStatus = 'DEAD';
  const reflection: SilentDiscipleReflection = { round: c.round, severity: injury.severity, playerDamage, enemyDamage, playerInjuryId: injury.id, enemyInjuryId: enemyInjury.id };
  e.reflectionHistory.push(reflection); r.reflection = structuredClone(reflection); r.liveState = liveState(s); return reflection;
}
export interface SilentDiscipleRoundOutcome {
  targetId: typeof SILENT_DISCIPLE_TARGET_ID; round: number; source: SilentDiscipleCombatSource; stance: SliceStance; continuing: boolean; cursePolicy: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuriesAfter: SliceInjury[]; enemyRiskAfter: number;
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number;
  enemySpiritualityBefore: number; powerUses: Record<SilentDisciplePowerId, number>; blocks: SilentDiscipleBlock[];
  form: 'HUMAN'; enemyForm: 'HUMAN'; enemyFormUntilSeconds: null; weaponLocation: 'HAND' | 'COURT'; link: 'NONE' | 'LINKED'; linkRound: number | null; lastFormRound: number | null;
  contactAttempts: number; formAttempts: number; breakLinkUses: number; contactDistanceMetres: number; transfigurationAttempts: number; transfigurationSuccesses: number; pickUpUses: number;
  reflection: SilentDiscipleReflection | null; madmanBurst: MadmanRoundPolicy; playerActions: SilentDisciplePlayerAction[]; enemyActions: SilentDiscipleEnemyAction[];
  elapsedSeconds: 60; lifeClockSecondsAfter: number; sceneAfter: SilentDiscipleEncounterScene;
}
export function finishSilentDiscipleCombatRound(s: SliceState, r: SilentDiscipleRoundContext, continuing = true): SilentDiscipleRoundOutcome {
  if (r.finished || s.combat?.encounterId !== 'SILENT_DISCIPLE_DISPUTE' || s.combat.round !== r.source.round || r.liveState !== liveState(s)) throw new Error('原回合已结束、不存在或资源被改写。');
  const e = s.silentDisciple.encounter, c = s.combat;
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus; e.enemyInjuries = structuredClone(c.enemyInjuries); e.enemyRisk = c.enemyRisk;
  advanceSilentDiscipleLifeClock(s, 60); e.form = 'HUMAN'; e.enemyForm = 'HUMAN'; e.enemyFormUntilSeconds = null;
  if (c.enemyHealth === 0) e.weaponLocation = 'COURT';
  if (!continuing || (e.link === 'LINKED' && (e.linkRound === null || c.round >= e.linkRound + 2))) e.link = 'NONE';
  // An ordinary4m exit occupies the tail of the actual60s round; it never teleports a dead body.
  if (!continuing && s.health > 0) { e.scene.playerPosition = 'EXIT'; e.scene.ordinaryWalkedMetres += 4; }
  r.finished = true;
  return { targetId: SILENT_DISCIPLE_TARGET_ID, round: c.round, source: structuredClone(r.source), stance: r.stance, continuing, cursePolicy: r.cursePolicy,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus, enemyInjuriesAfter: structuredClone(e.enemyInjuries), enemyRiskAfter: e.enemyRisk,
    playerSpiritualityBefore: r.playerSpiritualityBefore, playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind,
    enemySpiritualityBefore: r.enemySpiritualityBefore, powerUses: { ...e.powerUses }, blocks: structuredClone(e.blocks), form: 'HUMAN', enemyForm: 'HUMAN', enemyFormUntilSeconds: null,
    weaponLocation: e.weaponLocation, link: e.link, linkRound: e.linkRound, lastFormRound: e.lastFormRound, contactAttempts: e.contactAttempts, formAttempts: e.formAttempts,
    breakLinkUses: e.breakLinkUses, contactDistanceMetres: e.contactDistanceMetres, transfigurationAttempts: e.transfigurationAttempts, transfigurationSuccesses: e.transfigurationSuccesses, pickUpUses: e.pickUpUses,
    reflection: structuredClone(r.reflection), madmanBurst: { ...r.madman }, playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions),
    elapsedSeconds: 60, lifeClockSecondsAfter: s.silentDisciple.life.clockSeconds, sceneAfter: structuredClone(e.scene) };
}
export function projectSilentDiscipleCombat(s: SliceState) {
  const e = s.silentDisciple.encounter;
  return { enemyName: '卡尔德·里德（SD3-CALDER，47岁原创成年序列4对手，G）', targetId: e.targetId, enemySpirituality: e.enemySpirituality,
    powerUses: { ...e.powerUses }, blocksPurchased: e.blocksPurchased, blocks: structuredClone(e.blocks), form: e.form, enemyForm: e.enemyForm,
    enemyFormUntilSeconds: e.enemyFormUntilSeconds, weaponLocation: e.weaponLocation, link: e.link, linkRound: e.linkRound,
    contactAttempts: e.contactAttempts, formAttempts: e.formAttempts, breakLinkUses: e.breakLinkUses, contactDistanceMetres: e.contactDistanceMetres,
    reflectionHistory: structuredClone(e.reflectionHistory), enemyInjuries: structuredClone(e.enemyInjuries), originalExit: true, pursuit: false, distanceMetres: 2,
    source: currentSilentDiscipleCombatSource(s), enemyCountWheel: SILENT_DISCIPLE_ENEMY_COUNT_WHEEL, enemyAbilityWheel: SILENT_DISCIPLE_ENEMY_ABILITY_WHEEL,
    summary: `同一原卡尔德H${e.enemyHealth}/M${e.enemyMind}/S${e.enemySpirituality}，${e.enemyForm}、原棍${e.weaponLocation}；新三原块READY${e.blocks.filter(b => b.status === 'READY').length}，联系${e.link}，本人${e.form}。默认K实接触4S1M/知识18，随后目标短变形5S2M/知识20；真实60秒原身体复原，原棍留场，下一人形动作实际拾棍占一槽。敌可付4S精神挣断。主动旧本人诅咒源另4S/知识18，只有本人真实轻重伤10/30后映射5/15，默认关闭，无零自伤反射。4米普通出口开放，旧人旧物旧伤不变（G）。` };
}
export function validSilentDiscipleCombatScene(v: unknown): v is SilentDiscipleEncounterScene {
  if (!v || typeof v !== 'object') return false;
  const x = v as SilentDiscipleEncounterScene;
  return x.courtId === 'SD3-COURT' && x.ordinaryExit === 'OPEN' && x.thirdPartiesInArea === 0 && typeof x.clearanceConfirmed === 'boolean' &&
    ['COURT', 'EXIT'].includes(x.playerPosition) && x.distanceMetres === 2 && x.exitMetres === 4 && [0, 4].includes(x.ordinaryWalkedMetres);
}
export function validateSilentDiscipleBlocks(v: unknown, purchased: boolean, round = Number.MAX_SAFE_INTEGER): v is SilentDiscipleBlock[] {
  return Array.isArray(v) && v.length === (purchased ? 3 : 0) && v.every((b: SilentDiscipleBlock, i) => b && b.id === SILENT_DISCIPLE_BLOCK_IDS[i] && b.owner === 'PLAYER' &&
    (b.status === 'READY' ? b.location === 'SOURCE' && b.usedRound === null : b.status === 'SPENT' && b.location === 'TARGET_GROUND' && integer(b.usedRound, 1, round)));
}
const usesValid = (u: Record<SilentDisciplePowerId, number>) => u && typeof u === 'object' && Object.keys(u).length === 3 && SILENT_DISCIPLE_POWER_IDS.every(id => integer(u[id], 0, 30));
/** The same finite slot kernel replays costs, checks, body identity, order, weapon drops and actual pickup. */
export function validateSilentDiscipleRoundOutcome(v: unknown): v is SilentDiscipleRoundOutcome {
  try {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
    const p = v as SilentDiscipleRoundOutcome, a = p.source;
    if (!a || a.targetId !== SILENT_DISCIPLE_TARGET_ID || a.encounterId !== 'SILENT_DISCIPLE_DISPUTE' || a.round !== p.round || !integer(p.round, 1) ||
      typeof a.runId !== 'string' || !a.runId || !integer(a.revision) || !integer(a.week, 1) || a.attemptWeek !== a.week || !integer(a.startHistoryIndex) ||
      !integer(a.playerHealth, 1, 100) || !integer(a.playerMind, 0, 100) || !integer(a.enemyHealth, 1, 100) || !integer(a.enemyMind, 1, 100) || !integer(a.knowledge, 0, 10000) ||
      !['SHOP', 'BAG', 'HAND'].includes(a.clubLocation) || a.actualOriginalBody !== true || a.mutuallyVisible !== true || a.independentMind !== true || a.distanceMetres !== 2 || a.noBystanders !== true ||
      a.ordinaryExit !== true || a.pursuit !== false || a.targetAge !== 47 || a.targetSequence !== 4 || a.targetPhysique !== 22 || a.enemyWeapon !== 'SD3-CALDER-ROD' || a.weaponOwner !== SILENT_DISCIPLE_TARGET_ID ||
      !['HAND', 'COURT'].includes(a.weaponLocation) || a.space !== 'SD3-COURT' || a.enemyForm !== 'HUMAN' || a.enemyFormUntilSeconds !== null ||
      ![a.objectMastery, a.bodyMastery, a.burstMastery].every(n => integer(n, 0, 500)) || !usesValid(a.powerUses) || typeof a.blocksPurchased !== 'boolean' || !validateSilentDiscipleBlocks(a.blocks, a.blocksPurchased, p.round - 1) ||
      !['NONE', 'LINKED'].includes(a.link) || ![a.contactAttempts, a.formAttempts, a.breakLinkUses, a.transfigurationAttempts, a.transfigurationSuccesses, a.pickUpUses].every(n => integer(n)) ||
      a.breakLinkUses !== a.powerUses.BREAK_CURSE || a.contactDistanceMetres !== a.contactAttempts * 4 || a.transfigurationSuccesses > a.transfigurationAttempts || a.transfigurationAttempts > a.formAttempts || a.pickUpUses > a.transfigurationSuccesses ||
      (a.linkRound === null ? a.link !== 'NONE' : !integer(a.linkRound, 1, p.round - 1) || a.contactAttempts === 0) ||
      (a.lastFormRound === null ? a.formAttempts !== 0 : !integer(a.lastFormRound, 1, p.round - 1) || a.formAttempts === 0) ||
      (a.link === 'LINKED' && (a.linkRound === null || p.round > a.linkRound + 2)) || !integer(a.lifeClockSeconds) || !validSilentDiscipleCombatScene(a.scene) || !a.scene.clearanceConfirmed || a.scene.playerPosition !== 'COURT' || a.scene.ordinaryWalkedMetres !== 0 ||
      !Array.isArray(a.enemyInjuries) || !integer(a.enemyRisk) || !Array.isArray(p.enemyInjuriesAfter) || !integer(p.enemyRiskAfter)) return false;
    if (p.targetId !== SILENT_DISCIPLE_TARGET_ID || !['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'].includes(p.stance) || !integer(p.enemyHealth, 0, a.enemyHealth) || p.enemyMind !== a.enemyMind ||
      ![a.playerSpirituality, a.enemySpirituality, p.playerSpiritualityAfter, p.enemySpirituality].every(n => integer(n, 0, 120)) || p.playerSpiritualityBefore !== a.playerSpirituality || p.enemySpiritualityBefore !== a.enemySpirituality ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(p.enemyStatus) || (p.enemyStatus === 'DEAD') !== (p.enemyHealth === 0) || !integer(p.playerHealthAfter, 0, a.playerHealth) || !integer(p.playerMindAfter, 0, a.playerMind) || !usesValid(p.powerUses) ||
      a.enemySpirituality !== 120 - SILENT_DISCIPLE_POWERS.reduce((n, x) => n + a.powerUses[x.id] * x.cost, 0) || p.enemySpirituality !== 120 - SILENT_DISCIPLE_POWERS.reduce((n, x) => n + p.powerUses[x.id] * x.cost, 0) ||
      p.form !== 'HUMAN' || p.enemyForm !== 'HUMAN' || p.enemyFormUntilSeconds !== null || typeof p.cursePolicy !== 'boolean' || typeof p.continuing !== 'boolean' || (p.continuing && (p.enemyStatus !== 'RESISTING' || p.playerHealthAfter <= 0)) ||
      !Array.isArray(p.playerActions) || p.playerActions.length > 6 || !Array.isArray(p.enemyActions) || p.enemyActions.length > 6 || !p.madmanBurst || !['HOLD', 'BURST_FIRST'].includes(p.madmanBurst.policy) ||
      p.elapsedSeconds !== 60 || p.lifeClockSecondsAfter !== a.lifeClockSeconds + 60) return false;
    const q = resources(a, p.madmanBurst.policy);
    const ordered = [...p.playerActions.map(action => ({ kind: 'PLAYER' as const, action })), ...p.enemyActions.map(action => ({ kind: 'ENEMY' as const, action }))].sort((x, y) => x.action.order - y.action.order);
    for (const [index, entry] of ordered.entries()) {
      const x = entry.action;
      if (x.order !== index || !Number.isFinite(x.physicalFactor) || x.physicalFactor < 0 || x.physicalFactor > 1) return false;
      if (entry.kind === 'PLAYER') {
        const y = entry.action;
        if (!ABILITIES.some(m => m.id === y.id) || (attemptKind(a, q, y.id, p.cursePolicy) ? !integer(y.checkRoll, 1, 100) : y.checkRoll !== null) ||
          !same(y, playerAction(a, q, y.id, y.physicalFactor, p.cursePolicy, y.checkRoll, index))) return false;
      } else { const y = entry.action; if (![...SILENT_DISCIPLE_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(y.planned) || !same(y, enemyAction(a, q, y.planned, y.physicalFactor, index))) return false; }
    }
    if (p.reflection !== null) {
      const r = p.reflection;
      if (!r || !p.cursePolicy || q.selfForm !== 'WOOD' || q.link !== 'LINKED' || q.linkRound === null || p.round > q.linkRound + 2 || r.round !== p.round ||
        !['LIGHT', 'HEAVY'].includes(r.severity) || r.playerDamage !== (r.severity === 'LIGHT' ? 10 : 30) || r.enemyDamage !== (r.severity === 'LIGHT' ? 5 : 15) ||
        typeof r.playerInjuryId !== 'string' || !r.playerInjuryId || r.enemyInjuryId !== `${a.runId}:silent-disciple-reflection:${p.round}:${a.revision + 1}` ||
        p.playerHealthAfter !== Math.max(0, a.playerHealth - r.playerDamage) || p.enemyHealth !== Math.max(0, a.enemyHealth - r.enemyDamage) || !p.enemyActions.some(x => x.threatens)) return false;
    }
    if ((!p.playerActions.some(x => x.threatens) && p.reflection === null && (p.enemyHealth !== a.enemyHealth || p.enemyStatus !== 'RESISTING' || !same(p.enemyInjuriesAfter, a.enemyInjuries))) ||
      (!p.enemyActions.some(x => x.threatens) && p.playerHealthAfter !== a.playerHealth)) return false;
    if (!p.continuing || (q.link === 'LINKED' && (q.linkRound === null || p.round >= q.linkRound + 2))) q.link = 'NONE';
    const scene = structuredClone(a.scene); if (!p.continuing && p.playerHealthAfter > 0) { scene.playerPosition = 'EXIT'; scene.ordinaryWalkedMetres += 4; }
    return q.playerS === p.playerSpiritualityAfter && q.playerM === p.playerMindAfter && q.enemyS === p.enemySpirituality && same(q.madman, p.madmanBurst) &&
      p.weaponLocation === (p.enemyHealth === 0 ? 'COURT' : q.weapon) && p.link === q.link && p.linkRound === q.linkRound && p.lastFormRound === q.lastFormRound &&
      p.contactAttempts === q.contacts && p.formAttempts === q.forms && p.breakLinkUses === q.breaks && p.contactDistanceMetres === q.contacts * 4 &&
      p.transfigurationAttempts === q.transfigurations && p.transfigurationSuccesses === q.successes && p.pickUpUses === q.pickups &&
      same(p.powerUses, q.uses) && same(p.blocks, q.blocks) && same(p.sceneAfter, scene);
  } catch { return false; }
}
