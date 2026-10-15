import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasUnshadowedLifeLock } from '../unshadowed/life.js';
import { hasUnshadowedRitualLock } from '../unshadowed/ritual.js';
import { hasPriestOfLightOpenPractice } from '../priest-of-light/encounter.js';
import { hasJusticeMentorLifeLock } from './life.js';
import { justiceMentorActionCount, justiceMentorEnemyActionCount, validateJusticeMentorRoundOutcome } from './combat.js';

export const JUSTICE_MENTOR_TARGET_ID = 'JM3-CORWIN' as const;
export const JUSTICE_MENTOR_POWER_IDS = ['LIGHT_STRIKE', 'LIGHT_WARD', 'FOCUS'] as const;
export type JusticeMentorPowerId = typeof JUSTICE_MENTOR_POWER_IDS[number];
export type JusticeMentorEnemyIntent = JusticeMentorPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const JUSTICE_MENTOR_POWERS = [
  { id: 'LIGHT_STRIKE', label: '原创G有限光击', cost: 5, selfGain: 75, enemyReduction: 0 },
  { id: 'LIGHT_WARD', label: '原创G有限防光', cost: 4, selfGain: 0, enemyReduction: 45 },
  { id: 'FOCUS', label: '原创G本轮有限定神', cost: 4, selfGain: 0, enemyReduction: 0 },
] as const;
export interface JusticeMentorEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface JusticeMentorEncounterScene {
  courtId: 'JM3-COURT'; ground: 'DRY'; ordinaryExit: 'OPEN'; thirdPartiesInArea: 0; clearanceConfirmed: boolean;
}
export interface JusticeMentorEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof JUSTICE_MENTOR_TARGET_ID;
  approachWeek: number | null; attemptWeek: number | null; startHistoryIndex: number | null; scene: JusticeMentorEncounterScene;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  weaponLocation: 'HAND' | 'COURT'; enemyInjuries: SliceInjury[]; enemyRisk: number; powerUses: Record<JusticeMentorPowerId, number>;
  terminal: JusticeMentorEncounterTerminal | null;
}
export type JusticeMentorEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface JusticeMentorEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: JusticeMentorEncounterCommand }
export interface JusticeMentorEncounterProjection {
  title: string; story: string; status: JusticeMentorEncounterState['status']; inside: boolean; scene: JusticeMentorEncounterScene | null;
  enemy: null | { id: typeof JUSTICE_MENTOR_TARGET_ID; name: '科温'; age: 49; source: 'ORIGINAL_CLEARED_COURT_ADULT_G'; sequence: 3;
    health: number; mind: number; spirituality: number; status: JusticeMentorEncounterState['enemyStatus'];
    weaponId: 'JM3-CORWIN-CLUB'; weaponLocation: 'HAND' | 'COURT'; powerUses: Record<JusticeMentorPowerId, number> };
  actions: JusticeMentorEncounterAction[]; facts: string[];
}
export const JUSTICE_MENTOR_ENCOUNTER_STORY = '成年科温（49岁，JM3-CORWIN）在独立原净空干院JM3-COURT，持自己的唯一原棍JM3-CORWIN-CLUB提出通路争议。他是原创有限G3等效光术对手，独立H100/M100/S120，自有G光术不代表原著太阳途径技能。旧47岁埃德蒙UD4-EDMUND的实际身体结果、原棍位置与其他原物历史全部保留。双方原身体相距2米，原普通出口开放、没有追击；交谈时先实际确认其他人确在界外，再明确选择交战或和平离开。玩家六槽共享光辉25/清晰标记20/旧无暗领域15/旧净化光20/普通避让15/偏差5。共享光辉6S意志18成功优势65G，本场仅鼓舞本人，不生成队友或补精力；清晰标记6S知识18成功减势32G，只辅助看见同一原棍动作与已有标记，不识心、不定罪。旧领域5S意志16减势18×旧掌握，旧净化光6S意志18优势34×旧掌握；系数0.65+0.35×掌握/500，普通活人无邪恶倍率。新技巧名称与所有范围定量均为本作G。灵性不足仅普通0S回退，检验失败照耗。敌五类光击35/防光25/原棍20/定神15/偏差5，实际付费5/4/0/4/0S。定神只抵本轮下一次成功清晰标记或领域牵制一次，不抵共享鼓舞、普通太阳攻击或共同伤势盘。此处净空是经确认的场景事实，不赋予太阳自动友军免疫。太阳作用仍会波及原环境；共同伤势盘决定身体后果，没有直接扣H/M、强制契约、道德雷达或名称即死。';
export function createJusticeMentorEncounterState(): JusticeMentorEncounterState {
  return { status: 'AVAILABLE', targetId: JUSTICE_MENTOR_TARGET_ID, approachWeek: null, attemptWeek: null, startHistoryIndex: null, scene: { courtId: 'JM3-COURT', ground: 'DRY', ordinaryExit: 'OPEN', thirdPartiesInArea: 0, clearanceConfirmed: false },
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', enemyInjuries: [], enemyRisk: 0,
    powerUses: { LIGHT_STRIKE: 0, LIGHT_WARD: 0, FOCUS: 0 }, terminal: null };
}
const stage = (s: SliceState) => s.progression.pathwayId === 'sun' && s.progression.sequence === 3;
const hasHistory = (s: SliceState) => s.progression.pathwayId === 'sun' && [3, 2].includes(s.progression.sequence ?? 0);
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function validateJusticeMentorEncounterCommand(v: unknown): v is JusticeMentorEncounterCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 &&
    ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String((v as { type: unknown }).type));
}
export const isJusticeMentorEncounterCommand = validateJusticeMentorEncounterCommand;
export const hasJusticeMentorEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.justiceMentor.encounter.status);
export const isInsideJusticeMentorEncounter = hasJusticeMentorEncounterLock;
function otherSceneOpen(s: SliceState): boolean {
  return s.justiceMentor.preparedWeek !== null || hasJusticeMentorLifeLock(s) || Object.values(s.justiceMentor.life.cases).some(r => r.status === 'PREPARED') ||
    hasUnshadowedLifeLock(s) || hasUnshadowedRitualLock(s) || Object.values(s.unshadowed.life.cases).some(r => r.status === 'PREPARED') ||
    ['READY', 'FIGHTING'].includes(s.unshadowed.encounter.status) || hasPriestOfLightOpenPractice(s) ||
    Object.values(s.priestOfLight.cases).some(r => r.status === 'PREPARED');
}
function actualCourt(e: JusticeMentorEncounterState, confirmed = true): boolean {
  return e.scene?.courtId === 'JM3-COURT' && e.scene.ground === 'DRY' && e.scene.ordinaryExit === 'OPEN' &&
    e.scene.thirdPartiesInArea === 0 && (!confirmed || e.scene.clearanceConfirmed === true);
}
export function blockJusticeMentorEncounter(s: SliceState, c: JusticeMentorEncounterCommand): string | null {
  if (!validateJusticeMentorEncounterCommand(c)) return '正义导师遭遇命令无效。';
  const e = s.justiceMentor.encounter;
  if (s.status !== 'ACTIVE' || !stage(s) || s.health <= 0) return '须本人仍活着并已成为正义导师·太阳序列3。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德原净空干院空场。';
  if (otherSceneOpen(s)) return '先实际收束当前工院、旧实践、准备与原物借还。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status !== 'READY' ? '须先到场交谈，才能沿原普通出口和平离开。' : e.scene.ordinaryExit !== 'OPEN' ? '须原普通出口确实畅通。' : null;
  if (!actualCourt(e, e.status === 'READY')) return '须原JM3-COURT真实干燥净空、普通出口开放，并先实际确认第三人在界外。';
  if (s.mind <= 0) return '先恢复精神；尚未开战仍可普通离开。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') return e.status !== 'AVAILABLE' ? '同一原科温已有进展或结局，不重新生成或补充资源。'
    : s.actionsRemaining < 2 ? '交谈需1行动，另留1行动供明确开战；仍可和平离开。' : null;
  return e.status === 'READY' ? null : '先实际交谈，确认原人、原棍、净空原院和普通出口。';
}
export const justiceMentorEncounterReason = blockJusticeMentorEncounter;
export function applyJusticeMentorEncounterCommand(s: SliceState, c: JusticeMentorEncounterCommand, ctx: SeerContext): void {
  const reason = blockJusticeMentorEncounter(s, c); if (reason) throw new Error(reason);
  const e = s.justiceMentor.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') { e.status = 'RESOLVED'; ctx.note('沿原净空干院普通出口和平离开', '本人普通离开，没有追逐、瞬移或战斗奖励；原科温及自己的原棍留场，旧埃德蒙实际结果与所有原人原物历史保留。'); return; }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') { e.status = 'READY'; e.approachWeek = s.week; e.scene.clearanceConfirmed = true; ctx.note('与原科温实际交谈', JUSTICE_MENTOR_ENCOUNTER_STORY + '本次尚未替你选择开战。'); return; }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'JUSTICE_MENTOR_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('承担原净空干院的真实冲突', '双方用同一原身体、各自原棍与独立实际灵性交战。本场其他人确在界外，净空场没有第三人不等于全游戏自动友军免疫；共同伤势、死亡、撤退无豁免。');
}
export const applyJusticeMentorEncounter = applyJusticeMentorEncounterCommand;
export function startJusticeMentorEncounter(s: SliceState, ctx: SeerContext): void { applyJusticeMentorEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasJusticeMentorDisputeOpponent(s: SliceState): boolean {
  const e = s.justiceMentor?.encounter, c = s.combat;
  return stage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && !otherSceneOpen(s) &&
    !!e && e.status === 'FIGHTING' && e.targetId === JUSTICE_MENTOR_TARGET_ID && e.terminal === null && e.enemyStatus === 'RESISTING' && e.weaponLocation === 'HAND' &&
    actualCourt(e) && e.approachWeek !== null && e.attemptWeek === s.week && c?.encounterId === 'JUSTICE_MENTOR_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 &&
    e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind && same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk &&
    integer(e.enemySpirituality, 0, 120) && JUSTICE_MENTOR_POWER_IDS.every(id => integer(e.powerUses[id])) &&
    e.enemySpirituality === 120 - JUSTICE_MENTOR_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) &&
    integer(c.round, 1) && e.startHistoryIndex !== null && integer(e.startHistoryIndex) && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
export function settleJusticeMentorEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.justiceMentor.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'JUSTICE_MENTOR_DISPUTE') throw new Error('没有同一原科温的真实战斗。');
  if (outcome === 'CONTINUE') return;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知原干院战斗结果。');
  const last = c.lastRound, o = last?.justiceMentorOutcome;
  if (e.terminal || e.startHistoryIndex === null || !last || !validateJusticeMentorRoundOutcome(o) || o.continuing || c.round !== last.round + 1 ||
      s.combatHistory.length - e.startHistoryIndex !== last.round || !same(s.combatHistory.at(-1), last) ||
      o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || o.enemySpirituality !== e.enemySpirituality || !same(o.powerUses, e.powerUses) ||
      !same(o.enemyInjuriesAfter, c.enemyInjuries) || o.enemyRiskAfter !== c.enemyRisk ||
      o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality ||
      (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS')) ||
      (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
      (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
      (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')))
    throw new Error('真实原身体、原场或资源与已保存战斗结果不符。');
  e.terminal = { outcome: outcome as JusticeMentorEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('原干院冲突结束', `${outcome === 'PLAYER_DEAD' ? '玩家原身体真实死亡，太阳光术不复活。' : outcome === 'RETREATED' ? '本人沿净空普通出口离开，无追逐或瞬移。' : outcome === 'ENEMY_DEAD' ? '原科温真实死亡，自己的唯一原棍留在原干院。' : '原科温仍活着，因真实重伤停止抵抗，把自己的唯一原棍放在原干院。'}本轮有限太阳光术已结束；实付灵性、共同伤势与原环境保留，旧埃德蒙实际结果、旧原人原物不改。`);
}
export function justiceMentorEncounterActions(s: SliceState): JusticeMentorEncounterAction[] {
  if (!stage(s)) return [];
  return ([['ENCOUNTER_TALK', '前往原净空干院交谈', '1行动 · 另留开战1行动'], ['ENCOUNTER_FIGHT', '承担原科温的真实冲突', '1行动 · 真实受伤或死亡风险'],
    ['LEAVE_ENCOUNTER', '沿原出口和平离开', '0行动']] as const).map(([type, label, cost]) => {
    const command: JusticeMentorEncounterCommand = { type }, reason = blockJusticeMentorEncounter(s, command);
    return { id: `justiceMentor-${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectJusticeMentorEncounter(s: SliceState): JusticeMentorEncounterProjection {
  const e = s.justiceMentor.encounter;
  if (!hasHistory(s)) return { title: '尚未开放的正义导师遭遇', story: '', status: e.status, inside: false, scene: null, enemy: null, actions: [], facts: [] };
  return { title: '原干院与独立的科温', story: JUSTICE_MENTOR_ENCOUNTER_STORY, status: e.status, inside: hasJusticeMentorEncounterLock(s), scene: { ...e.scene },
    enemy: { id: JUSTICE_MENTOR_TARGET_ID, name: '科温', age: 49, source: 'ORIGINAL_CLEARED_COURT_ADULT_G', sequence: 3, health: e.enemyHealth,
      mind: e.enemyMind, spirituality: e.enemySpirituality, status: e.enemyStatus, weaponId: 'JM3-CORWIN-CLUB', weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses } },
    actions: justiceMentorEncounterActions(s), facts: ['正义导师序列3名称有原文依据；两项新技巧、本场人物、敌方光术与所有定量均为原创有限G',
      '2米原净空干院，实际普通出口开放、无追击；确认别人确在界外不提供全局友军免疫',
      '敌五类行动权重35/25/20/15/5，共100；定神只抵本轮下一成功清晰标记或领域牵制，不抵净化光攻击与伤势盘',
      '共享光辉本场仅鼓舞本人；清晰标记只观察原棍已有动作与标记，不判善恶、不生成证据',
      `旧埃德蒙H${s.unshadowed.encounter.enemy.health}/${s.unshadowed.encounter.enemy.status}、原棍${s.unshadowed.encounter.enemy.weaponLocation}保留；原情感回输与旧原件均不改写`] };
}
/** Original-opponent and resource continuity. The shared wheel owns actual injury resolution. */
export function validateJusticeMentorEncounter(s: SliceState): boolean {
  try {
    const e = s.justiceMentor?.encounter, initial = createJusticeMentorEncounterState();
    if (!e || !same(Object.keys(e).sort(), Object.keys(initial).sort()) || e.targetId !== JUSTICE_MENTOR_TARGET_ID ||
        !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || !actualCourt(e, e.status !== 'AVAILABLE') || !same(Object.keys(e.scene).sort(), Object.keys(initial.scene).sort()) ||
        !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 1, 100) || !integer(e.enemySpirituality, 0, 120) || !integer(e.enemyRisk) ||
        !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) ||
        e.weaponLocation !== (e.enemyStatus === 'RESISTING' ? 'HAND' : 'COURT') || !Array.isArray(e.enemyInjuries) ||
        !e.powerUses || Object.keys(e.powerUses).length !== 3 || !JUSTICE_MENTOR_POWER_IDS.every(id => integer(e.powerUses[id])) ||
        e.enemySpirituality !== 120 - JUSTICE_MENTOR_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) ||
        [e.approachWeek, e.attemptWeek].some(w => w !== null && !integer(w, 1, s.week))) return false;
    if (e.status === 'AVAILABLE') return same(e, initial) && s.combat?.encounterId !== 'JUSTICE_MENTOR_DISPUTE';
    if (!hasHistory(s) || s.justiceMentor.promotionWeek === null || e.approachWeek === null || e.approachWeek < s.justiceMentor.promotionWeek) return false;
    if (s.progression.sequence === 2) {
      const inheritedAt = s.lightSeeker?.promotionWeek;
      if (!integer(inheritedAt, s.justiceMentor.promotionWeek, s.week) || ['READY', 'FIGHTING', 'LOST'].includes(e.status) || e.approachWeek > inheritedAt || e.attemptWeek !== null && e.attemptWeek > inheritedAt) return false;
    }
    if (e.startHistoryIndex === null) return ['READY', 'RESOLVED'].includes(e.status) && e.attemptWeek === null && e.terminal === null &&
      same({ ...e, status: initial.status, approachWeek: null, scene: { ...e.scene, clearanceConfirmed: false } }, initial) && s.combat?.encounterId !== 'JUSTICE_MENTOR_DISPUTE';
    if (!integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek === null || e.attemptWeek < e.approachWeek) return false;
    const end = e.terminal ? e.terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
    for (const [i, round] of rounds.entries()) {
      const o = round.justiceMentorOutcome, previous = rounds[i - 1]?.justiceMentorOutcome;
      if (!validateJusticeMentorRoundOutcome(o) || round.round !== i + 1 || o.round !== round.round || o.stance !== round.stance || round.winner === null ||
          o.source.runId !== s.runId || o.source.startHistoryIndex !== e.startHistoryIndex || o.source.attemptWeek !== e.attemptWeek ||
          (i < rounds.length - 1 && (!o.continuing || round.retreat === 'SUCCESS'))) return false;
      if (previous ? o.source.enemyHealth !== previous.enemyHealth || o.source.enemyMind !== previous.enemyMind ||
          o.source.playerHealth !== previous.playerHealthAfter || o.source.playerMind !== previous.playerMindAfter ||
          o.playerSpiritualityBefore !== Math.min(120, previous.playerSpiritualityAfter + 12) || o.enemySpiritualityBefore !== previous.enemySpirituality ||
          !same(o.source.powerUses, previous.powerUses) ||
          !same(o.source.enemyInjuries, previous.enemyInjuriesAfter) || o.source.enemyRisk !== previous.enemyRiskAfter ||
          ['knowledge', 'will', 'domainMastery', 'purificationMastery', 'clubHeld'].some(k => !same(o.source[k as keyof typeof o.source], previous.source[k as keyof typeof previous.source]))
        : o.source.enemyHealth !== 100 || o.source.enemyMind !== 100 || o.enemySpiritualityBefore !== 120 || Object.values(o.source.powerUses).some(n => n !== 0) || o.source.enemyInjuries.length !== 0 || o.source.enemyRisk !== 0) return false;
      const moves = [...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))]
        .sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
      const first = round.round % 2 === 1 ? 'PLAYER' : 'ENEMY';
      if (!integer(round.playerCountRoll, 1, 100) || !integer(round.enemyCountRoll, 1, 100) || round.first !== first ||
          round.playerCount !== justiceMentorActionCount(round.playerCountRoll) || round.enemyCount !== justiceMentorEnemyActionCount(round.enemyCountRoll) ||
          !same(moves, round.moves)) return false;
      // Replay the shared adapter's actual alternating order, including a retreat that ends before remaining slots.
      const expectedActors: ('PLAYER' | 'ENEMY')[] = [];
      const remaining = { PLAYER: round.playerCount, ENEMY: round.enemyCount };
      const order = first === 'PLAYER' ? ['PLAYER', 'ENEMY'] as const : ['ENEMY', 'PLAYER'] as const;
      let retreated = false;
      while (!retreated && (remaining.PLAYER > 0 || remaining.ENEMY > 0)) {
        for (const actor of order) {
          if (remaining[actor] === 0) continue;
          if (actor === 'PLAYER' && round.stance === 'RETREAT') {
            remaining.PLAYER = 0;
            if (round.retreat === 'SUCCESS') { retreated = true; break; }
            if (round.retreat !== 'FAILURE') return false;
          } else { remaining[actor]--; expectedActors.push(actor); }
        }
      }
      if ((round.stance !== 'RETREAT' && round.retreat !== 'NONE') || !same(expectedActors, moves.map(a => a.actor))) return false;
    }
    const last = rounds.at(-1), o = last?.justiceMentorOutcome;
    if (o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemySpirituality !== e.enemySpirituality || o.enemyStatus !== e.enemyStatus ||
        !same(o.powerUses, e.powerUses) || !same(o.enemyInjuriesAfter, e.enemyInjuries) || o.enemyRiskAfter !== e.enemyRisk)) return false;
    if (e.status === 'FIGHTING') return e.terminal === null && hasJusticeMentorDisputeOpponent(s) &&
      (o ? o.continuing && same(last, s.combat!.lastRound) && s.spirituality === Math.min(120, o.playerSpiritualityAfter + 12) && s.health === o.playerHealthAfter && s.mind === o.playerMindAfter
        : s.combat!.lastRound === null && e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 120 && e.enemyInjuries.length === 0 && e.enemyRisk === 0);
    const t = e.terminal;
    if (s.combat?.encounterId === 'JUSTICE_MENTOR_DISPUTE' || !t || !last || !o || o.continuing || !integer(t.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1) ||
        t.round !== last.round || rounds.length !== t.round || t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus) return false;
    if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY' && o.playerHealthAfter > 0;
    if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 && last.winner === 'ENEMY';
    return e.status === 'RESOLVED' && last.winner === 'PLAYER' && last.retreat === 'NONE' &&
      (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' : t.outcome === 'ENEMY_SURRENDERED' && e.enemyStatus === 'SURRENDERED');
  } catch { return false; }
}
