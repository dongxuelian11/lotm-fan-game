import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasCataclysmPriestLifeLock } from '../cataclysm-priest/life.js';
import { hasSeaKingLifeLock } from './life.js';
import { validateSeaKingRoundOutcome } from './combat.js';

export const SEA_KING_TARGET_ID = 'SK3-QUENTIN' as const;
export const SEA_KING_POWER_IDS = ['WIND', 'WATER_WARD', 'FOCUS'] as const;
export type SeaKingPowerId = typeof SEA_KING_POWER_IDS[number];
export type SeaKingEnemyIntent = SeaKingPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const SEA_KING_POWERS = [
  { id: 'WIND', label: '有限风压', cost: 5, selfGain: 75, enemyReduction: 0 },
  { id: 'WATER_WARD', label: '真实海水防护', cost: 4, selfGain: 0, enemyReduction: 45 },
  { id: 'FOCUS', label: '本轮有限专注', cost: 4, selfGain: 0, enemyReduction: 0 },
] as const;
export interface SeaKingEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface SeaKingEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof SEA_KING_TARGET_ID;
  approachWeek: number | null; attemptWeek: number | null; startHistoryIndex: number | null; waterSource: 'SEAWATER' | 'NONE';
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  weaponLocation: 'HAND' | 'QUAY'; enemyInjuries: SliceInjury[]; enemyRisk: number; powerUses: Record<SeaKingPowerId, number>;
  terminal: SeaKingEncounterTerminal | null;
}
export type SeaKingEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface SeaKingEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: SeaKingEncounterCommand }
export interface SeaKingEncounterProjection {
  title: string; story: string; status: SeaKingEncounterState['status']; inside: boolean; waterSource: 'SEAWATER' | 'NONE' | null;
  enemy: null | { id: typeof SEA_KING_TARGET_ID; name: '昆廷'; age: 49; source: 'ORIGINAL_DRY_QUAY_ADULT'; sequence: 3;
    health: number; mind: number; spirituality: number; status: SeaKingEncounterState['enemyStatus'];
    weaponId: 'SK3-QUENTIN-CLUB'; weaponLocation: 'HAND' | 'QUAY'; powerUses: Record<SeaKingPowerId, number> };
  actions: SeaKingEncounterAction[]; facts: string[];
}
export const SEA_KING_ENCOUNTER_STORY = '成年昆廷（49岁，SK3-QUENTIN）在独立原干燥码头空场，持自己的唯一原棍SK3-QUENTIN-CLUB提出通路争议。他是原创有限G3等效对手，独立H100/M100/S120；旧48岁本尼迪克特·维尔的实际死亡、原棍与其他原物历史不变。双方原身体相距2米，邻接真实空海水带，原普通干燥出口开放，没有追逐、艇上同伴或第三人在施术区。先实际交谈，再明确选择交战或和平离开。玩家六槽远风25/海域20/旧控风15/旧强雷20/普通避让15/偏差5；远风6S意志18成功65×新掌握G，海域6S知识18成功减32G且须当前真实海水。旧控风4S意志16减18×原掌握，旧强雷6S意志18为38×原掌握；继承系数0.65+0.35×掌握/500。资源或水源不足只普通0S回退，检验失败照耗。敌五类风35/水护25/原棍20/专注15/偏差5，风/水护/专注实际付费5/4/4S；水护也须真实海水，不足只用原棍。专注只抵本轮下一次成功风水压力一次，不抵雷击。此处净空是场景事实，不赋予风水自动友军免疫。共同伤势盘决定后果，不直接扣H/M、强制投降、全海统御或赠送船只与海生物库。';
export function createSeaKingEncounterState(): SeaKingEncounterState {
  return { status: 'AVAILABLE', targetId: SEA_KING_TARGET_ID, approachWeek: null, attemptWeek: null, startHistoryIndex: null, waterSource: 'SEAWATER',
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', enemyInjuries: [], enemyRisk: 0,
    powerUses: { WIND: 0, WATER_WARD: 0, FOCUS: 0 }, terminal: null };
}
const stage = (s: SliceState) => s.progression.pathwayId === 'tyrant' && s.progression.sequence === 3;
const hasHistory = (s: SliceState) => s.progression.pathwayId === 'tyrant' && [3, 2].includes(s.progression.sequence ?? 0);
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function validateSeaKingEncounterCommand(v: unknown): v is SeaKingEncounterCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 &&
    ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String((v as { type: unknown }).type));
}
export const isSeaKingEncounterCommand = validateSeaKingEncounterCommand;
export const hasSeaKingEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.seaKing.encounter.status);
export const isInsideSeaKingEncounter = hasSeaKingEncounterLock;
function otherSceneOpen(s: SliceState): boolean {
  return s.seaKing.preparedWeek !== null || hasSeaKingLifeLock(s) || Object.values(s.seaKing.life.cases).some(r => r.status === 'PREPARED') ||
    hasCataclysmPriestLifeLock(s) || Object.values(s.cataclysmPriest.life.cases).some(r => r.status === 'PREPARED') ||
    ['READY', 'FIGHTING'].includes(s.cataclysmPriest.encounter.status) || s.cataclysmPriest.ritual.playerLocation === 'PLATFORM' ||
    s.oceanSinger.ritual.location !== 'DOCK' || s.oceanSinger.practice.songOpen || s.oceanSinger.practice.allyAffected || s.oceanSinger.practice.allyPosition !== 'NEAR' ||
    Object.values(s.oceanSinger.cases).some(r => r.contactOpen || r.status === 'PREPARED');
}
export function blockSeaKingEncounter(s: SliceState, c: SeaKingEncounterCommand): string | null {
  if (!validateSeaKingEncounterCommand(c)) return '海王遭遇命令无效。';
  const e = s.seaKing.encounter;
  if (s.status !== 'ACTIVE' || !stage(s) || s.health <= 0) return '须本人仍活着并已成为海王·暴君序列3。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德原干燥码头空场。';
  if (otherSceneOpen(s)) return '先实际收束当前海湾、旧实践、准备与原物借还。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' ? null : '须先到场交谈，才能沿原普通出口和平离开。';
  if (s.mind <= 0) return '先恢复精神；尚未开战仍可普通离开。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') return e.status !== 'AVAILABLE' ? '同一原昆廷已有进展或结局，不重新生成或补充资源。'
    : s.actionsRemaining < 2 ? '交谈需1行动，另留1行动供明确开战；仍可和平离开。' : null;
  return e.status === 'READY' ? null : '先实际交谈，确认原人、原棍、真实水源和普通出口。';
}
export const seaKingEncounterReason = blockSeaKingEncounter;
export function applySeaKingEncounterCommand(s: SliceState, c: SeaKingEncounterCommand, ctx: SeerContext): void {
  const reason = blockSeaKingEncounter(s, c); if (reason) throw new Error(reason);
  const e = s.seaKing.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') { e.status = 'RESOLVED'; ctx.note('沿原干燥码头普通出口和平离开', '本人普通离开，没有追逐、瞬移或战斗奖励；原昆廷及自己的原棍留场，旧本尼迪克特死亡与所有原人原物历史保留。'); return; }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') { e.status = 'READY'; e.approachWeek = s.week; ctx.note('与原昆廷实际交谈', SEA_KING_ENCOUNTER_STORY + '本次尚未替你选择开战。'); return; }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'SEA_KING_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('承担原干燥码头的真实冲突', '双方用同一原身体、各自原棍与独立实际灵性交战。海水须实际存在，净空场没有第三人不等于全游戏自动友军免疫；共同伤势、死亡、撤退无豁免。');
}
export const applySeaKingEncounter = applySeaKingEncounterCommand;
export function startSeaKingEncounter(s: SliceState, ctx: SeerContext): void { applySeaKingEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasSeaKingDisputeOpponent(s: SliceState): boolean {
  const e = s.seaKing?.encounter, c = s.combat;
  return stage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && !otherSceneOpen(s) &&
    !!e && e.status === 'FIGHTING' && e.targetId === SEA_KING_TARGET_ID && e.terminal === null && e.enemyStatus === 'RESISTING' && e.weaponLocation === 'HAND' &&
    ['SEAWATER', 'NONE'].includes(e.waterSource) && e.approachWeek !== null && e.attemptWeek === s.week && c?.encounterId === 'SEA_KING_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 &&
    e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind && same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk &&
    integer(e.enemySpirituality, 0, 120) && SEA_KING_POWER_IDS.every(id => integer(e.powerUses[id])) &&
    e.enemySpirituality === 120 - SEA_KING_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) &&
    integer(c.round, 1) && e.startHistoryIndex !== null && integer(e.startHistoryIndex) && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
export function settleSeaKingEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.seaKing.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'SEA_KING_DISPUTE') throw new Error('没有同一原昆廷的真实战斗。');
  if (outcome === 'CONTINUE') return;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知原码头战斗结果。');
  const last = c.lastRound, o = last?.seaKingOutcome;
  if (e.terminal || e.startHistoryIndex === null || !last || !validateSeaKingRoundOutcome(o) || o.continuing || c.round !== last.round + 1 ||
      s.combatHistory.length - e.startHistoryIndex !== last.round || !same(s.combatHistory.at(-1), last) ||
      o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || o.enemySpirituality !== e.enemySpirituality || o.waterSource !== e.waterSource || !same(o.powerUses, e.powerUses) ||
      !same(o.enemyInjuriesAfter, c.enemyInjuries) || o.enemyRiskAfter !== c.enemyRisk ||
      o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality ||
      (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS')) ||
      (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
      (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
      (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')))
    throw new Error('真实原身体、水源或资源与已保存战斗结果不符。');
  e.terminal = { outcome: outcome as SeaKingEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('原码头冲突结束', `${outcome === 'PLAYER_DEAD' ? '玩家原身体真实死亡，风水雷不复活。' : outcome === 'RETREATED' ? '本人沿净空普通出口离开，无追逐或瞬移。' : outcome === 'ENEMY_DEAD' ? '原昆廷真实死亡，自己的唯一原棍留在原码头。' : '原昆廷仍活着，因真实重伤停止抵抗，把自己的唯一原棍放在原码头。'}本轮有限风水雷已结束；实付灵性、共同伤势与原水源保留，旧本尼迪克特死亡、旧原人原物不改。`);
}
export function seaKingEncounterActions(s: SliceState): SeaKingEncounterAction[] {
  if (!stage(s)) return [];
  return ([['ENCOUNTER_TALK', '前往原干燥码头交谈', '1行动 · 另留开战1行动'], ['ENCOUNTER_FIGHT', '承担原昆廷的真实冲突', '1行动 · 真实受伤或死亡风险'],
    ['LEAVE_ENCOUNTER', '沿原出口和平离开', '0行动']] as const).map(([type, label, cost]) => {
    const command: SeaKingEncounterCommand = { type }, reason = blockSeaKingEncounter(s, command);
    return { id: `seaKing-${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectSeaKingEncounter(s: SliceState): SeaKingEncounterProjection {
  const e = s.seaKing.encounter;
  if (!hasHistory(s)) return { title: '尚未开放的海王遭遇', story: '', status: e.status, inside: false, waterSource: null, enemy: null, actions: [], facts: [] };
  return { title: '原码头与独立的昆廷', story: SEA_KING_ENCOUNTER_STORY, status: e.status, inside: hasSeaKingEncounterLock(s), waterSource: e.waterSource,
    enemy: { id: SEA_KING_TARGET_ID, name: '昆廷', age: 49, source: 'ORIGINAL_DRY_QUAY_ADULT', sequence: 3, health: e.enemyHealth,
      mind: e.enemyMind, spirituality: e.enemySpirituality, status: e.enemyStatus, weaponId: 'SK3-QUENTIN-CLUB', weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses } },
    actions: seaKingEncounterActions(s), facts: ['海王序列3名称有原文依据；本场人物、范围与所有定量为有限G', '2米净空原干燥码头，实际普通出口，无追逐，施术区无第三人',
      `当前真实水源${e.waterSource}；海域与敌水护均须真实海水，不能从内陆造水`, '敌五类行动权重35/25/20/15/5，共100；专注只抵本轮下一成功风水压力，不抵雷击',
      `不生成船只、信徒或海生物库，不自动豁免友军；旧本尼迪克特H${s.cataclysmPriest.encounter.enemy.health}/${s.cataclysmPriest.encounter.enemy.status}、原棍${s.cataclysmPriest.encounter.enemy.weaponLocation}保留`] };
}
/** Original-opponent and resource continuity. The shared wheel owns actual injury resolution. */
export function validateSeaKingEncounter(s: SliceState): boolean {
  try {
    const e = s.seaKing?.encounter, initial = createSeaKingEncounterState();
    if (!e || !same(Object.keys(e).sort(), Object.keys(initial).sort()) || e.targetId !== SEA_KING_TARGET_ID ||
        !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || !['SEAWATER', 'NONE'].includes(e.waterSource) ||
        !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 1, 100) || !integer(e.enemySpirituality, 0, 120) || !integer(e.enemyRisk) ||
        !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) ||
        e.weaponLocation !== (e.enemyStatus === 'RESISTING' ? 'HAND' : 'QUAY') || !Array.isArray(e.enemyInjuries) ||
        !e.powerUses || Object.keys(e.powerUses).length !== 3 || !SEA_KING_POWER_IDS.every(id => integer(e.powerUses[id])) ||
        e.enemySpirituality !== 120 - SEA_KING_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) ||
        [e.approachWeek, e.attemptWeek].some(w => w !== null && !integer(w, 1, s.week))) return false;
    if (e.status === 'AVAILABLE') return same(e, initial) && s.combat?.encounterId !== 'SEA_KING_DISPUTE';
    if (!hasHistory(s) || s.seaKing.promotionWeek === null || e.approachWeek === null || e.approachWeek < s.seaKing.promotionWeek) return false;
    if (s.progression.sequence === 2) {
      const inheritedAt = s.catastrophe?.promotionWeek;
      if (!integer(inheritedAt, s.seaKing.promotionWeek, s.week) || ['READY', 'FIGHTING'].includes(e.status) || e.approachWeek > inheritedAt || e.attemptWeek !== null && e.attemptWeek > inheritedAt) return false;
    }
    if (e.startHistoryIndex === null) return ['READY', 'RESOLVED'].includes(e.status) && e.attemptWeek === null && e.terminal === null &&
      same({ ...e, status: initial.status, approachWeek: null }, initial) && s.combat?.encounterId !== 'SEA_KING_DISPUTE';
    if (!integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek === null || e.attemptWeek < e.approachWeek) return false;
    const end = e.terminal ? e.terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
    for (const [i, round] of rounds.entries()) {
      const o = round.seaKingOutcome, previous = rounds[i - 1]?.seaKingOutcome;
      if (!validateSeaKingRoundOutcome(o) || round.round !== i + 1 || o.round !== round.round || o.stance !== round.stance || round.winner === null ||
          o.source.runId !== s.runId || o.source.startHistoryIndex !== e.startHistoryIndex || o.source.attemptWeek !== e.attemptWeek ||
          (i < rounds.length - 1 && (!o.continuing || round.retreat === 'SUCCESS'))) return false;
      if (previous ? o.source.enemyHealth !== previous.enemyHealth || o.source.enemyMind !== previous.enemyMind ||
          o.source.playerHealth !== previous.playerHealthAfter || o.source.playerMind !== previous.playerMindAfter ||
          o.playerSpiritualityBefore !== Math.min(120, previous.playerSpiritualityAfter + 12) || o.enemySpiritualityBefore !== previous.enemySpirituality ||
          !same(o.source.powerUses, previous.powerUses) || o.source.waterSource !== previous.waterSource ||
          !same(o.source.enemyInjuries, previous.enemyInjuriesAfter) || o.source.enemyRisk !== previous.enemyRiskAfter ||
          ['knowledge', 'will', 'tempestMastery', 'windMastery', 'lightningMastery', 'clubHeld'].some(k => !same(o.source[k as keyof typeof o.source], previous.source[k as keyof typeof previous.source]))
        : o.source.enemyHealth !== 100 || o.source.enemyMind !== 100 || o.enemySpiritualityBefore !== 120 || Object.values(o.source.powerUses).some(n => n !== 0) || o.source.enemyInjuries.length !== 0 || o.source.enemyRisk !== 0) return false;
      const moves = [...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))]
        .sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
      if (!same(moves, round.moves) || o.playerActions.length > round.playerCount || o.enemyActions.length > round.enemyCount) return false;
    }
    const last = rounds.at(-1), o = last?.seaKingOutcome;
    if (o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemySpirituality !== e.enemySpirituality || o.enemyStatus !== e.enemyStatus ||
        !same(o.powerUses, e.powerUses) || o.waterSource !== e.waterSource || !same(o.enemyInjuriesAfter, e.enemyInjuries) || o.enemyRiskAfter !== e.enemyRisk)) return false;
    if (e.status === 'FIGHTING') return e.terminal === null && hasSeaKingDisputeOpponent(s) &&
      (o ? o.continuing && same(last, s.combat!.lastRound) && s.spirituality === Math.min(120, o.playerSpiritualityAfter + 12) && s.health === o.playerHealthAfter && s.mind === o.playerMindAfter
        : s.combat!.lastRound === null && e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 120 && e.enemyInjuries.length === 0 && e.enemyRisk === 0);
    const t = e.terminal;
    if (s.combat?.encounterId === 'SEA_KING_DISPUTE' || !t || !last || !o || o.continuing || !integer(t.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1) ||
        t.round !== last.round || rounds.length !== t.round || t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus) return false;
    if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY' && o.playerHealthAfter > 0;
    if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 && last.winner === 'ENEMY';
    return e.status === 'RESOLVED' && last.winner === 'PLAYER' && last.retreat === 'NONE' &&
      (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' : t.outcome === 'ENEMY_SURRENDERED' && e.enemyStatus === 'SURRENDERED');
  } catch { return false; }
}
