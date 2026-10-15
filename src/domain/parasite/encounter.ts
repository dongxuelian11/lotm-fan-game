import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasDreamStealerOpenPractice } from '../dream-stealer/encounter.js';
import { hasParasiteLifeLock } from './life.js';

export const PARASITE_TARGET_ID = 'PR4-RALF-TOREN' as const;
export const PARASITE_POWER_IDS = ['WIND_BLADE', 'WIND_STEP', 'GUST'] as const;
export type ParasitePowerId = typeof PARASITE_POWER_IDS[number];
export const PARASITE_POWERS: readonly { id: ParasitePowerId; label: string; cost: number; selfGain: number; enemyReduction: number }[] = [
  { id: 'WIND_BLADE', label: '风刃', cost: 4, selfGain: 54, enemyReduction: 0 },
  { id: 'WIND_STEP', label: '风助步移', cost: 3, selfGain: 0, enemyReduction: 22 },
  { id: 'GUST', label: '短促阵风', cost: 3, selfGain: 0, enemyReduction: 18 },
];
export type ParasiteEnemyIntent = ParasitePowerId | 'STICK' | 'ACCIDENT';
export interface ParasiteBorrowedPower {
  id: string; sourceId: typeof PARASITE_TARGET_ID; abilityId: ParasitePowerId;
  acquiredRound: number; acquiredSeconds: number; expiresSeconds: number;
  status: 'STORED' | 'USED' | 'RETURNED' | 'EXPIRED'; usedRound: number | null;
  closedSeconds: number | null; restoredToSource: boolean; uses: number;
}
export interface ParasiteStolenThought { round: number; action: Exclude<ParasiteEnemyIntent, 'ACCIDENT'>; status: 'WITHHELD' | 'DISCARDED'; }
export type ParasiteTerminalOutcome = 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED';
export interface ParasiteEncounterTerminal {
  outcome: ParasiteTerminalOutcome; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface ParasiteEncounterState {
  status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
  attemptWeek: number | null; startHistoryIndex: number | null;
  targetId: typeof PARASITE_TARGET_ID; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  weapon: { id: 'PR4-RALF-CLUB'; owner: typeof PARASITE_TARGET_ID; location: 'HAND' | 'YARD' };
  elapsedSeconds: number; observed: ParasitePowerId[]; borrowed: ParasiteBorrowedPower[];
  thoughts: ParasiteStolenThought[]; terminal: ParasiteEncounterTerminal | null;
}
export type ParasiteEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'RETURN_POWERS' | 'WAIT_POWER_EXPIRY' };
export interface ParasiteEncounterProjection {
  encounter: ParasiteEncounterState & {
    story: string; name: string; age: number; sequence: number; originalExit: string; pursuit: false;
    abilities: { id: ParasitePowerId; label: string; cost: number; selfGain: number; enemyReduction: number; disabled: boolean; seen: boolean }[];
  } | null;
}
export const PARASITE_ENCOUNTER_STORY = '原创39岁风眷者（序列6）拉尔夫·托伦因使用场地发生争议。原干燥净空庭院无旁人、无追逐，原普通出口畅通；他持自己唯一原短棍PR4-RALF-CLUB，只有32有限灵性和风刃、风助步移、短促阵风三种已建模能力，不能无限恢复。人物、冲突、数值、每轮60秒与战后等待计时均为G。原文提到维持时间两小时，但本切片将借用与原主禁用都设为取得后7200秒，并允许提前放弃，这是G边界，不宣称原主两小时失能已获原著核定。可以普通交涉；战斗沿用真实伤势、死亡和撤退规则，不能强制投降或临时寄生原敌。';
export function createParasiteEncounterState(): ParasiteEncounterState {
  return { status: 'AVAILABLE', attemptWeek: null, startHistoryIndex: null, targetId: PARASITE_TARGET_ID,
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 32, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0,
    weapon: { id: 'PR4-RALF-CLUB', owner: PARASITE_TARGET_ID, location: 'HAND' },
    elapsedSeconds: 0, observed: [], borrowed: [], thoughts: [], terminal: null };
}
const isPromoted = (s: SliceState) => s.progression.pathwayId === 'error' && [4,3,2].includes(s.progression.sequence!);
export const isParasitePowerDisabled = (e: ParasiteEncounterState, id: ParasitePowerId): boolean =>
  e.borrowed.some(p => p.abilityId === id && p.closedSeconds === null);
export const hasParasiteEncounterLock = (s: SliceState): boolean => s.parasite.encounter.status === 'FIGHTING' ||
  s.parasite.encounter.borrowed.some(p => p.closedSeconds === null);
export function validateParasiteEncounterCommand(v: unknown): v is ParasiteEncounterCommand {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const c = v as Record<string, unknown>;
  return Object.keys(c).length === 1 && ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'RETURN_POWERS', 'WAIT_POWER_EXPIRY'].includes(String(c.type));
}
export function parasiteEncounterReason(s: SliceState, c: ParasiteEncounterCommand): string | null {
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '先恢复身体与精神；死亡不能重新行动。';
  if (!isPromoted(s)||s.progression.sequence!==4) return '此处保留原寄生者争议，当前阶段不重新开启原对手。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (hasParasiteLifeLock(s) || hasDreamStealerOpenPractice(s)) return '先实际结束接触、分离并恢复自己的身体位置和原物。';
  const e = s.parasite.encounter;
  if (c.type === 'RETURN_POWERS' || c.type === 'WAIT_POWER_EXPIRY') {
    return e.status === 'FIGHTING' || !e.borrowed.some(p => p.closedSeconds === null) ? '没有需要收束的原目标暂窃能力。' : null;
  }
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原干燥私人庭院。';
  if (e.status !== 'AVAILABLE') return '同一原拉尔夫的这场争议已有结果，不能再生成或重新开战。';
  if (s.actionsRemaining < 1) return '前往原庭院需要1行动。';
  return c.type === 'ENCOUNTER_TALK' && e.attemptWeek === s.week ? '本周已普通交涉，拒绝保留；下一真实周可以再谈。' : null;
}
export function closeParasitePowers(s: SliceState, mode: 'RETURNED' | 'EXPIRED'): void {
  const e = s.parasite.encounter;
  for (const p of e.borrowed) if (p.closedSeconds === null) {
    p.status = mode; p.closedSeconds = e.elapsedSeconds; p.restoredToSource = e.enemyStatus !== 'DEAD';
  }
}
export function expireParasitePowers(s: SliceState): void {
  const e = s.parasite.encounter;
  for (const p of e.borrowed) if (p.closedSeconds === null && e.elapsedSeconds >= p.expiresSeconds) {
    p.status = 'EXPIRED'; p.closedSeconds = p.expiresSeconds; p.restoredToSource = e.enemyStatus !== 'DEAD';
  }
}
export function applyParasiteEncounterCommand(s: SliceState, c: ParasiteEncounterCommand, ctx: SeerContext): void {
  if (!validateParasiteEncounterCommand(c)) throw new Error('寄生者冲突命令无效。');
  const reason = parasiteEncounterReason(s, c); if (reason) throw new Error(reason);
  const e = s.parasite.encounter;
  if (c.type === 'RETURN_POWERS' || c.type === 'WAIT_POWER_EXPIRY') {
    if (c.type === 'WAIT_POWER_EXPIRY') {
      e.elapsedSeconds = Math.max(e.elapsedSeconds, ...e.borrowed.filter(p => p.closedSeconds === null).map(p => p.expiresSeconds));
      expireParasitePowers(s);
    } else closeParasitePowers(s, 'RETURNED');
    ctx.note('原暂窃能力实际收束', `${c.type === 'WAIT_POWER_EXPIRY' ? '实际等候到原借用到期，累计场景秒数' + e.elapsedSeconds : '主动放弃剩余借用（G）'}；完整借用记录与已用次数保留。${e.enemyStatus === 'DEAD' ? '原拉尔夫已经死亡，不能恢复成活人或重新施法。' : '仍活着的同一原拉尔夫恢复被暂时禁用的能力，灵性仍为' + e.enemySpirituality + '，不补充。'}无治疗、行动奖励或免费新能力。`);
    return;
  }
  s.actionsRemaining -= 1; e.attemptWeek = s.week;
  if (c.type === 'ENCOUNTER_TALK') {
    const result = ctx.check('will', 18);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') e.status = 'RESOLVED';
    ctx.note(e.status === 'RESOLVED' ? '拉尔夫自行结束场地争议' : '拉尔夫仍拒绝让步', '真实花费1行动到场普通交涉；' + (e.status === 'RESOLVED' ? '同一原成年人仍活着，持有原棍与全部32灵性，没有能力窃取或奖励。' : '保留本人拒绝、原棍与32灵性，本周不能重复交涉，可以离开或承担真实战斗风险。'));
    return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'PARASITE_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: e.enemyInjuries.map(i => ({ ...i })), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('原干燥庭院的有限冲突', PARASITE_ENCOUNTER_STORY);
}
export function hasParasiteDisputeOpponent(s: SliceState): boolean {
  const e = s.parasite.encounter, c = s.combat;
  return isPromoted(s) && s.progression.sequence === 4 && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && s.activeEvent === null &&
    s.world.city === 'BACKLUND' && !hasParasiteLifeLock(s) && !hasDreamStealerOpenPractice(s) &&
    c?.encounterId === 'PARASITE_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 &&
    Number.isSafeInteger(c.round) && c.round >= 1 && e.status === 'FIGHTING' && e.targetId === PARASITE_TARGET_ID &&
    e.weapon?.id === 'PR4-RALF-CLUB' && e.weapon.owner === PARASITE_TARGET_ID && e.weapon.location === 'HAND' &&
    Number.isSafeInteger(e.enemySpirituality) && e.enemySpirituality >= 0 && e.enemySpirituality <= 32 &&
    e.attemptWeek === s.week && e.startHistoryIndex !== null && Number.isSafeInteger(e.startHistoryIndex) && e.startHistoryIndex >= 0 &&
    s.combatHistory.length - e.startHistoryIndex === c.round - 1 &&
    s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.winner !== null && r.retreat !== 'SUCCESS');
}
export function settleParasiteEncounter(s: SliceState, outcome: string, ctx: SeerContext): void {
  const e = s.parasite.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'PARASITE_DISPUTE') throw new Error('没有本场原拉尔夫冲突。');
  if (outcome === 'CONTINUE') return;
  const last = c.lastRound;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome) || e.terminal ||
      e.startHistoryIndex === null || !last || c.round !== last.round + 1 ||
      s.combatHistory.length - e.startHistoryIndex !== last.round || stableStringify(s.combatHistory.at(-1)) !== stableStringify(last) ||
      (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
      (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
      (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
      (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS'))) throw new Error('结局与同一原回合、伤势和原身体不一致。');
  e.enemyHealth = c.enemyHealth; e.enemyMind = c.enemyMind; e.enemyStatus = c.enemyStatus;
  e.enemyInjuries = c.enemyInjuries.map(i => ({ ...i })); e.enemyRisk = c.enemyRisk;
  e.terminal = { outcome: outcome as ParasiteTerminalOutcome, round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  // No post-death command is possible: the finite G closure is explicit evidence,
  // not deletion of source/loan history or resurrection of either original body.
  if (outcome === 'PLAYER_DEAD') closeParasitePowers(s, 'RETURNED');
  s.combat = null;
  ctx.note('同一原拉尔夫冲突结束', `${outcome === 'ENEMY_DEAD' ? '原拉尔夫真实死亡，原尸体和原棍留在庭院。' : outcome === 'PLAYER_DEAD' ? '玩家原身体真实死亡，余下暂窃能力在此终止（G），完整记录保留，原拉尔夫仍按实际健康与灵性存在。' : outcome === 'RETREATED' ? '本人沿原普通出口退出，无追逐；原拉尔夫、原棍及资源留在原处。' : '原拉尔夫因真实重伤自行停止抵抗，仍活着，原棍归属不变。'}借用记录、伤势与实付消耗保留，不奖励扮演、不补灵性、不复活；仍有未收束能力时可主动放弃或实际等候到期。`);
}
export function parasiteEncounterActions(s: SliceState) {
  if (!isPromoted(s) || s.progression.sequence !== 4) return [];
  return ([['ENCOUNTER_TALK', '普通交涉（1行动）'], ['ENCOUNTER_FIGHT', '进入真实冲突（1行动，有死亡风险）'],
    ['RETURN_POWERS', '主动放弃剩余暂窃能力（G，0行动）'], ['WAIT_POWER_EXPIRY', '实际等候暂窃能力到期（G，0行动）']] as const).map(([type, label]) => {
    const command: ParasiteEncounterCommand = { type }, reason = parasiteEncounterReason(s, command);
    return { id: type, label, command, cost: type === 'ENCOUNTER_TALK' || type === 'ENCOUNTER_FIGHT' ? '1行动' : '0行动 · 实际等待或放弃', enabled: reason === null, reason };
  });
}
export function projectParasiteEncounter(s: SliceState): ParasiteEncounterProjection {
  if (!isPromoted(s)) return { encounter: null };
  const e = s.parasite.encounter;
  return { encounter: { ...structuredClone(e), story: PARASITE_ENCOUNTER_STORY, name: '拉尔夫·托伦', age: 39, sequence: 6,
    originalExit: '原干燥庭院开放普通出口', pursuit: false,
    abilities: PARASITE_POWERS.map(p => ({ ...p, disabled: isParasitePowerDisabled(e, p.id), seen: e.observed.includes(p.id) })) } };
}
const integer = (n: unknown, min: number, max = Number.MAX_SAFE_INTEGER): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= min && n <= max;
export function validateParasiteEncounter(s: SliceState): boolean {
  const e = s.parasite?.encounter; if (!e || typeof e !== 'object') return false;
  if (!['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || e.targetId !== PARASITE_TARGET_ID ||
      !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 0, 100) || !integer(e.enemySpirituality, 0, 32) ||
      !integer(e.enemyRisk, 0) || !integer(e.elapsedSeconds, 0) || !Array.isArray(e.enemyInjuries) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) ||
      (e.attemptWeek !== null && !integer(e.attemptWeek, 1, s.week)) || (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length)) ||
      !Array.isArray(e.observed) || new Set(e.observed).size !== e.observed.length || e.observed.some(id => !PARASITE_POWER_IDS.includes(id)) ||
      !Array.isArray(e.borrowed) || e.borrowed.length > 3 || new Set(e.borrowed.map(p => p?.abilityId)).size !== e.borrowed.length ||
      !Array.isArray(e.thoughts) || !e.weapon || e.weapon.id !== 'PR4-RALF-CLUB' || e.weapon.owner !== PARASITE_TARGET_ID ||
      !['HAND', 'YARD'].includes(e.weapon.location)) return false;
  if (e.enemyInjuries.some(i => !i || typeof i.id !== 'string' || !['LIGHT', 'HEAVY'].includes(i.severity) ||
      !integer(i.acquiredRevision, 0) || (i.treatedRevision !== null && !integer(i.treatedRevision, i.acquiredRevision)))) return false;
  if (e.borrowed.some((p, i) => !p || p.id !== `PR4-LOAN-${i + 1}` || p.sourceId !== PARASITE_TARGET_ID || !PARASITE_POWER_IDS.includes(p.abilityId) ||
      !integer(p.acquiredRound, 1) || !integer(p.acquiredSeconds, 0, e.elapsedSeconds) || p.expiresSeconds !== p.acquiredSeconds + 7200 ||
      !['STORED', 'USED', 'RETURNED', 'EXPIRED'].includes(p.status) ||
      (p.usedRound !== null && !integer(p.usedRound, p.acquiredRound)) || !integer(p.uses, 0) || (p.usedRound === null) !== (p.uses === 0) || typeof p.restoredToSource !== 'boolean' ||
      (p.closedSeconds === null ? (!['STORED', 'USED'].includes(p.status) || p.restoredToSource || e.elapsedSeconds >= p.expiresSeconds)
        : (!integer(p.closedSeconds, p.acquiredSeconds, e.elapsedSeconds) || !['RETURNED', 'EXPIRED'].includes(p.status) ||
          (p.status === 'EXPIRED' && p.closedSeconds !== p.expiresSeconds))) ||
      (p.status === 'STORED' && p.usedRound !== null) || (p.status === 'USED' && p.usedRound === null))) return false;
  if (e.thoughts.some(t => !t || !integer(t.round, 1) || ![...PARASITE_POWER_IDS, 'STICK'].includes(t.action) || t.status !== 'DISCARDED')) return false;
  if (!isPromoted(s)) return stableStringify(e) === stableStringify(createParasiteEncounterState()) && s.combat?.encounterId !== 'PARASITE_DISPUTE';
  if (e.startHistoryIndex === null) return ['AVAILABLE', 'RESOLVED'].includes(e.status) && e.terminal === null && e.borrowed.length === 0 &&
    e.thoughts.length === 0 && e.elapsedSeconds === 0 && e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 32 &&
    e.enemyStatus === 'RESISTING' && e.weapon.location === 'HAND' && e.enemyInjuries.length === 0 && e.enemyRisk === 0 && e.observed.length === 0 && s.combat?.encounterId !== 'PARASITE_DISPUTE';
  if (e.attemptWeek === null || s.parasite.promotionWeek === null || e.attemptWeek < s.parasite.promotionWeek) return false;
  const lastOwn = e.terminal ? s.combatHistory[e.terminal.historyIndex] : s.combatHistory.at(-1);
  const ownCount = e.terminal ? e.terminal.round : s.combatHistory.length - e.startHistoryIndex;
  if (ownCount === 0 && (e.elapsedSeconds !== 0 || e.borrowed.length || e.observed.length || e.thoughts.length || e.enemySpirituality !== 32)) return false;
  if (ownCount > 0) {
    const snapshot = lastOwn?.parasiteOutcome;
    if (!snapshot || snapshot.targetId !== e.targetId || snapshot.enemyHealth !== e.enemyHealth || snapshot.enemyMind !== e.enemyMind ||
        snapshot.enemyStatus !== e.enemyStatus || snapshot.enemySpirituality !== e.enemySpirituality || snapshot.elapsedSeconds !== ownCount * 60 ||
        e.elapsedSeconds < snapshot.elapsedSeconds || snapshot.stolenThoughts !== e.thoughts.length || snapshot.borrowed.length !== e.borrowed.length ||
        snapshot.borrowed.some((p, i) => p.abilityId !== e.borrowed[i]!.abilityId || p.acquiredRound !== e.borrowed[i]!.acquiredRound || p.expiresSeconds !== e.borrowed[i]!.expiresSeconds)) return false;
  }
  if (e.status === 'FIGHTING') return e.elapsedSeconds === ownCount * 60 && e.weapon.location === 'HAND' && e.terminal === null && hasParasiteDisputeOpponent(s) && s.combat!.enemyHealth === e.enemyHealth &&
    s.combat!.enemyMind === e.enemyMind && s.combat!.enemyStatus === e.enemyStatus &&
    stableStringify(s.combat!.enemyInjuries) === stableStringify(e.enemyInjuries) && s.combat!.enemyRisk === e.enemyRisk;
  const t = e.terminal;
  if (s.combat?.encounterId === 'PARASITE_DISPUTE' || !t || !integer(t.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1)) return false;
  const rounds = s.combatHistory.slice(e.startHistoryIndex, t.historyIndex + 1), last = rounds.at(-1);
  if (!last || last.round !== t.round || !rounds.every((r, i) => r.round === i + 1 && r.winner !== null && (i === rounds.length - 1 || r.retreat !== 'SUCCESS')) ||
      t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemyStatus !== e.enemyStatus || t.enemySpirituality !== e.enemySpirituality) return false;
  if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && t.enemyStatus === 'RESISTING';
  if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && s.health === 0 && last.winner === 'ENEMY' && last.retreat !== 'SUCCESS' && e.borrowed.every(p => p.closedSeconds !== null);
  return e.status === 'RESOLVED' && last.winner === 'PLAYER' && last.retreat === 'NONE' &&
    (t.outcome === 'ENEMY_DEAD' ? t.enemyStatus === 'DEAD' && t.enemyHealth === 0 : t.outcome === 'ENEMY_SURRENDERED' && t.enemyStatus === 'SURRENDERED' && t.enemyHealth > 0);
}
