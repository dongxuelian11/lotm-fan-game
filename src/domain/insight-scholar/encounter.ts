import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasProphetLifeLock } from '../prophet/life.js';
import { hasInsightScholarLifeLock } from './life.js';
import { validateInsightScholarRoundOutcome } from './combat.js';

export const INSIGHT_SCHOLAR_TARGET_ID = 'IS3-ALTON' as const;
export const INSIGHT_SCHOLAR_POWER_IDS = ['FLASH', 'WARD', 'FOCUS'] as const;
export type InsightScholarPowerId = typeof INSIGHT_SCHOLAR_POWER_IDS[number];
export type InsightScholarSeenPower = 'FLASH' | 'WARD';
export type InsightScholarEnemyIntent = InsightScholarPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const INSIGHT_SCHOLAR_POWERS = [
  { id: 'FLASH', label: '有限闪光', cost: 5, selfGain: 75, enemyReduction: 0 },
  { id: 'WARD', label: '有限护术', cost: 4, selfGain: 0, enemyReduction: 45 },
  { id: 'FOCUS', label: '本轮有限专注', cost: 4, selfGain: 0, enemyReduction: 0 },
] as const;
export interface InsightScholarEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface InsightScholarEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof INSIGHT_SCHOLAR_TARGET_ID;
  approachWeek: number | null; attemptWeek: number | null; startHistoryIndex: number | null;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  weaponLocation: 'HAND' | 'YARD'; enemyInjuries: SliceInjury[]; enemyRisk: number; powerUses: Record<InsightScholarPowerId, number>; seenPowers: InsightScholarSeenPower[];
  terminal: InsightScholarEncounterTerminal | null;
}
export type InsightScholarEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface InsightScholarEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: InsightScholarEncounterCommand }
export interface InsightScholarEncounterProjection {
  title: string; story: string; status: InsightScholarEncounterState['status']; inside: boolean;
  enemy: null | { id: typeof INSIGHT_SCHOLAR_TARGET_ID; name: '阿尔顿'; age: 47; source: 'ORIGINAL_OPEN_COURT_ADULT'; sequence: 3;
    health: number; mind: number; spirituality: number; status: InsightScholarEncounterState['enemyStatus'];
    weaponId: 'IS3-ALTON-CLUB'; weaponLocation: 'HAND' | 'YARD'; powerUses: Record<InsightScholarPowerId, number>; seenPowers: InsightScholarSeenPower[] };
  actions: InsightScholarEncounterAction[]; facts: string[];
}
export const INSIGHT_SCHOLAR_ENCOUNTER_STORY = '成年阿尔顿（47岁，IS3-ALTON）在档案馆外独立净空庭院，持自己的唯一原棍IS3-ALTON-CLUB提出通路争议。他是原创有限G3等效对手，独立H100/M100/S120；旧46岁哈罗德及原棍留在原场，其实际结局不变。双方原身体相距2米，实际普通出口开放，没有追逐。先实际交谈，再明确选择交战或和平离开。洞悉者·阅读者序列3候选为G扩展，名称编号、新增能力与量化未作原著核实。方法辨析仅对本场亲眼见阿尔顿实际付费施展的FLASH或WARD作5S/知识18检验，成功减势35G；尚未亲见则普通避让10、0S，不读取未来动作或自动学会能力。继承片段预警4S/意志16减22；原FLASH须早先实际学会，2S/知识14减12×旧掌握；原微光片须真实持有并一次耗尽，0S减18×制作固定效力。敌五类行动盘FLASH35/护术25/原棍20/专注15/偏差5；FLASH/护术/专注分别实际付费5/4/4S，不足则原棍回退，专注只抵本轮下一次成功闪光或方法压力。共同伤势盘决定后果，不直接扣H/M、强制投降或补原库存。';

export function createInsightScholarEncounterState(): InsightScholarEncounterState {
  return { status: 'AVAILABLE', targetId: INSIGHT_SCHOLAR_TARGET_ID, approachWeek: null, attemptWeek: null, startHistoryIndex: null,
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', enemyInjuries: [], enemyRisk: 0,
    powerUses: { FLASH: 0, WARD: 0, FOCUS: 0 }, seenPowers: [], terminal: null };
}
const stage = (s: SliceState) => s.progression.pathwayId === 'white-tower' && s.progression.sequence === 3;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function validateInsightScholarEncounterCommand(v: unknown): v is InsightScholarEncounterCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 &&
    ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String((v as { type: unknown }).type));
}
export const isInsightScholarEncounterCommand = validateInsightScholarEncounterCommand;
export const hasInsightScholarEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.insightScholar.encounter.status);
export const isInsideInsightScholarEncounter = hasInsightScholarEncounterLock;
function otherSceneOpen(s: SliceState): boolean {
  return s.insightScholar.preparedWeek !== null || hasInsightScholarLifeLock(s) || Object.values(s.insightScholar.life.cases).some(r => r.status === 'PREPARED') ||
    hasProphetLifeLock(s) || Object.values(s.prophet.life.cases).some(r => r.status === 'PREPARED') ||
    ['READY', 'FIGHTING'].includes(s.prophet.encounter.status) || s.prophet.ritual.playerLocation !== 'OUTSIDE' || s.prophet.life.pages.location !== 'TABLE' ||
    Object.values(s.mysticismMagister.cases).some(r => r.contactOpen || r.status === 'PREPARED') ||
    Object.values(s.polymath.cases).some(r => r.contactOpen || r.status === 'PREPARED') ||
    s.mysticismMagister.practice.token !== 'OWNER' || s.mysticismMagister.practice.dreamOpen;
}

export function blockInsightScholarEncounter(s: SliceState, c: InsightScholarEncounterCommand): string | null {
  if (!validateInsightScholarEncounterCommand(c)) return '洞悉者候选G遭遇命令无效。';
  const e = s.insightScholar.encounter;
  if (s.status !== 'ACTIVE' || !stage(s) || s.health <= 0) return '须本人仍活着并已成为洞悉者·阅读者序列3候选（G扩展）。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德原库房外净空庭院。';
  if (otherSceneOpen(s)) return '先实际收束当前及旧实践、准备与原物借还。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' ? null : '须先到场交谈，才能普通和平离开。';
  if (s.mind <= 0) return '先恢复精神；尚未开战仍可普通离开。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') return e.status !== 'AVAILABLE' ? '同一原阿尔顿已有进展或结局，不重新生成或补充资源。'
    : s.actionsRemaining < 2 ? '交谈需1行动，另留1行动供明确开战；仍可和平离开。' : null;
  return e.status === 'READY' ? null : '先实际交谈，确认原人、原棍和普通出口。';
}
export const insightScholarEncounterReason = blockInsightScholarEncounter;
export function applyInsightScholarEncounterCommand(s: SliceState, c: InsightScholarEncounterCommand, ctx: SeerContext): void {
  const reason = blockInsightScholarEncounter(s, c); if (reason) throw new Error(reason);
  const e = s.insightScholar.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') { e.status = 'RESOLVED'; ctx.note('沿原庭普通出口和平离开', '本人普通离开，没有追逐或战斗奖励；原阿尔顿及自己的原棍留场，旧哈罗德实际结局、旧原物和原FLASH全部历史保留。'); return; }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') { e.status = 'READY'; e.approachWeek = s.week; ctx.note('与原阿尔顿实际交谈', INSIGHT_SCHOLAR_ENCOUNTER_STORY + '本次尚未替你选择开战。'); return; }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'INSIGHT_SCHOLAR_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('承担原净空庭院的真实冲突', '双方用同一原身体、原棍与独立实际灵性交战。原FLASH样本与微光片仍须真实旧来源；共同伤势、死亡、撤退无豁免。');
}
export const applyInsightScholarEncounter = applyInsightScholarEncounterCommand;
export function startInsightScholarEncounter(s: SliceState, ctx: SeerContext): void { applyInsightScholarEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasInsightScholarDisputeOpponent(s: SliceState): boolean {
  const e = s.insightScholar?.encounter, c = s.combat;
  return stage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && !otherSceneOpen(s) &&
    !!e && e.status === 'FIGHTING' && e.targetId === INSIGHT_SCHOLAR_TARGET_ID && e.terminal === null && e.enemyStatus === 'RESISTING' && e.weaponLocation === 'HAND' &&
    e.approachWeek !== null && e.attemptWeek === s.week && c?.encounterId === 'INSIGHT_SCHOLAR_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 &&
    e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind && same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk &&
    integer(e.enemySpirituality, 0, 120) && INSIGHT_SCHOLAR_POWER_IDS.every(id => integer(e.powerUses[id])) &&
    same(e.seenPowers, INSIGHT_SCHOLAR_POWER_IDS.filter(id => id !== 'FOCUS' && e.powerUses[id] > 0)) &&
    e.enemySpirituality === 120 - INSIGHT_SCHOLAR_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) &&
    integer(c.round, 1) && e.startHistoryIndex !== null && integer(e.startHistoryIndex) && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
export function settleInsightScholarEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.insightScholar.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'INSIGHT_SCHOLAR_DISPUTE') throw new Error('没有同一原阿尔顿的真实战斗。');
  if (outcome === 'CONTINUE') return;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知原庭战斗结果。');
  const last = c.lastRound, o = last?.insightScholarOutcome;
  if (e.terminal || e.startHistoryIndex === null || !last || !validateInsightScholarRoundOutcome(o) || o.continuing || c.round !== last.round + 1 ||
      s.combatHistory.length - e.startHistoryIndex !== last.round || !same(s.combatHistory.at(-1), last) ||
      o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || o.enemySpirituality !== e.enemySpirituality || !same(o.craftsAfter, s.mysticismMagister.crafts) || !same(o.seenPowers, e.seenPowers) ||
      o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality ||
      (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS')) ||
      (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
      (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
      (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')))
    throw new Error('真实原身体、原片或资源与已保存战斗结果不符。');
  e.terminal = { outcome: outcome as InsightScholarEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('原庭冲突结束', `${outcome === 'PLAYER_DEAD' ? '玩家原身体真实死亡，有限关联、辨析或预警不复活。' : outcome === 'RETREATED' ? '本人沿净空普通出口离开，无追逐或瞬移。' : outcome === 'ENEMY_DEAD' ? '原阿尔顿真实死亡，自己的唯一原棍留场。' : '原阿尔顿仍活着，因真实重伤停止抵抗，把自己的唯一原棍放在原院。'}本轮有限压力已结束；实付灵性、共同伤势和耗尽原片保留，旧哈罗德、原人原物不改。`);
}
export function insightScholarEncounterActions(s: SliceState): InsightScholarEncounterAction[] {
  if (!stage(s)) return [];
  return ([['ENCOUNTER_TALK', '前往原庭交谈', '1行动 · 另留开战1行动'], ['ENCOUNTER_FIGHT', '承担原阿尔顿的真实冲突', '1行动 · 真实受伤或死亡风险'],
    ['LEAVE_ENCOUNTER', '沿原出口和平离开', '0行动']] as const).map(([type, label, cost]) => {
    const command: InsightScholarEncounterCommand = { type }, reason = blockInsightScholarEncounter(s, command);
    return { id: `insightScholar-${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectInsightScholarEncounter(s: SliceState): InsightScholarEncounterProjection {
  const e = s.insightScholar.encounter;
  if (!stage(s)) return { title: '尚未开放的洞悉者候选G遭遇', story: '', status: e.status, inside: false, enemy: null, actions: [], facts: [] };
  return { title: '原庭与独立的阿尔顿', story: INSIGHT_SCHOLAR_ENCOUNTER_STORY, status: e.status, inside: hasInsightScholarEncounterLock(s),
    enemy: { id: INSIGHT_SCHOLAR_TARGET_ID, name: '阿尔顿', age: 47, source: 'ORIGINAL_OPEN_COURT_ADULT', sequence: 3, health: e.enemyHealth,
      mind: e.enemyMind, spirituality: e.enemySpirituality, status: e.enemyStatus, weaponId: 'IS3-ALTON-CLUB', weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses }, seenPowers: [...e.seenPowers] },
    actions: insightScholarEncounterActions(s), facts: ['洞悉者·阅读者序列3候选（G扩展）；名称编号与新增能力尚未原著核实', '2米净空原庭，实际开放普通出口，无追逐',
      `本场实际亲见方法：${e.seenPowers.length ? e.seenPowers.join('、') : '尚无'}；方法辨析只用已见FLASH/WARD，未见普通避让10且0S`, '敌五类行动权重35/25/20/15/5，共100；专注只抵本轮下一次成功闪光或方法压力',
      `继承实际原FLASH及原微光片，不增加技能库或库存；旧哈罗德H${s.prophet.encounter.enemy.health}/${s.prophet.encounter.enemy.status}、原棍${s.prophet.encounter.enemy.weaponLocation}保留`] };
}
/** Original-opponent and resource continuity only. The existing shared wheel owns injury resolution. */
export function validateInsightScholarEncounter(s: SliceState): boolean {
  try {
    const e = s.insightScholar?.encounter, initial = createInsightScholarEncounterState();
    if (!e || !same(Object.keys(e).sort(), Object.keys(initial).sort()) || e.targetId !== INSIGHT_SCHOLAR_TARGET_ID ||
        !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) ||
        !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 1, 100) || !integer(e.enemySpirituality, 0, 120) || !integer(e.enemyRisk) ||
        !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) ||
        e.weaponLocation !== (e.enemyStatus === 'RESISTING' ? 'HAND' : 'YARD') || !Array.isArray(e.enemyInjuries) ||
        !e.powerUses || Object.keys(e.powerUses).length !== 3 || !INSIGHT_SCHOLAR_POWER_IDS.every(id => integer(e.powerUses[id])) ||
        !same(e.seenPowers, INSIGHT_SCHOLAR_POWER_IDS.filter(id => id !== 'FOCUS' && e.powerUses[id] > 0)) ||
        e.enemySpirituality !== 120 - INSIGHT_SCHOLAR_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) ||
        [e.approachWeek, e.attemptWeek].some(w => w !== null && !integer(w, 1, s.week))) return false;
    if (e.status === 'AVAILABLE') return same(e, initial) && s.combat?.encounterId !== 'INSIGHT_SCHOLAR_DISPUTE';
    if (!(stage(s) || s.progression.pathwayId === 'white-tower' && s.progression.sequence === 2) || s.insightScholar.promotionWeek === null || e.approachWeek === null || e.approachWeek < s.insightScholar.promotionWeek) return false;
    if (s.progression.sequence === 2 && ['READY', 'FIGHTING'].includes(e.status)) return false;
    if (e.startHistoryIndex === null) return ['READY', 'RESOLVED'].includes(e.status) && e.attemptWeek === null && e.terminal === null &&
      same({ ...e, status: initial.status, approachWeek: null }, initial) && s.combat?.encounterId !== 'INSIGHT_SCHOLAR_DISPUTE';
    if (!integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek === null || e.attemptWeek < e.approachWeek) return false;
    const end = e.terminal ? e.terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
    for (const [i, round] of rounds.entries()) {
      const o = round.insightScholarOutcome, previous = rounds[i - 1]?.insightScholarOutcome;
      if (!validateInsightScholarRoundOutcome(o) || round.round !== i + 1 || o.round !== round.round || o.stance !== round.stance || round.winner === null ||
          o.source.runId !== s.runId || o.source.startHistoryIndex !== e.startHistoryIndex || o.source.attemptWeek !== e.attemptWeek ||
          (i < rounds.length - 1 && (!o.continuing || round.retreat === 'SUCCESS'))) return false;
      if (previous ? o.source.enemyHealth !== previous.enemyHealth || o.source.enemyMind !== previous.enemyMind ||
          o.source.playerHealth !== previous.playerHealthAfter || o.source.playerMind !== previous.playerMindAfter ||
          o.playerSpiritualityBefore !== Math.min(120, previous.playerSpiritualityAfter + 12) || o.enemySpiritualityBefore !== previous.enemySpirituality ||
          !same(o.source.powerUses, previous.powerUses) || !same(o.source.seenPowers, previous.seenPowers) ||
          !same(o.source.crafts, previous.craftsAfter) || !same(o.source.flashSample, previous.source.flashSample)
        : o.source.enemyHealth !== 100 || o.source.enemyMind !== 100 || o.enemySpiritualityBefore !== 120 || Object.values(o.source.powerUses).some(n => n !== 0) || o.source.seenPowers.length !== 0) return false;
      const moves = [...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))]
        .sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
      if (!same(moves, round.moves) || o.playerActions.length > round.playerCount || o.enemyActions.length > round.enemyCount) return false;
    }
    const consumed = rounds.flatMap(r => r.insightScholarOutcome!.consumedCraftIds);
    if (new Set(consumed).size !== consumed.length || !consumed.every(id => {
      const actual = s.mysticismMagister.crafts.find(c => c.id === id);
      const spent = rounds.flatMap(r => r.insightScholarOutcome!.craftsAfter).find(c => c.id === id && c.status === 'CONSUMED');
      return !!actual && !!spent && same(actual, spent) && actual.usedWeek === e.attemptWeek;
    })) return false;
    const last = rounds.at(-1), o = last?.insightScholarOutcome;
    if (o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemySpirituality !== e.enemySpirituality || o.enemyStatus !== e.enemyStatus || !same(o.powerUses, e.powerUses) || !same(o.seenPowers, e.seenPowers))) return false;
    if (e.status === 'FIGHTING') return e.terminal === null && hasInsightScholarDisputeOpponent(s) &&
      (o ? o.continuing && same(o.craftsAfter, s.mysticismMagister.crafts) && same(last, s.combat!.lastRound) : s.combat!.lastRound === null);
    const t = e.terminal;
    if (s.combat?.encounterId === 'INSIGHT_SCHOLAR_DISPUTE' || !t || !last || !o || o.continuing || !integer(t.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1) ||
        t.round !== last.round || rounds.length !== t.round || t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus) return false;
    if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY';
    if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 && last.winner === 'ENEMY';
    return e.status === 'RESOLVED' && last.winner === 'PLAYER' && last.retreat === 'NONE' &&
      (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' : t.outcome === 'ENEMY_SURRENDERED' && e.enemyStatus === 'SURRENDERED');
  } catch { return false; }
}
