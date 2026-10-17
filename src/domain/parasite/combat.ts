import type { ActionRandomStream } from '../../resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../resolution/normal-check.js';
import type { SliceStance, SliceState, SliceWheelEntry } from '../slice/types.js';
import { TRAVELER_COUNT_WHEEL, travelerActionCount } from '../traveler/combat.js';
import { hasDreamStealerOpenPractice } from '../dream-stealer/encounter.js';
import { hasParasiteLifeLock } from './life.js';
import { PARASITE_POWERS, PARASITE_POWER_IDS, PARASITE_TARGET_ID, expireParasitePowers,
  hasParasiteDisputeOpponent, isParasitePowerDisabled, type ParasiteEnemyIntent, type ParasitePowerId } from './encounter.js';

export const PARASITE_COUNT_WHEEL = TRAVELER_COUNT_WHEEL;
export const parasiteActionCount = travelerActionCount;
export const PARASITE_ENEMY_COUNT_WHEEL: readonly SliceWheelEntry[] = [
  { id: '2', label: '2次', weight: 20 }, { id: '3', label: '3次', weight: 50 }, { id: '4', label: '4次', weight: 30 },
];
export const parasiteEnemyActionCount = (roll: number): number => roll <= 20 ? 2 : roll <= 70 ? 3 : 4;
export const PARASITE_ENEMY_ABILITY_WHEEL: readonly SliceWheelEntry[] = [
  { id: 'WIND_BLADE', label: '风刃：4灵性，优势54×身体（G）', weight: 35 },
  { id: 'WIND_STEP', label: '风助步移：3灵性，对方−22（G）', weight: 20 },
  { id: 'GUST', label: '短促阵风：3灵性，对方−18（G）', weight: 15 },
  { id: 'STICK', label: '原短棍普通打击：24×身体（G）', weight: 25 },
  { id: 'ACCIDENT', label: '意外落空：0贡献', weight: 5 },
];
export type ParasiteMoveId = 'STRIKE' | 'RELEASE_POWER' | 'BLOCK' | 'error.s4.deferred-thought' | 'error.s6.power-theft' | 'ACCIDENT';
const ABILITIES: readonly { id: ParasiteMoveId; label: string; weight: number; stance: SliceStance | null }[] = [
  { id: 'STRIKE', label: '普通主攻（H，原身体12/自己手持原棍16×身体，G）', weight: 30, stance: 'ATTACK' },
  { id: 'RELEASE_POWER', label: '释放首个可用原暂窃能力（J，支付该能力真实灵性成本；没有则0）', weight: 15, stance: 'ATTACK' },
  { id: 'BLOCK', label: '普通格挡（B，对方−10，G）', weight: 20, stance: 'DEFEND' },
  { id: 'error.s4.deferred-thought', label: '窃取当前待行动念头（K，4灵性/意志18；暂缓并于轮末放弃，不立即执行或取得法术，G）', weight: 20, stance: 'CONTROL' },
  { id: 'error.s6.power-theft', label: '暂窃一个实际能力（R，6灵性/知识22；同一原目标最多三种，每次一种，G）', weight: 10, stance: 'PREPARE' },
  { id: 'ACCIDENT', label: '判断失衡（A，固定−22.5，G）', weight: 5, stance: null },
];
export const isParasite = (s: SliceState): boolean => s.progression.pathwayId === 'error' && s.progression.sequence === 4;
function tickets(stance: SliceStance | null): number[] { return ABILITIES.map(a => a.weight * (stance !== null && stance === a.stance ? 5 : 4)); }
export function parasiteAbilityWheel(_s: SliceState, stance: SliceStance | null): SliceWheelEntry[] {
  const weights = tickets(stance), total = weights.reduce((a, b) => a + b, 0);
  return ABILITIES.map((a, i) => ({ id: a.id, label: a.label, weight: total === 400 ? weights[i]! / 4 : weights[i]! / total * 100 }));
}
export function drawParasiteAbility(random: ActionRandomStream, _s: SliceState, stance: SliceStance | null): ParasiteMoveId {
  const weights = tickets(stance); let roll = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
  for (let i = 0; i < ABILITIES.length; i++) { roll -= weights[i]!; if (roll <= 0) return ABILITIES[i]!.id; }
  throw new Error('寄生者动作盘权重无效。');
}
export function drawParasiteEnemyAbility(random: ActionRandomStream): ParasiteEnemyIntent {
  let roll = random.nextInt(1, 100);
  for (const e of PARASITE_ENEMY_ABILITY_WHEEL) { roll -= e.weight; if (roll <= 0) return e.id as ParasiteEnemyIntent; }
  throw new Error('原拉尔夫动作盘权重无效。');
}
export interface ParasiteCombatSource {
  runId: string; revision: number; week: number; round: number;
  encounterId: 'FIRST_CASE' | 'PARASITE_DISPUTE'; targetId: 'ORIGINAL_LIVING_CARRIER' | typeof PARASITE_TARGET_ID;
  playerHealth: number; playerMind: number; enemyHealth: number; enemyMind: number;
  playerClubLocation: SliceState['town']['clubLocation']; attemptWeek: number | null; startHistoryIndex: number | null;
  originalExit: true; pursuit: false; bystanders: false;
}
export function currentParasiteCombatSource(s: SliceState): ParasiteCombatSource | null {
  const c = s.combat;
  if (!isParasite(s) || s.status !== 'ACTIVE' || !Number.isFinite(s.health) || s.health <= 0 || !Number.isFinite(s.mind) || s.mind <= 0 ||
      s.activeEvent !== null || s.world.city !== 'BACKLUND' || !c || c.enemyStatus !== 'RESISTING' || !Number.isFinite(c.enemyHealth) || c.enemyHealth <= 0 ||
      !Number.isFinite(c.enemyMind) || c.enemyMind <= 0 || !Number.isSafeInteger(c.round) || c.round < 1 || hasParasiteLifeLock(s) || hasDreamStealerOpenPractice(s)) return null;
  const common = { runId: s.runId, revision: s.revision, week: s.week, round: c.round,
    playerHealth: s.health, playerMind: s.mind, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind,
    playerClubLocation: s.town.clubLocation, originalExit: true, pursuit: false, bystanders: false } as const;
  if (c.encounterId === 'FIRST_CASE' && s.arc.stage === 'COMBAT' && s.world.carrierAlive && s.world.carrierCanResist && s.parasite.encounter.status !== 'FIGHTING') {
    return { ...common, encounterId: 'FIRST_CASE', targetId: 'ORIGINAL_LIVING_CARRIER', attemptWeek: null, startHistoryIndex: null };
  }
  return hasParasiteDisputeOpponent(s) ? { ...common, encounterId: 'PARASITE_DISPUTE', targetId: PARASITE_TARGET_ID,
    attemptWeek: s.parasite.encounter.attemptWeek, startHistoryIndex: s.parasite.encounter.startHistoryIndex } : null;
}
function validSource(s: SliceState, source: ParasiteCombatSource | null): boolean {
  const current = currentParasiteCombatSource(s);
  return !!source && !!current && Object.entries(current).every(([key, value]) => (source as unknown as Record<string, unknown>)[key] === value);
}
export interface ParasiteRoundContext {
  source: ParasiteCombatSource | null; pending: { id: ParasiteEnemyIntent; stolen: boolean } | null;
  decisions: number; consumed: number; finished: boolean;
}
export const createParasiteRoundContext = (s: SliceState): ParasiteRoundContext => ({ source: currentParasiteCombatSource(s), pending: null, decisions: 0, consumed: 0, finished: false });
export function decideParasiteEnemyIntent(s: SliceState, context: ParasiteRoundContext, requested: ParasiteEnemyIntent): void {
  if (!validSource(s, context.source) || context.source?.targetId !== PARASITE_TARGET_ID || context.finished || context.pending !== null || context.decisions !== context.consumed) throw new Error('原拉尔夫当前没有可形成新决定的现场。');
  const power = PARASITE_POWERS.find(p => p.id === requested), e = s.parasite.encounter;
  // A disabled/unaffordable spell is not an actual intended spell. The same adult
  // instead chooses his existing stick; no RNG peek, refill or extra action.
  const id = power && (isParasitePowerDisabled(e, power.id) || e.enemySpirituality < power.cost) ? 'STICK' : requested;
  context.pending = { id, stolen: false }; context.decisions += 1;
}
export interface ParasiteCombatEffect { label: string; selfGain: number; enemyReduction: number; threatens: boolean }
const none = (label: string): ParasiteCombatEffect => ({ label, selfGain: 0, enemyReduction: 0, threatens: false });
function check(s: SliceState, random: ActionRandomStream, ability: 'will' | 'knowledge', difficulty: number) {
  const result = resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: random.nextInt(1, 100) });
  return { success: result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS', detail: `${ability === 'will' ? '意志' : '知识'}${difficulty}，成功率${result.chance}%，实抽${result.roll}` };
}
export function resolveParasiteCombatAbility(s: SliceState, id: ParasiteMoveId, physicalStateFactor: number, random: ActionRandomStream,
  context: ParasiteRoundContext = createParasiteRoundContext(s), source = currentParasiteCombatSource(s)): ParasiteCombatEffect {
  if (!validSource(s, source) || !validSource(s, context.source) || context.finished) return none('当前原身体、原活敌或连续回合来源无效；0效果0消耗，不生成能力或寄生对象。');
  const physical = Math.max(0, Math.min(1, Number.isFinite(physicalStateFactor) ? physicalStateFactor : 0)), e = s.parasite.encounter;
  if (id === 'STRIKE') return { ...none('本人原身体普通打击；只使用自己实际握持的原棍，不夺取敌人原物（G）。'), selfGain: (s.town.clubLocation === 'HAND' ? 16 : 12) * physical, threatens: physical > 0 };
  if (id === 'BLOCK') return { ...none('原身体普通格挡，对方−10（G），不耗灵性。'), enemyReduction: 10 };
  if (id === 'ACCIDENT') return { ...none('判断失衡，本槽固定−22.5（G），不重抽。'), selfGain: -22.5 };
  if (source?.targetId !== PARASITE_TARGET_ID) return none('当前首案仍是原普通携铃者，不提供风眷者能力或预设念头来源；本槽普通观察，0效果0消耗。');
  if (id === 'error.s4.deferred-thought') {
    const p = context.pending;
    if (!p || p.stolen || p.id === 'ACCIDENT') return none('没有当前真实待执行念头；意外或已取走的念头不能再窃取，0消耗。');
    if (!Number.isFinite(s.spirituality) || s.spirituality < 4) return none('不足4灵性，不能窃取当前念头；不透支。');
    s.spirituality -= 4; const test = check(s, random, 'will', 18);
    if (!test.success) return none(`已耗4灵性，${test.detail}失败，原拉尔夫当前决定保留。`);
    p.stolen = true; e.thoughts.push({ round: s.combat!.round, action: p.id, status: 'WITHHELD' });
    return none(`已耗4灵性，${test.detail}成功，暂存同一原敌当前${p.id}念头；只取消这个待行动。本人保持原身体姿势，没有立即照做，也没有得到关联法术；本战斗切片选择轮末放弃而不执行（G），之后原主可以重新决定。`);
  }
  if (id === 'error.s6.power-theft') {
    const available = PARASITE_POWERS.filter(p => !e.borrowed.some(b => b.abilityId === p.id));
    if (e.borrowed.length >= 3 || !available.length) return none('同一原目标三种不同能力已经各取过一次；本槽不再制造副本，0消耗。');
    if (!Number.isFinite(s.spirituality) || s.spirituality < 6) return none('不足6灵性，本槽不能尝试能力窃取。');
    s.spirituality -= 6; const test = check(s, random, 'knowledge', 22);
    if (!test.success) return none(`已耗6灵性，${test.detail}失败，目标实际能力与灵性不变。`);
    const weights = available.map(p => e.observed.includes(p.id) ? 3 : 1); let roll = random.nextInt(1, weights.reduce((a, b) => a + b, 0));
    let selected = available[0]!;
    for (let i = 0; i < available.length; i++) { roll -= weights[i]!; if (roll <= 0) { selected = available[i]!; break; } }
    e.borrowed.push({ id: `PR4-LOAN-${e.borrowed.length + 1}`, sourceId: PARASITE_TARGET_ID, abilityId: selected.id,
      acquiredRound: s.combat!.round, acquiredSeconds: e.elapsedSeconds, expiresSeconds: e.elapsedSeconds + 7200,
      status: 'STORED', usedRound: null, closedSeconds: null, restoredToSource: false, uses: 0 });
    return none(`已耗6灵性，${test.detail}成功；这一次只暂窃原拉尔夫的${selected.label}。已亲见能力的选择权重3、未见1（G），不获取完整知识库；原主暂时不能施展这一个能力，原32灵性余额不转移。来源、取得时刻与本切片G两侧7200秒期限逐项保留；原主精确失能时长不冒充原文已核。`);
  }
  if (id === 'RELEASE_POWER') {
    const borrowed = e.borrowed.find(p => (p.status === 'STORED' || p.status === 'USED') && p.closedSeconds === null && p.expiresSeconds > e.elapsedSeconds);
    if (!borrowed) return none('没有首个真实可用的暂窃能力；0贡献0消耗，不从念头、晋升或旧原主历史中补造法术。');
    const power = PARASITE_POWERS.find(p => p.id === borrowed.abilityId)!;
    if (!Number.isFinite(s.spirituality) || s.spirituality < power.cost) return none(`首个真实暂窃${power.label}需要${power.cost}灵性，当前不足；不偷换下一能力或透支。`);
    s.spirituality -= power.cost; borrowed.status = 'USED'; borrowed.usedRound = s.combat!.round; borrowed.uses += 1;
    return { label: `本人实际释放从原拉尔夫暂窃的${power.label}，耗自身${power.cost}灵性，本次为第${borrowed.uses}次实付释放，期限内仍可再次付费使用；原来源能力在期限内仍被禁用（G），不补原主灵性。`,
      selfGain: power.selfGain * physical, enemyReduction: power.enemyReduction, threatens: power.selfGain > 0 && physical > 0 };
  }
  return none('没有已建模行动；不能在此战斗任意寄生、夺取身份或复制人。');
}
export function resolveParasiteEnemyIntent(s: SliceState, context: ParasiteRoundContext, physicalStateFactor: number): ParasiteCombatEffect {
  if (!validSource(s, context.source) || context.finished || !context.pending || context.decisions !== context.consumed + 1) throw new Error('没有同一原拉尔夫的当前待行动。');
  const pending = context.pending; context.pending = null; context.consumed += 1;
  if (pending.stolen) return none('这一个原敌待行动的念头已被暂窃，本次原敌槽贡献0、0灵性；之后仍能重新决定，不永久删除思想。');
  const physical = Math.max(0, Math.min(1, Number.isFinite(physicalStateFactor) ? physicalStateFactor : 0)), e = s.parasite.encounter;
  if (pending.id === 'ACCIDENT') return none('原拉尔夫意外落空，0贡献，不恢复灵性。');
  const power = PARASITE_POWERS.find(p => p.id === pending.id);
  if (!power || isParasitePowerDisabled(e, power.id) || e.enemySpirituality < power.cost) {
    return { ...none('原拉尔夫用自己原短棍普通打击24×身体（G）；能力已禁用或灵性不足时也只如此回退，不补充灵性。'), selfGain: 24 * physical, threatens: physical > 0 };
  }
  e.enemySpirituality -= power.cost; if (!e.observed.includes(power.id)) e.observed.push(power.id);
  return { label: `原拉尔夫实际施展${power.label}，扣除自身${power.cost}有限灵性，余${e.enemySpirituality}；这是亲眼见到的原能力。`,
    selfGain: power.selfGain * physical, enemyReduction: power.enemyReduction, threatens: power.selfGain > 0 && physical > 0 };
}
export interface ParasiteRoundOutcome {
  targetId: typeof PARASITE_TARGET_ID; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; elapsedSeconds: number;
  borrowed: { abilityId: ParasitePowerId; status: 'STORED' | 'USED' | 'RETURNED' | 'EXPIRED'; acquiredRound: number; expiresSeconds: number }[];
  stolenThoughts: number;
}
export function finishParasiteCombatRound(s: SliceState, context: ParasiteRoundContext): ParasiteRoundOutcome | null {
  context.pending = null; context.finished = true;
  if (context.source?.targetId !== PARASITE_TARGET_ID) return null;
  const e = s.parasite.encounter, c = s.combat!;
  for (const t of e.thoughts) if (t.status === 'WITHHELD') t.status = 'DISCARDED';
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus;
  e.enemyInjuries = c.enemyInjuries.map(i => ({ ...i })); e.enemyRisk = c.enemyRisk;
  e.weapon.location = c.enemyStatus === 'RESISTING' ? 'HAND' : 'YARD';
  e.elapsedSeconds += 60; expireParasitePowers(s);
  return { targetId: PARASITE_TARGET_ID, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality,
    enemyStatus: e.enemyStatus, elapsedSeconds: e.elapsedSeconds,
    borrowed: e.borrowed.map(p => ({ abilityId: p.abilityId, status: p.status, acquiredRound: p.acquiredRound, expiresSeconds: p.expiresSeconds })),
    stolenThoughts: e.thoughts.length };
}
export function projectParasiteCombat(s: SliceState) {
  const e = s.parasite.encounter;
  return { enemyName: '拉尔夫·托伦（39岁原创风眷者，序列6，G）', targetId: e.targetId,
    enemySpirituality: e.enemySpirituality, elapsedSeconds: e.elapsedSeconds,
    abilities: PARASITE_POWERS.map(p => ({ ...p, disabled: isParasitePowerDisabled(e, p.id), seen: e.observed.includes(p.id) })),
    borrowed: structuredClone(e.borrowed), thoughts: structuredClone(e.thoughts), originalExit: true, pursuit: false };
}
export function validateParasiteRoundOutcome(v: unknown): v is ParasiteRoundOutcome {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const p = v as Record<string, unknown>, integer = (n: unknown, min: number, max = Number.MAX_SAFE_INTEGER): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= min && n <= max;
  return Object.keys(p).length === 8 && p.targetId === PARASITE_TARGET_ID && integer(p.enemyHealth, 0, 100) && integer(p.enemyMind, 0, 100) &&
    integer(p.enemySpirituality, 0, 32) && ['RESISTING', 'SURRENDERED', 'DEAD'].includes(String(p.enemyStatus)) &&
    (p.enemyStatus === 'DEAD') === (p.enemyHealth === 0) && integer(p.elapsedSeconds, 60) && integer(p.stolenThoughts, 0) &&
    Array.isArray(p.borrowed) && p.borrowed.length <= 3 && new Set(p.borrowed.map(b => b?.abilityId)).size === p.borrowed.length &&
    p.borrowed.every(b => b && typeof b === 'object' && Object.keys(b).length === 4 && PARASITE_POWER_IDS.includes(b.abilityId) &&
      ['STORED', 'USED', 'RETURNED', 'EXPIRED'].includes(b.status) && integer(b.acquiredRound, 1) && integer(b.expiresSeconds, 7200));
}
