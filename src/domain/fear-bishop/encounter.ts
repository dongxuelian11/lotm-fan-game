import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasNightwatcherLifeLock } from '../nightwatcher/life.js';
import { hasFearBishopLifeLock } from './life.js';
import { validateFearBishopRoundOutcome } from './combat.js';

export const FEAR_BISHOP_TARGET_ID = 'FB3-HARLAN' as const;
export const FEAR_BISHOP_POWER_IDS = ['DARK_BOLT', 'WARD', 'FOCUS'] as const;
export type FearBishopPowerId = typeof FEAR_BISHOP_POWER_IDS[number];
export type FearBishopEnemyIntent = FearBishopPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const FEAR_BISHOP_POWERS = [
  { id: 'DARK_BOLT', label: '有限暗矢', cost: 5, selfGain: 75, enemyReduction: 0 },
  { id: 'WARD', label: '有限护术', cost: 4, selfGain: 0, enemyReduction: 45 },
  { id: 'FOCUS', label: '本轮有限专注', cost: 4, selfGain: 0, enemyReduction: 0 },
] as const;
export interface FearBishopEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface FearBishopEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof FEAR_BISHOP_TARGET_ID;
  approachWeek: number | null; attemptWeek: number | null; startHistoryIndex: number | null;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  weaponLocation: 'HAND' | 'YARD'; enemyInjuries: SliceInjury[]; enemyRisk: number; powerUses: Record<FearBishopPowerId, number>;
  terminal: FearBishopEncounterTerminal | null;
}
export type FearBishopEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface FearBishopEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: FearBishopEncounterCommand }
export interface FearBishopEncounterProjection {
  title: string; story: string; status: FearBishopEncounterState['status']; inside: boolean;
  enemy: null | { id: typeof FEAR_BISHOP_TARGET_ID; name: '哈兰'; age: 48; source: 'ORIGINAL_OPEN_COURT_ADULT'; sequence: 3;
    health: number; mind: number; spirituality: number; status: FearBishopEncounterState['enemyStatus'];
    weaponId: 'FB3-HARLAN-CLUB'; weaponLocation: 'HAND' | 'YARD'; powerUses: Record<FearBishopPowerId, number> };
  actions: FearBishopEncounterAction[]; facts: string[];
}
export const FEAR_BISHOP_ENCOUNTER_STORY = '成年哈兰（48岁，FB3-HARLAN）在旧库房外独立净空庭院，持自己的唯一原棍FB3-HARLAN-CLUB提出通路争议。他是原创有限G3等效对手，独立H100/M100/S120；旧布拉姆的死亡与原棍去向保留。双方原身体相距2米，实际普通出口开放，没有追逐。先实际交谈，再明确选择交战或和平离开。黑暗毁灭6S/知识18形成65×新掌握G优势，不能单槽抹除原人；安眠与恐惧结合的短时压力5S/意志18减势32G，可被敌4S专注抵抗一次。继承有限厄运4S/意志16减22G；同一已取得原卷叶抽中原灵槽时，SEALED先实付2S派出且0贡献，后槽DEPLOYED再付2S减22，轮末实际召回。敌暗矢5S/75、护术4S/45，灵性不足只用同一原棍20×身体。双方共用1至6次盘和真实伤势盘，无免费新灵、隐秘权柄、永眠、复活或永久意志削减。场景、消耗与全部量化均为G。';

export function createFearBishopEncounterState(): FearBishopEncounterState {
  return { status: 'AVAILABLE', targetId: FEAR_BISHOP_TARGET_ID, approachWeek: null, attemptWeek: null, startHistoryIndex: null,
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', enemyInjuries: [], enemyRisk: 0,
    powerUses: { DARK_BOLT: 0, WARD: 0, FOCUS: 0 }, terminal: null };
}
const stage = (s: SliceState) => s.progression.pathwayId === 'darkness' && s.progression.sequence === 3;
const hasFearBishopHistory = (s: SliceState) => s.progression.pathwayId === 'darkness' && [3, 2].includes(s.progression.sequence ?? 0);
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function validateFearBishopEncounterCommand(v: unknown): v is FearBishopEncounterCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 &&
    ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String((v as { type: unknown }).type));
}
export const isFearBishopEncounterCommand = validateFearBishopEncounterCommand;
export const hasFearBishopEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.fearBishop.encounter.status);
export const isInsideFearBishopEncounter = hasFearBishopEncounterLock;
function otherSceneOpen(s: SliceState): boolean {
  return s.fearBishop.preparedWeek !== null || hasFearBishopLifeLock(s) || Object.values(s.fearBishop.life.cases).some(r => r.status === 'PREPARED') ||
    hasNightwatcherLifeLock(s) || Object.values(s.nightwatcher.life.cases).some(r => r.status === 'PREPARED') ||
    ['READY', 'FIGHTING'].includes(s.nightwatcher.encounter.status) || s.nightwatcher.ritual.playerLocation !== 'OUTSIDE' ||
    Object.values(s.spiritWarlock.cases).some(r => r.contactOpen || r.status === 'PREPARED') ||
    s.spiritWarlock.practice.note !== 'TABLE' || s.spiritWarlock.practice.dreamOpen;
}
export function blockFearBishopEncounter(s: SliceState, c: FearBishopEncounterCommand): string | null {
  if (!validateFearBishopEncounterCommand(c)) return '恐惧主教遭遇命令无效。';
  const e = s.fearBishop.encounter;
  if (s.status !== 'ACTIVE' || !stage(s) || s.health <= 0) return '须本人仍活着并已成为恐惧主教3。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德原库房外净空庭院。';
  if (otherSceneOpen(s) || s.spiritWarlock.companion.status === 'DEPLOYED') return '先实际收束当前及旧实践、准备与原卷叶派出。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' ? null : '须先到场交谈，才能普通和平离开。';
  if (s.mind <= 0) return '先恢复精神；尚未开战仍可普通离开。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') return e.status !== 'AVAILABLE' ? '同一原哈兰已有进展或结局，不重新生成或补充资源。'
    : s.actionsRemaining < 2 ? '交谈需1行动，另留1行动供明确开战；仍可和平离开。' : null;
  return e.status === 'READY' ? null : '先实际交谈，确认原人、原棍和普通出口。';
}
export const fearBishopEncounterReason = blockFearBishopEncounter;
export function applyFearBishopEncounterCommand(s: SliceState, c: FearBishopEncounterCommand, ctx: SeerContext): void {
  const reason = blockFearBishopEncounter(s, c); if (reason) throw new Error(reason);
  const e = s.fearBishop.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') { e.status = 'RESOLVED'; ctx.note('沿原庭普通出口和平离开', '本人普通离开，没有追逐或战斗奖励；原哈兰及自己的原棍留场，旧布拉姆死亡、旧原物和原卷叶全部历史保留。'); return; }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') { e.status = 'READY'; e.approachWeek = s.week; ctx.note('与原哈兰实际交谈', FEAR_BISHOP_ENCOUNTER_STORY + '本次尚未替你选择开战。'); return; }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'FEAR_BISHOP_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('承担原净空庭院的真实冲突', '双方用同一原身体、原棍与独立实际灵性交战。原卷叶仍在实际原处，不自动派出；共同伤势、死亡、撤退无豁免。');
}
export const applyFearBishopEncounter = applyFearBishopEncounterCommand;
export function startFearBishopEncounter(s: SliceState, ctx: SeerContext): void { applyFearBishopEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasFearBishopDisputeOpponent(s: SliceState): boolean {
  const e = s.fearBishop?.encounter, c = s.combat;
  return stage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && !otherSceneOpen(s) &&
    !!e && e.status === 'FIGHTING' && e.targetId === FEAR_BISHOP_TARGET_ID && e.terminal === null && e.enemyStatus === 'RESISTING' && e.weaponLocation === 'HAND' &&
    e.approachWeek !== null && e.attemptWeek === s.week && c?.encounterId === 'FEAR_BISHOP_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 &&
    e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind && same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk &&
    integer(e.enemySpirituality, 0, 120) && FEAR_BISHOP_POWER_IDS.every(id => integer(e.powerUses[id])) &&
    e.enemySpirituality === 120 - FEAR_BISHOP_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) &&
    integer(c.round, 1) && e.startHistoryIndex !== null && integer(e.startHistoryIndex) && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
export function settleFearBishopEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.fearBishop.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'FEAR_BISHOP_DISPUTE') throw new Error('没有同一原哈兰的真实战斗。');
  if (outcome === 'CONTINUE') return;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知原庭战斗结果。');
  const last = c.lastRound, o = last?.fearBishopOutcome;
  if (e.terminal || e.startHistoryIndex === null || !last || !validateFearBishopRoundOutcome(o) || o.continuing || c.round !== last.round + 1 ||
      s.combatHistory.length - e.startHistoryIndex !== last.round || !same(s.combatHistory.at(-1), last) ||
      o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || o.enemySpirituality !== e.enemySpirituality || !same(o.companionAfter, s.spiritWarlock.companion) ||
      o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality ||
      (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS')) ||
      (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
      (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
      (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')))
    throw new Error('真实原身体、原卷叶或资源与已保存战斗结果不符。');
  e.terminal = { outcome: outcome as FearBishopEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('原庭冲突结束', `${outcome === 'PLAYER_DEAD' ? '玩家原身体真实死亡，睡眠、恐惧和原卷叶不复活。' : outcome === 'RETREATED' ? '本人沿净空普通出口离开，无追逐或瞬移。' : outcome === 'ENEMY_DEAD' ? '原哈兰真实死亡，自己的唯一原棍留场。' : '原哈兰仍活着，因真实重伤停止抵抗，把自己的唯一原棍放在原院。'}本轮原卷叶已实际召回，原释放与再邀请历史不重置；实付灵性及共同伤势保留，旧布拉姆、原人原物不改。`);
}
export function fearBishopEncounterActions(s: SliceState): FearBishopEncounterAction[] {
  if (!stage(s)) return [];
  return ([['ENCOUNTER_TALK', '前往原庭交谈', '1行动 · 另留开战1行动'], ['ENCOUNTER_FIGHT', '承担原哈兰的真实冲突', '1行动 · 真实受伤或死亡风险'],
    ['LEAVE_ENCOUNTER', '沿原出口和平离开', '0行动']] as const).map(([type, label, cost]) => {
    const command: FearBishopEncounterCommand = { type }, reason = blockFearBishopEncounter(s, command);
    return { id: `fearBishop-${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectFearBishopEncounter(s: SliceState): FearBishopEncounterProjection {
  const e = s.fearBishop.encounter;
  if (!hasFearBishopHistory(s)) return { title: '尚未开放的恐惧主教遭遇', story: '', status: e.status, inside: false, enemy: null, actions: [], facts: [] };
  return { title: '原庭与独立的哈兰', story: FEAR_BISHOP_ENCOUNTER_STORY, status: e.status, inside: hasFearBishopEncounterLock(s),
    enemy: { id: FEAR_BISHOP_TARGET_ID, name: '哈兰', age: 48, source: 'ORIGINAL_OPEN_COURT_ADULT', sequence: 3, health: e.enemyHealth,
      mind: e.enemyMind, spirituality: e.enemySpirituality, status: e.enemyStatus, weaponId: 'FB3-HARLAN-CLUB', weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses } },
    actions: fearBishopEncounterActions(s), facts: ['2米净空原庭，实际开放普通出口，无追逐', '有限毁灭不直接抹除人；睡恐压力可被本轮专注抵抗',
      '同一原卷叶派出2S/0贡献，后槽协助另付2S/减22，轮末真实召回', '双方独立S120、共同次数与伤势盘；旧布拉姆死亡和原棍去向保留'] };
}
/** Original-opponent and resource continuity only. The existing shared wheel owns injury resolution. */
export function validateFearBishopEncounter(s: SliceState): boolean {
  try {
    const e = s.fearBishop?.encounter, initial = createFearBishopEncounterState();
    if (!e || !same(Object.keys(e).sort(), Object.keys(initial).sort()) || e.targetId !== FEAR_BISHOP_TARGET_ID ||
        !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) ||
        !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 1, 100) || !integer(e.enemySpirituality, 0, 120) || !integer(e.enemyRisk) ||
        !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) ||
        e.weaponLocation !== (e.enemyStatus === 'RESISTING' ? 'HAND' : 'YARD') || !Array.isArray(e.enemyInjuries) ||
        !e.powerUses || Object.keys(e.powerUses).length !== 3 || !FEAR_BISHOP_POWER_IDS.every(id => integer(e.powerUses[id])) ||
        e.enemySpirituality !== 120 - FEAR_BISHOP_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) ||
        [e.approachWeek, e.attemptWeek].some(w => w !== null && !integer(w, 1, s.week))) return false;
    if (e.status === 'AVAILABLE') return same(e, initial) && s.combat?.encounterId !== 'FEAR_BISHOP_DISPUTE';
    if (!hasFearBishopHistory(s) || s.fearBishop.promotionWeek === null || e.approachWeek === null || e.approachWeek < s.fearBishop.promotionWeek) return false;
    if (!stage(s) && ['READY', 'FIGHTING'].includes(e.status)) return false;
    if (e.startHistoryIndex === null) return ['READY', 'RESOLVED'].includes(e.status) && e.attemptWeek === null && e.terminal === null &&
      same({ ...e, status: initial.status, approachWeek: null }, initial) && s.combat?.encounterId !== 'FEAR_BISHOP_DISPUTE';
    if (!integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek === null || e.attemptWeek < e.approachWeek) return false;
    const end = e.terminal ? e.terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
    for (const [i, round] of rounds.entries()) {
      const o = round.fearBishopOutcome, previous = rounds[i - 1]?.fearBishopOutcome;
      if (!validateFearBishopRoundOutcome(o) || round.round !== i + 1 || o.round !== round.round || o.stance !== round.stance || round.winner === null ||
          o.source.runId !== s.runId || o.source.startHistoryIndex !== e.startHistoryIndex || o.source.attemptWeek !== e.attemptWeek ||
          (i < rounds.length - 1 && (!o.continuing || round.retreat === 'SUCCESS'))) return false;
      if (previous ? o.source.enemyHealth !== previous.enemyHealth || o.source.enemyMind !== previous.enemyMind ||
          o.source.playerHealth !== previous.playerHealthAfter || o.source.playerMind !== previous.playerMindAfter ||
          o.playerSpiritualityBefore !== Math.min(120, previous.playerSpiritualityAfter + 12) || o.enemySpiritualityBefore !== previous.enemySpirituality ||
          !same(o.source.powerUses, previous.powerUses) || !same(o.source.companion, previous.companionAfter)
        : o.source.enemyHealth !== 100 || o.source.enemyMind !== 100 || o.enemySpiritualityBefore !== 120 || Object.values(o.source.powerUses).some(n => n !== 0)) return false;
      const moves = [...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))]
        .sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
      if (!same(moves, round.moves) || o.playerActions.length > round.playerCount || o.enemyActions.length > round.enemyCount) return false;
    }
    const last = rounds.at(-1), o = last?.fearBishopOutcome;
    if (o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemySpirituality !== e.enemySpirituality || o.enemyStatus !== e.enemyStatus || !same(o.powerUses, e.powerUses))) return false;
    if (e.status === 'FIGHTING') return e.terminal === null && hasFearBishopDisputeOpponent(s) &&
      (o ? o.continuing && same(o.companionAfter, s.spiritWarlock.companion) && same(last, s.combat!.lastRound) : s.combat!.lastRound === null);
    const t = e.terminal;
    if (s.combat?.encounterId === 'FEAR_BISHOP_DISPUTE' || !t || !last || !o || o.continuing || !integer(t.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1) ||
        t.round !== last.round || rounds.length !== t.round || t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus) return false;
    if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY';
    if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 && last.winner === 'ENEMY';
    return e.status === 'RESOLVED' && last.winner === 'PLAYER' && last.retreat === 'NONE' &&
      (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' : t.outcome === 'ENEMY_SURRENDERED' && e.enemyStatus === 'SURRENDERED');
  } catch { return false; }
}
