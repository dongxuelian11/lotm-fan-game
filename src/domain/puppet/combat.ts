import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import { stableStringify } from '../canonical.js';
import { resolveReasonSacrifice, type MadmanBurstPolicy, type MadmanRoundPolicy } from '../madman/combat.js';
import type { SliceInjury, SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { WRAITH_COUNT_WHEEL, wraithActionCount } from '../wraith/combat.js';
import { PUPPET_TARGET_ID, PUPPET_BLOCK_IDS, PUPPET_POWERS, PUPPET_POWER_IDS, hasPuppetDisputeOpponent,
  type PuppetBlock, type PuppetReflection, type PuppetEnemyIntent, type PuppetPowerId } from './encounter.js';

/** All budgets, checks, distances, durations and damage mapping are explicitly finite G. */
export const PUPPET_COUNT_WHEEL = WRAITH_COUNT_WHEEL;
export const puppetActionCount = wraithActionCount;
export const PUPPET_ENEMY_COUNT_WHEEL: readonly SliceWheelEntry[] = [
  { id: '2', label: '2次', weight: 20 }, { id: '3', label: '3次', weight: 50 }, { id: '4', label: '4次', weight: 30 },
];
export const puppetEnemyActionCount = (roll: number): number => roll <= 20 ? 2 : roll <= 70 ? 3 : 4;
export const PUPPET_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'ARC_BOLT', label: '原弧光术：5灵性，贡献55（G）', weight: 35 },
  { id: 'WARD', label: '原小型护术：3灵性，对方−30（G）', weight: 25 },
  { id: 'BODY_STRIKE', label: '自有原棍普通打击：18×身体（G）', weight: 25 },
  { id: 'BREAK_LINK', label: '挣断当前联系：3灵性、贡献8（G）；不足则原棍打击', weight: 10 },
  { id: 'ACCIDENT', label: '实际失衡：0贡献，不恢复灵性', weight: 5 },
];
export type PuppetMoveId = 'chained.s4.object-motion' | 'BODY_FOLLOWUP' | 'GHOST_DODGE' | 'chained.s4.curse-link' | 'OBSERVE' | 'ACCIDENT';
const ABILITIES: readonly { id: PuppetMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'chained.s4.object-motion', label: '本人原木块物动（H；3灵性、消耗一块原READY木块；55×新掌握，G）', weight: 30, stance: 'ATTACK' },
  { id: 'BODY_FOLLOWUP', label: '继承身体次击（J；29.575×钢铁身体掌握×身体；0消耗，G）', weight: 15, stance: 'ATTACK' },
  { id: 'GHOST_DODGE', label: '继承本槽灵化避让（B；2灵性、固定减势17.55；不足则8×身体，G）', weight: 20, stance: 'DEFEND' },
  { id: 'chained.s4.curse-link', label: '可选有代价联系／本人诅咒源（K；默认只观察，G）', weight: 20, stance: 'CONTROL' },
  { id: 'OBSERVE', label: '观察原木块、真实联系和出口（R；0消耗、0贡献）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '动作偏差（A；固定−22.5，G）', weight: 5, stance: null },
];
export const isPuppet = (s: SliceState): boolean => s.progression.pathwayId === 'chained' && s.progression.sequence === 4;
const tickets = (stance: SliceStance | null) => ABILITIES.map(a => a.weight * (stance !== null && a.stance === stance ? 5 : 4));
export function puppetAbilityWheel(s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0), e = s.puppet.encounter;
  return ABILITIES.map((a, i) => ({ id: a.id, weight: weights[i]! / total * 100,
    label: a.id === 'chained.s4.object-motion' && s.town.clubLocation === 'HAND' ? '持握本人原短棍（H；普通16×身体替换，0灵性、不消耗木块）'
      : a.id === 'chained.s4.object-motion' && !e.blocks.some(b => b.status === 'READY') ? '无READY原木块：继承灵体打击3灵性、54.925×旧掌握；不足则普通12×身体（G）'
      : a.label }));
}
export function drawPuppetAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): PuppetMoveId {
  const weights = tickets(stance); let roll = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (let i = 0; i < ABILITIES.length; i++) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; }
  throw new Error('木偶动作盘权重无效。');
}
export function drawPuppetEnemyAbility(random: ActionRandomStream): PuppetEnemyIntent {
  let roll = random.nextInt(1, 100);
  for (const a of PUPPET_ENEMY_ABILITY_WHEEL) { roll -= a.weight; if (roll <= 0) return a.id as PuppetEnemyIntent; }
  throw new Error('原埃德林动作盘权重无效。');
}
const bounded = (n: number, max: number) => Math.max(0, Math.min(max, Number.isFinite(n) ? n : 0));
const masteryFactor = (n: number) => .65 + .35 * bounded(n, 500) / 500;
const mastery = (s: SliceState, id: string) => bounded(s.progression.mastery[id] ?? 0, 500);
export interface PuppetCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'PUPPET_DISPUTE'; targetId: typeof PUPPET_TARGET_ID; attemptWeek: number; startHistoryIndex: number;
  playerHealth: number; playerMind: number; enemyHealth: number; enemyMind: number; knowledge: number;
  clubLocation: SliceState['town']['clubLocation']; actualOriginalBody: true; mutuallyVisible: true;
  distanceMetres: 2; noBystanders: true; ordinaryExit: true; pursuit: false;
  targetSequence: 5; targetPhysique: 20; enemyWeapon: 'PU4-EDRIN-CLUB'; space: 'ORIGINAL_PUPPET_EMPTY_WORKSHOP';
  blocksPurchased: boolean; blocks: PuppetBlock[]; link: 'NONE' | 'LINKED'; linkRound: number | null; lastFormRound: number | null;
  contactAttempts: number; formAttempts: number; breakLinkUses: number; contactDistanceMetres: number;
  objectMastery: number; spiritMastery: number; bodyMastery: number; burstMastery: number; powerUses: Record<PuppetPowerId, number>;
}
export function currentPuppetCombatSource(s: SliceState): PuppetCombatSource | null {
  if (!hasPuppetDisputeOpponent(s)) return null;
  const e = s.puppet.encounter, c = s.combat!;
  return { runId: s.runId, revision: s.revision, week: s.week, round: c.round, encounterId: 'PUPPET_DISPUTE', targetId: PUPPET_TARGET_ID,
    attemptWeek: e.attemptWeek!, startHistoryIndex: e.startHistoryIndex!, playerHealth: s.health, playerMind: s.mind,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, knowledge: s.character.coreStats.knowledge, clubLocation: s.town.clubLocation,
    actualOriginalBody: true, mutuallyVisible: true, distanceMetres: 2, noBystanders: true, ordinaryExit: true, pursuit: false,
    targetSequence: 5, targetPhysique: 20, enemyWeapon: 'PU4-EDRIN-CLUB', space: 'ORIGINAL_PUPPET_EMPTY_WORKSHOP',
    blocksPurchased: e.blocksPurchased, blocks: structuredClone(e.blocks), link: e.link, linkRound: e.linkRound, lastFormRound: e.lastFormRound,
    contactAttempts: e.contactAttempts, formAttempts: e.formAttempts, breakLinkUses: e.breakLinkUses, contactDistanceMetres: e.contactDistanceMetres,
    objectMastery: mastery(s, 'chained.s4.object-motion'), spiritMastery: mastery(s, 'chained.s5.spirit-possession'),
    bodyMastery: mastery(s, 'chained.s6.steel-body'), burstMastery: mastery(s, 'chained.s8.reason-sacrifice'), powerUses: { ...e.powerUses } };
}
export interface PuppetCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
export interface PuppetPlayerAction extends PuppetCombatEffect {
  order: number; id: PuppetMoveId; paidCost: number; physicalFactor: number; blockId: PuppetBlock['id'] | null;
  checkChance: number | null; checkRoll: number | null; contactAttempted: boolean; formAttempted: boolean; succeeded: boolean;
  burstTriggered: boolean; mentalCost: number; burstSpiritualCost: number;
}
export interface PuppetEnemyAction extends PuppetCombatEffect {
  order: number; planned: PuppetEnemyIntent; actual: PuppetEnemyIntent; paidCost: number; physicalFactor: number; linkBroken: boolean;
}
export interface PuppetRoundContext {
  source: PuppetCombatSource; stance: SliceStance; cursePolicy: boolean; madman: MadmanRoundPolicy; finished: boolean; liveState: string;
  playerSpiritualityBefore: number; enemySpiritualityBefore: number; playerActions: PuppetPlayerAction[]; enemyActions: PuppetEnemyAction[];
  reflection: PuppetReflection | null; label: string;
}
const none = (label: string): PuppetCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
const dynamicSource = new Set(['playerMind', 'blocks', 'link', 'linkRound', 'lastFormRound', 'contactAttempts', 'formAttempts', 'breakLinkUses', 'contactDistanceMetres', 'powerUses']);
function liveState(s: SliceState): string {
  const e = s.puppet.encounter;
  return stableStringify({ spirituality: s.spirituality, mind: s.mind, enemySpirituality: e.enemySpirituality, blocks: e.blocks,
    link: e.link, linkRound: e.linkRound, form: e.form, lastFormRound: e.lastFormRound, contactAttempts: e.contactAttempts,
    formAttempts: e.formAttempts, breakLinkUses: e.breakLinkUses, contactDistanceMetres: e.contactDistanceMetres, powerUses: e.powerUses, reflectionHistory: e.reflectionHistory });
}
function validRound(s: SliceState, r: PuppetRoundContext, source: PuppetCombatSource | null): boolean {
  const current = currentPuppetCombatSource(s);
  return !r.finished && current !== null && source !== null && stableStringify(source) === stableStringify(r.source) &&
    Object.entries(r.source).every(([k, v]) => dynamicSource.has(k) || stableStringify(current[k as keyof PuppetCombatSource]) === stableStringify(v)) && r.liveState === liveState(s);
}
export function beginPuppetCombatRound(s: SliceState, stance: SliceStance, cursePolicy = false, madmanPolicy: MadmanBurstPolicy = 'HOLD'): PuppetRoundContext {
  const source = currentPuppetCombatSource(s); if (!source || s.puppet.encounter.form !== 'HUMAN') throw new Error('缺少木偶同一原埃德林、原身体或已收束上一回合来源。');
  if (typeof cursePolicy !== 'boolean' || !['HOLD', 'BURST_FIRST'].includes(madmanPolicy)) throw new TypeError('本轮木偶策略无效。');
  const e = s.puppet.encounter;
  if (!cursePolicy || (e.link === 'LINKED' && (e.linkRound === null || s.combat!.round > e.linkRound + 2))) e.link = 'NONE';
  return { source, stance, cursePolicy, madman: { policy: madmanPolicy, triggered: false, mentalCost: 0, spiritualCost: 0 },
    finished: false, liveState: liveState(s), playerSpiritualityBefore: s.spirituality, enemySpiritualityBefore: e.enemySpirituality,
    playerActions: [], enemyActions: [], reflection: null,
    label: `原埃德林在原净空工坊2米外，灵性${e.enemySpirituality}/40；本轮${cursePolicy ? '已选择有真实自伤风险的有限诅咒策略' : '保留身体安全选择，主动停止旧联系，K只观察'}（G）。` };
}
export function resolvePuppetCombatAbility(s: SliceState, id: PuppetMoveId, physicalStateFactor: number, random: ActionRandomStream,
  r: PuppetRoundContext, source: PuppetCombatSource | null = r.source): PuppetCombatEffect {
  if (!validRound(s, r, source) || !ABILITIES.some(a => a.id === id)) return none('缺少本回合同一原埃德林与实际已付资源来源，0贡献、0消耗，不重抽。');
  const a: PuppetPlayerAction = { ...none(''), order: r.playerActions.length + r.enemyActions.length, id, paidCost: 0,
    physicalFactor: bounded(physicalStateFactor, 1), blockId: null, checkChance: null, checkRoll: null,
    contactAttempted: false, formAttempted: false, succeeded: false, burstTriggered: false, mentalCost: 0, burstSpiritualCost: 0 };
  Object.assign(a, resolvePlayer(s, id, a.physicalFactor, random, a, r)); r.playerActions.push(a); r.liveState = liveState(s);
  return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens };
}
function resolvePlayer(s: SliceState, id: PuppetMoveId, physical: number, random: ActionRandomStream, a: PuppetPlayerAction, r: PuppetRoundContext): PuppetCombatEffect {
  const e = s.puppet.encounter, canPay = (n: number) => Number.isFinite(s.spirituality) && s.spirituality >= n;
  const pay = (n: number) => { s.spirituality -= n; a.paidCost = n; };
  const body = (gain: number, label: string) => {
    const before = r.madman.triggered, burst = resolveReasonSacrifice(s, gain, r.madman);
    if (!before && r.madman.triggered) { a.burstTriggered = true; a.mentalCost = 10; a.burstSpiritualCost = 2; }
    return { label: label + burst.label, selfGain: burst.selfGain, enemyReduction: 0, threatens: burst.selfGain > 0 };
  };
  if (id === 'ACCIDENT') return { ...none('本次动作偏差固定−22.5（G），0灵性，不另掷正负。'), selfGain: -22.5 };
  if (id === 'BODY_FOLLOWUP') return body(29.575 * masteryFactor(mastery(s, 'chained.s6.steel-body')) * physical, '继承本人身体次击29.575×钢铁身体掌握×身体（G），独立占本槽，基础0灵性。');
  if (id === 'chained.s4.object-motion') {
    if (s.town.clubLocation === 'HAND') return body(16 * physical, '持握本人原短棍普通16×身体替换本槽（G）；不消耗木块、不取得原敌短棍。');
    if (!canPay(3)) return body(12 * physical, '不足3灵性，普通身体12×身体（G）；不消耗木块、不透支。');
    pay(3);
    const block = e.blocks.find(b => b.status === 'READY');
    if (block) {
      block.status = 'SPENT'; block.location = 'TARGET_GROUND'; block.usedRound = s.combat!.round; a.blockId = block.id;
      const selfGain = 55 * masteryFactor(mastery(s, id));
      return { label: `本人所有的同一${block.id}实际从原箱移到2米外原敌地面，实付3灵性、55×物动掌握（G）。是否击中仍由共同盘决定；无论成败原物留在地面，不能免费复用、不复制或夺敌原棍。`, selfGain, enemyReduction: 0, threatens: selfGain > 0 };
    }
    const selfGain = 54.925 * masteryFactor(mastery(s, 'chained.s5.spirit-possession'));
    return { label: '没有READY原木块，继承灵体打击实付3灵性、54.925×旧灵化附身掌握（G），不乘身体系数；当次施术收束，不直接扣健康或改动旧怨魂实践。', selfGain, enemyReduction: 0, threatens: selfGain > 0 };
  }
  if (id === 'GHOST_DODGE') {
    if (canPay(2)) { pay(2); return { ...none('继承本槽短暂灵化避让，实付2灵性、固定减势17.55（G）；同一原身体当次显形回到本轮既有形态，未留下第二身体，不跨槽无敌或治疗旧伤。'), enemyReduction: 17.55 }; }
    return { ...none('不足2灵性，普通格挡8×身体（G）、0费用，没有灵化或持续免伤。'), enemyReduction: 8 * physical };
  }
  if (id === 'chained.s4.curse-link') {
    if (!r.cursePolicy) return none('本轮未授权有自伤风险的诅咒策略：普通观察0贡献、0消耗，不接触、不建联系或变形。');
    const form = e.link === 'LINKED';
    if (form && e.lastFormRound === s.combat!.round) return none('本轮已经实际尝试本人诅咒源形态，不能同轮反复重试或免费复用纸人；普通观察0消耗。');
    const cost = form ? 4 : 3;
    if (!canPay(cost)) return none(`本次${form ? '本人诅咒源' : '接触联系'}不足${cost}灵性，普通观察0贡献、0消耗。`);
    pay(cost); a.checkChance = computeCheckChance({ ability: 'knowledge', baseAbility: s.character.coreStats.knowledge, difficulty: 18, modifiers: [] });
    a.checkRoll = random.nextInt(1, 100); a.succeeded = a.checkRoll <= a.checkChance;
    if (form) {
      a.formAttempted = true; e.formAttempts++; e.lastFormRound = s.combat!.round;
      if (a.succeeded) e.form = 'WOOD';
      return none(`实付4灵性，知识18对抗${a.checkRoll}/100、阈值${a.checkChance}（G）。${a.succeeded ? '自己的同一原身体实际成为木偶诅咒源，原伤与衣物仍在，直到本轮末恢复；没有立即伤害原敌。只有此后自己真实受伤且联系未断，才有限映射5/15' : '变形被抵抗，仍为原人形，实付费用不退'}；本人完整承担伤势和死亡风险，不是免伤、分身或沉默门徒3的能力。`);
    }
    a.contactAttempted = true; e.contactAttempts++; e.contactDistanceMetres += 2;
    if (a.succeeded) { e.link = 'LINKED'; e.linkRound = s.combat!.round; }
    return none(`实付3灵性，本人实际接近1米尝试接触，再沿原路返回1米，共2米（G）；知识18对抗${a.checkRoll}/100、阈值${a.checkChance}。${a.succeeded ? '与同一原埃德林建立有限联系，窗口为当轮及后两轮；仅联系，0即时攻击，后续另付4灵性才能尝试本人诅咒源' : '原敌抵抗、接触未成，联系NONE，费用照付'}。不夺棍、不控制意志或自动续期。`);
  }
  return none(`普通观察原木块READY${e.blocks.filter(b => b.status === 'READY').length}、原联系${e.link}、本人形态${e.form}与原出口。0灵性、0贡献，不自动准备、恢复或生成资源。`);
}
export function resolvePuppetEnemyAbility(s: SliceState, planned: PuppetEnemyIntent, physicalStateFactor: number, _random: ActionRandomStream,
  r: PuppetRoundContext, source: PuppetCombatSource | null = r.source): PuppetCombatEffect {
  if (!validRound(s, r, source) || ![...PUPPET_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(planned)) return none('缺少本回合同一原埃德林来源，原敌不凭空施术或补灵性。');
  const e = s.puppet.encounter, power = PUPPET_POWERS.find(p => p.id === planned), payable = !!power && e.enemySpirituality >= power.cost;
  const actual: PuppetEnemyIntent = planned === 'ACCIDENT' ? planned : payable ? planned : 'BODY_STRIKE';
  const physical = bounded(physicalStateFactor, 1), selfGain = actual === 'ACCIDENT' ? 0 : payable ? power!.selfGain : 18 * physical;
  const linkBroken = actual === 'BREAK_LINK' && e.link === 'LINKED';
  if (payable) { e.enemySpirituality -= power!.cost; e.powerUses[power!.id]++; }
  if (actual === 'BREAK_LINK') { e.link = 'NONE'; e.breakLinkUses++; }
  const a: PuppetEnemyAction = { order: r.playerActions.length + r.enemyActions.length, planned, actual, paidCost: payable ? power!.cost : 0,
    physicalFactor: physical, linkBroken, selfGain, enemyReduction: payable ? power!.enemyReduction : 0,
    threatens: (actual === 'BODY_STRIKE' || actual === 'ARC_BOLT') && selfGain > 0,
    label: `${actual === 'ACCIDENT' ? '原埃德林实际失衡，0贡献、0费用' : payable ? `同一原埃德林执行${power!.label}，实付${power!.cost}灵性，余${e.enemySpirituality}/40` : `${power ? '原法术灵性不足，回退' : ''}自有原棍普通打击18×身体（G），0费用`}${actual === 'BREAK_LINK' ? `；当前联系实际断开${linkBroken ? '，阻止后续映射' : '（原本没有有效联系）'}，8战势，不删除双方原身体或已发生伤势` : ''}。` };
  r.enemyActions.push(a); r.liveState = liveState(s);
  return { label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction, threatens: a.threatens };
}
/** Called only after a real common injury has already reduced the player's original health. */
export function reflectPuppetActualWound(s: SliceState, injury: SliceInjury, r: PuppetRoundContext): PuppetReflection | null {
  const e = s.puppet.encounter, c = s.combat;
  if (r.finished || r.reflection || !r.cursePolicy || !c || c.encounterId !== 'PUPPET_DISPUTE' || c.round !== r.source.round ||
      r.liveState !== liveState(s) || e.form !== 'WOOD' || e.link !== 'LINKED' || e.linkRound === null || c.round > e.linkRound + 2 ||
      !s.injuries.some(i => i.id === injury.id && stableStringify(i) === stableStringify(injury)) || injury.acquiredRevision !== s.revision + 1 ||
      !['LIGHT', 'HEAVY'].includes(injury.severity)) return null;
  const playerDamage = injury.severity === 'LIGHT' ? 10 : 30, enemyDamage = injury.severity === 'LIGHT' ? 5 : 15;
  if (s.health !== Math.max(0, r.source.playerHealth - playerDamage)) return null;
  const enemyInjury: SliceInjury = { id: `${s.runId}:puppet-reflection:${c.round}:${s.revision + 1}`, severity: injury.severity,
    acquiredRevision: s.revision + 1, treatedRevision: null };
  c.enemyHealth = Math.max(0, c.enemyHealth - enemyDamage); c.enemyInjuries.push(enemyInjury);
  if (c.enemyHealth === 0) c.enemyStatus = 'DEAD';
  const reflection: PuppetReflection = { round: c.round, severity: injury.severity, playerDamage, enemyDamage, playerInjuryId: injury.id, enemyInjuryId: enemyInjury.id };
  e.reflectionHistory.push(reflection); r.reflection = structuredClone(reflection); r.liveState = liveState(s);
  return reflection;
}
export interface PuppetRoundOutcome {
  targetId: typeof PUPPET_TARGET_ID; round: number; source: PuppetCombatSource; continuing: boolean; cursePolicy: boolean;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  playerSpiritualityBefore: number; playerSpiritualityAfter: number; playerHealthAfter: number; playerMindAfter: number;
  enemySpiritualityBefore: number; powerUses: Record<PuppetPowerId, number>; blocks: PuppetBlock[];
  form: 'HUMAN'; link: 'NONE' | 'LINKED'; linkRound: number | null; lastFormRound: number | null;
  contactAttempts: number; formAttempts: number; breakLinkUses: number; contactDistanceMetres: number;
  reflection: PuppetReflection | null; madmanBurst: MadmanRoundPolicy; playerActions: PuppetPlayerAction[]; enemyActions: PuppetEnemyAction[];
}
export function finishPuppetCombatRound(s: SliceState, r: PuppetRoundContext, continuing = true): PuppetRoundOutcome {
  if (r.finished || s.combat?.encounterId !== 'PUPPET_DISPUTE' || s.combat.round !== r.source.round || r.liveState !== liveState(s)) throw new Error('同一原回合已结束、不存在或资源被改写。');
  const e = s.puppet.encounter, c = s.combat;
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus;
  e.enemyInjuries = c.enemyInjuries.map(i => ({ ...i })); e.enemyRisk = c.enemyRisk;
  e.form = 'HUMAN';
  if (!continuing || (e.link === 'LINKED' && (e.linkRound === null || c.round >= e.linkRound + 2))) e.link = 'NONE';
  r.finished = true;
  return { targetId: PUPPET_TARGET_ID, round: c.round, source: structuredClone(r.source), continuing, cursePolicy: r.cursePolicy,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus,
    playerSpiritualityBefore: r.playerSpiritualityBefore, playerSpiritualityAfter: s.spirituality, playerHealthAfter: s.health, playerMindAfter: s.mind,
    enemySpiritualityBefore: r.enemySpiritualityBefore, powerUses: { ...e.powerUses }, blocks: structuredClone(e.blocks), form: 'HUMAN',
    link: e.link, linkRound: e.linkRound, lastFormRound: e.lastFormRound, contactAttempts: e.contactAttempts, formAttempts: e.formAttempts,
    breakLinkUses: e.breakLinkUses, contactDistanceMetres: e.contactDistanceMetres, reflection: structuredClone(r.reflection),
    madmanBurst: { ...r.madman }, playerActions: structuredClone(r.playerActions), enemyActions: structuredClone(r.enemyActions) };
}
export function projectPuppetCombat(s: SliceState) {
  const e = s.puppet.encounter;
  return { enemyName: '埃德林·维尔（PU4-EDRIN-VALE，原创成年序列5对手，G）', targetId: e.targetId,
    enemySpirituality: e.enemySpirituality, powerUses: { ...e.powerUses }, blocksPurchased: e.blocksPurchased, blocks: structuredClone(e.blocks),
    form: e.form, link: e.link, linkRound: e.linkRound, contactAttempts: e.contactAttempts, formAttempts: e.formAttempts, breakLinkUses: e.breakLinkUses,
    contactDistanceMetres: e.contactDistanceMetres, reflectionHistory: structuredClone(e.reflectionHistory), enemyInjuries: structuredClone(e.enemyInjuries),
    originalExit: true, pursuit: false, distanceMetres: 2, source: currentPuppetCombatSource(s),
    summary: `原埃德林灵性${e.enemySpirituality}/40；本人三块原物READY${e.blocks.filter(b => b.status === 'READY').length}、地面SPENT${e.blocks.filter(b => b.status === 'SPENT').length}；联系${e.link}${e.link === 'LINKED' ? `，有效至第${e.linkRound! + 2}轮末` : ''}，本人${e.form}。默认K只观察；主动选择后3灵性知识18接触、后续4灵性知识18本人诅咒源，失败照付。本人真实轻/重伤10/30完整保留，仍有联系才映射5/15（有限G）；敌人可实际挣断。每轮末恢复人形，终局断开，原人原物原伤保留。没有序列3能力下放。`,
    enemyCountWheel: PUPPET_ENEMY_COUNT_WHEEL, enemyAbilityWheel: PUPPET_ENEMY_ABILITY_WHEEL };
}
const integer = (n: unknown, min: number, max = Number.MAX_SAFE_INTEGER): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= min && n <= max;
const resource = (n: unknown, max = 120): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
export function validatePuppetBlocks(v: unknown, purchased: boolean, round = Number.MAX_SAFE_INTEGER): v is PuppetBlock[] {
  if (!Array.isArray(v) || v.length !== (purchased ? 3 : 0)) return false;
  return v.every((b: PuppetBlock, i) => b && b.id === PUPPET_BLOCK_IDS[i] && (b.status === 'READY'
    ? b.location === 'SOURCE' && b.usedRound === null : b.status === 'SPENT' && b.location === 'TARGET_GROUND' && integer(b.usedRound, 1, round)));
}
const usesValid = (u: Record<PuppetPowerId, number>) => u && typeof u === 'object' && Object.keys(u).length === 3 && PUPPET_POWER_IDS.every(id => integer(u[id], 0, 13));
/** Replay every real paid slot, finite original object, link, form and inherited burst. */
export function validatePuppetRoundOutcome(v: unknown): v is PuppetRoundOutcome {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const p = v as PuppetRoundOutcome, a = p.source;
  if (!a || typeof a !== 'object' || a.targetId !== PUPPET_TARGET_ID || a.encounterId !== 'PUPPET_DISPUTE' || a.round !== p.round ||
      typeof a.runId !== 'string' || a.runId.length === 0 || !integer(a.revision, 0) || !integer(a.week, 1) || a.attemptWeek !== a.week || !integer(a.startHistoryIndex, 0) ||
      !integer(a.playerHealth, 1, 100) || !integer(a.playerMind, 0, 100) || !integer(a.enemyHealth, 1, 100) || !integer(a.enemyMind, 1, 100) || !integer(a.knowledge, 0, 500) ||
      !['SHOP', 'BAG', 'HAND'].includes(a.clubLocation) || a.actualOriginalBody !== true || a.mutuallyVisible !== true || a.distanceMetres !== 2 || a.noBystanders !== true ||
      a.ordinaryExit !== true || a.pursuit !== false || a.targetSequence !== 5 || a.targetPhysique !== 20 || a.enemyWeapon !== 'PU4-EDRIN-CLUB' || a.space !== 'ORIGINAL_PUPPET_EMPTY_WORKSHOP' ||
      ![a.objectMastery, a.spiritMastery, a.bodyMastery, a.burstMastery].every(n => resource(n, 500)) || !usesValid(a.powerUses) ||
      typeof a.blocksPurchased !== 'boolean' || !validatePuppetBlocks(a.blocks, a.blocksPurchased, p.round - 1) || !['NONE', 'LINKED'].includes(a.link) ||
      !integer(a.contactAttempts, 0) || !integer(a.formAttempts, 0) || !integer(a.breakLinkUses, 0) || a.breakLinkUses !== a.powerUses.BREAK_LINK ||
      a.contactDistanceMetres !== a.contactAttempts * 2 ||
      (a.linkRound === null ? a.link !== 'NONE' : !integer(a.linkRound, 1, p.round - 1) || a.contactAttempts === 0) ||
      (a.lastFormRound === null ? a.formAttempts !== 0 : !integer(a.lastFormRound, 1, p.round - 1) || a.formAttempts === 0) ||
      (a.link === 'LINKED' && (a.linkRound === null || p.round > a.linkRound + 2))) return false;
  if (p.targetId !== PUPPET_TARGET_ID || !integer(p.round, 1) || !integer(p.enemyHealth, 0, a.enemyHealth) || p.enemyMind !== a.enemyMind ||
      !integer(p.enemySpirituality, 0, 40) || !integer(p.enemySpiritualityBefore, p.enemySpirituality, 40) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(p.enemyStatus) || (p.enemyStatus === 'DEAD') !== (p.enemyHealth === 0) ||
      !resource(p.playerSpiritualityBefore) || !resource(p.playerSpiritualityAfter) || p.playerSpiritualityAfter > p.playerSpiritualityBefore ||
      !integer(p.playerHealthAfter, 0, a.playerHealth) || !integer(p.playerMindAfter, 0, a.playerMind) || !usesValid(p.powerUses) ||
      p.enemySpiritualityBefore !== 40 - PUPPET_POWERS.reduce((n, x) => n + a.powerUses[x.id] * x.cost, 0) ||
      p.enemySpirituality !== 40 - PUPPET_POWERS.reduce((n, x) => n + p.powerUses[x.id] * x.cost, 0) ||
      p.form !== 'HUMAN' || typeof p.cursePolicy !== 'boolean' || typeof p.continuing !== 'boolean' ||
      (p.continuing && (p.enemyStatus !== 'RESISTING' || p.playerHealthAfter <= 0)) ||
      !Array.isArray(p.playerActions) || p.playerActions.length > 6 || !Array.isArray(p.enemyActions) || p.enemyActions.length > 4 ||
      !validatePuppetBlocks(p.blocks, a.blocksPurchased, p.round) || !p.madmanBurst || !['HOLD', 'BURST_FIRST'].includes(p.madmanBurst.policy)) return false;
  const ordered = [...p.playerActions.map(x => ({ kind: 'PLAYER' as const, action: x })), ...p.enemyActions.map(x => ({ kind: 'ENEMY' as const, action: x }))];
  if (ordered.some(x => !x.action || !integer(x.action.order, 0, 9))) return false;
  ordered.sort((x, y) => x.action.order - y.action.order);
  let enemySpent = 0, playerSpent = 0, mind = a.playerMind, burst = false;
  let link = p.cursePolicy ? a.link : 'NONE', linkRound = a.linkRound, lastFormRound = a.lastFormRound, wood = false;
  let contacts = a.contactAttempts, forms = a.formAttempts, breaks = a.breakLinkUses;
  const uses = { ...a.powerUses }, blocks = structuredClone(a.blocks);
  for (let index = 0; index < ordered.length; index++) {
    const entry = ordered[index]!, action = entry.action;
    if (action.order !== index || typeof action.label !== 'string' || !Number.isFinite(action.selfGain) || !resource(action.enemyReduction, 30) ||
        typeof action.threatens !== 'boolean' || !resource(action.physicalFactor, 1)) return false;
    if (entry.kind === 'PLAYER') {
      const x = entry.action;
      if (!ABILITIES.some(m => m.id === x.id) || !integer(x.paidCost, 0, 4) || typeof x.contactAttempted !== 'boolean' ||
          typeof x.formAttempted !== 'boolean' || typeof x.succeeded !== 'boolean' || typeof x.burstTriggered !== 'boolean') return false;
      const funds = p.playerSpiritualityBefore - playerSpent;
      let cost = 0, gain = 0, reduction = 0, threat = false, contact = false, form = false, succeeded = false, physical = false;
      let blockId: PuppetBlock['id'] | null = null;
      if (x.id === 'ACCIDENT') gain = -22.5;
      if (x.id === 'BODY_FOLLOWUP') { gain = 29.575 * masteryFactor(a.bodyMastery) * x.physicalFactor; physical = true; }
      if (x.id === 'chained.s4.object-motion') {
        if (a.clubLocation === 'HAND') { gain = 16 * x.physicalFactor; physical = true; }
        else if (funds >= 3) {
          cost = 3; const block = blocks.find(b => b.status === 'READY');
          if (block) { block.status = 'SPENT'; block.location = 'TARGET_GROUND'; block.usedRound = p.round; blockId = block.id; gain = 55 * masteryFactor(a.objectMastery); }
          else gain = 54.925 * masteryFactor(a.spiritMastery);
        } else { gain = 12 * x.physicalFactor; physical = true; }
      }
      if (x.id === 'BODY_FOLLOWUP' || x.id === 'chained.s4.object-motion') threat = gain > 0;
      const triggered = physical && gain > 0 && !burst && p.madmanBurst.policy === 'BURST_FIRST' && mind >= 10 && funds - cost >= 2;
      if (triggered) { gain *= 1 + .25 * masteryFactor(a.burstMastery); burst = true; mind -= 10; }
      if (x.id === 'GHOST_DODGE') { if (funds >= 2) { cost = 2; reduction = 17.55; } else reduction = 8 * x.physicalFactor; }
      if (x.id === 'chained.s4.curse-link' && p.cursePolicy && (link !== 'LINKED' || lastFormRound !== p.round) && funds >= (link === 'LINKED' ? 4 : 3)) {
        cost = link === 'LINKED' ? 4 : 3;
        if (!integer(x.checkRoll, 1, 100) || x.checkChance !== computeCheckChance({ ability: 'knowledge', baseAbility: a.knowledge, difficulty: 18, modifiers: [] })) return false;
        succeeded = x.checkRoll <= x.checkChance;
        if (link === 'LINKED') { form = true; forms++; lastFormRound = p.round; if (succeeded) wood = true; }
        else { contact = true; contacts++; if (succeeded) { link = 'LINKED'; linkRound = p.round; } }
      } else if (x.checkChance !== null || x.checkRoll !== null || x.succeeded) return false;
      if (x.paidCost !== cost || x.blockId !== blockId || x.selfGain !== gain || x.enemyReduction !== reduction || x.threatens !== threat ||
          x.contactAttempted !== contact || x.formAttempted !== form || x.succeeded !== succeeded || x.burstTriggered !== triggered ||
          x.mentalCost !== (triggered ? 10 : 0) || x.burstSpiritualCost !== (triggered ? 2 : 0)) return false;
      playerSpent += cost + (triggered ? 2 : 0);
    } else {
      const x = entry.action, power = PUPPET_POWERS.find(q => q.id === x.planned), payable = !!power && p.enemySpiritualityBefore - enemySpent >= power.cost;
      const actual = x.planned === 'ACCIDENT' ? x.planned : payable ? x.planned : 'BODY_STRIKE';
      if (![...PUPPET_POWER_IDS, 'BODY_STRIKE', 'ACCIDENT'].includes(x.planned) || typeof x.linkBroken !== 'boolean' ||
          x.actual !== actual || x.paidCost !== (payable ? power!.cost : 0)) return false;
      const gain = actual === 'ACCIDENT' ? 0 : payable ? power!.selfGain : 18 * x.physicalFactor;
      if (x.linkBroken !== (actual === 'BREAK_LINK' && link === 'LINKED') || x.selfGain !== gain ||
          x.enemyReduction !== (payable ? power!.enemyReduction : 0) || x.threatens !== ((actual === 'BODY_STRIKE' || actual === 'ARC_BOLT') && gain > 0)) return false;
      if (actual === 'BREAK_LINK') { link = 'NONE'; breaks++; }
      if (payable) uses[power!.id]++;
      enemySpent += x.paidCost;
    }
  }
  if (p.reflection !== null) {
    const r = p.reflection;
    if (!r || !p.cursePolicy || !wood || link !== 'LINKED' || linkRound === null || p.round > linkRound + 2 || r.round !== p.round ||
        !['LIGHT', 'HEAVY'].includes(r.severity) || r.playerDamage !== (r.severity === 'LIGHT' ? 10 : 30) || r.enemyDamage !== (r.severity === 'LIGHT' ? 5 : 15) ||
        typeof r.playerInjuryId !== 'string' || typeof r.enemyInjuryId !== 'string' || !r.playerInjuryId || !r.enemyInjuryId ||
        p.playerHealthAfter !== Math.max(0, a.playerHealth - r.playerDamage) || p.enemyHealth !== Math.max(0, a.enemyHealth - r.enemyDamage)) return false;
  }
  if (!p.continuing || (link === 'LINKED' && (linkRound === null || p.round >= linkRound + 2))) link = 'NONE';
  return p.enemySpiritualityBefore - enemySpent === p.enemySpirituality && p.playerSpiritualityBefore - playerSpent === p.playerSpiritualityAfter &&
    p.playerMindAfter === mind && p.madmanBurst.triggered === burst && p.madmanBurst.mentalCost === (burst ? 10 : 0) && p.madmanBurst.spiritualCost === (burst ? 2 : 0) &&
    p.link === link && p.linkRound === linkRound && p.lastFormRound === lastFormRound && p.contactAttempts === contacts &&
    p.formAttempts === forms && p.breakLinkUses === breaks && p.contactDistanceMetres === contacts * 2 &&
    stableStringify(uses) === stableStringify(p.powerUses) && stableStringify(blocks) === stableStringify(p.blocks);
}
