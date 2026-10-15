import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasDeceitMentorRitualLock, hasDeceitMentorOldPractice } from './index.js';
import { hasDeceitMentorLifeLock } from './life.js';
import { deceitMentorActionCount, deceitMentorEnemyActionCount, validateDeceitMentorRoundOutcome } from './combat.js';

export const DECEIT_MENTOR_TARGET_ID = 'DM3-GIDEON' as const;
export const DECEIT_MENTOR_POWER_IDS = ['FORCE_STRIKE', 'GUARD', 'DISCERN'] as const;
export type DeceitMentorPowerId = typeof DECEIT_MENTOR_POWER_IDS[number];
export type DeceitMentorEnemyIntent = DeceitMentorPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const DECEIT_MENTOR_POWERS = [
  { id: 'FORCE_STRIKE', label: '原创G有限灵性冲击', cost: 5, selfGain: 70, enemyReduction: 0 },
  { id: 'GUARD', label: '原创G有限屏护', cost: 4, selfGain: 0, enemyReduction: 40 },
  { id: 'DISCERN', label: '原创G本轮有限辨伪', cost: 4, selfGain: 0, enemyReduction: 0 },
] as const;
export interface DeceitMentorEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface DeceitMentorEncounterScene {
  courtId: 'DM3-COURT'; ground: 'DRY'; ordinaryExit: 'OPEN'; thirdPartiesInArea: 0; clearanceConfirmed: boolean; playerPosition: 'ORIGIN';
}
export interface DeceitMentorEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof DECEIT_MENTOR_TARGET_ID;
  approachWeek: number | null; attemptWeek: number | null; startHistoryIndex: number | null; scene: DeceitMentorEncounterScene;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  weaponLocation: 'HAND' | 'COURT'; enemyInjuries: SliceInjury[]; enemyRisk: number; powerUses: Record<DeceitMentorPowerId, number>;
  terminal: DeceitMentorEncounterTerminal | null;
}
export type DeceitMentorEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface DeceitMentorEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: DeceitMentorEncounterCommand }
export interface DeceitMentorEncounterProjection {
  title: string; story: string; status: DeceitMentorEncounterState['status']; inside: boolean; scene: DeceitMentorEncounterScene | null;
  enemy: null | { id: typeof DECEIT_MENTOR_TARGET_ID; name: '吉迪恩·哈特'; age: 47; source: 'ORIGINAL_LIMITED_G'; sequence: 3;
    health: number; mind: number; spirituality: number; status: DeceitMentorEncounterState['enemyStatus'];
    weaponId: 'DM3-GIDEON-ROD'; weaponLocation: 'HAND' | 'COURT'; powerUses: Record<DeceitMentorPowerId, number> };
  actions: DeceitMentorEncounterAction[]; facts: string[];
}
export const DECEIT_MENTOR_ENCOUNTER_STORY = '成年吉迪恩·哈特（47岁，DM3-GIDEON）在净空原干院DM3-COURT持自己的唯一原杖DM3-GIDEON-ROD提出场地争议。他是本场原创有限G3等效对手，独立H100/M100/S120，自有灵性冲击、屏护与辨伪；并非普通人假施法，也不替换旧拉尔夫。原敌距2米、地面干燥、普通出口开放，无追逐或第三人。玩家六槽25/20/20/15/15/5：规则欺瞒6S/知识18减势36、深层欺瞒6S/知识18减势30、普通打击、避让、格挡、失衡。新欺瞒只影响当前这一轮的攻击时机或判断，不直接致伤、不控制身体、不偷取能力或制造燃料。敌五类冲击35/屏护25/原杖20/辨伪15/失衡5，实际付费5/4/0/4/0S；辨伪仅抵本轮下一次成功欺瞒一次。失败或抵抗仍实耗灵性，资源不足走原普通回退。双方同用1–6行动盘与共同伤势、死亡和普通撤退规则；只有实际普通STRIKE及敌实际冲击/原杖构成伤害威胁。本场动作、人物、距离、成本和数值均为G，不提供天使分身、命运替换或复活。';
export function createDeceitMentorEncounterState(): DeceitMentorEncounterState {
  return { status: 'AVAILABLE', targetId: DECEIT_MENTOR_TARGET_ID, approachWeek: null, attemptWeek: null, startHistoryIndex: null, scene: { courtId: 'DM3-COURT', ground: 'DRY', ordinaryExit: 'OPEN', thirdPartiesInArea: 0, clearanceConfirmed: false, playerPosition: 'ORIGIN' },
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', enemyInjuries: [], enemyRisk: 0,
    powerUses: { FORCE_STRIKE: 0, GUARD: 0, DISCERN: 0 }, terminal: null };
}
const stage = (s: SliceState) => s.progression.pathwayId === 'error' && s.progression.sequence === 3;
const hasHistory = (s: SliceState) => s.progression.pathwayId === 'error' && [3, 2].includes(s.progression.sequence ?? 0);
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function validateDeceitMentorEncounterCommand(v: unknown): v is DeceitMentorEncounterCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 &&
    ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String((v as { type: unknown }).type));
}
export const isDeceitMentorEncounterCommand = validateDeceitMentorEncounterCommand;
export const hasDeceitMentorEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.deceitMentor.encounter.status);
export const isInsideDeceitMentorEncounter = hasDeceitMentorEncounterLock;
function otherSceneOpen(s: SliceState): boolean {
  return hasDeceitMentorRitualLock(s) || hasDeceitMentorLifeLock(s) || Object.values(s.deceitMentor.life.cases).some(r => r.status === 'PREPARED') ||
    hasDeceitMentorOldPractice(s);
}
function actualCourt(e: DeceitMentorEncounterState, confirmed = true): boolean {
  return e.scene?.courtId === 'DM3-COURT' && e.scene.ground === 'DRY' && e.scene.ordinaryExit === 'OPEN' &&
    e.scene.thirdPartiesInArea === 0 && e.scene.playerPosition === 'ORIGIN' && (!confirmed || e.scene.clearanceConfirmed === true);
}
export function blockDeceitMentorEncounter(s: SliceState, c: DeceitMentorEncounterCommand): string | null {
  if (!validateDeceitMentorEncounterCommand(c)) return '欺瞒导师遭遇命令无效。';
  const e = s.deceitMentor.encounter;
  if (s.status !== 'ACTIVE' || !stage(s) || s.health <= 0) return '须本人仍活着并已成为欺瞒导师·错误序列3。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (!s.deceitMentor.guidanceKnown || s.deceitMentor.promotionWeek === null) return '须保有霍尔的实际指导且已完成欺瞒导师晋升，不能复用旧拉尔夫原人。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德原净空干院空场。';
  if (otherSceneOpen(s)) return '先在本地原工坊实际收束当前实践、准备与原物借还。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status !== 'READY' ? '须先到场交谈，才能沿原普通出口和平离开。' : e.scene.ordinaryExit !== 'OPEN' ? '须原普通出口确实畅通。' : null;
  if (!actualCourt(e, e.status === 'READY')) return '须原DM3-COURT真实干燥净空、普通出口开放，并先实际确认第三人在界外。';
  if (s.mind <= 0) return '先恢复精神；尚未开战仍可普通离开。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') return e.status !== 'AVAILABLE' ? '同一原吉迪恩·哈特已有进展或结局，不重新生成或补充资源。'
    : s.actionsRemaining < 2 ? '交谈需1行动，另留1行动供明确开战；仍可和平离开。' : null;
  return e.status === 'READY' ? null : '先实际交谈，确认原人、原杖、净空原院和普通出口。';
}
export const deceitMentorEncounterReason = blockDeceitMentorEncounter;
export function applyDeceitMentorEncounterCommand(s: SliceState, c: DeceitMentorEncounterCommand, ctx: SeerContext): void {
  const reason = blockDeceitMentorEncounter(s, c); if (reason) throw new Error(reason);
  const e = s.deceitMentor.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') { e.status = 'RESOLVED'; ctx.note('沿原净空干院普通出口和平离开', '本人普通离开，没有追逐、瞬移或战斗奖励；原吉迪恩·哈特及自己的原杖留场，旧拉尔夫、原宿主、旧暂窃记录和随身物品的历史保留。'); return; }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') { e.status = 'READY'; e.approachWeek = s.week; e.scene.clearanceConfirmed = true; ctx.note('与原吉迪恩·哈特实际交谈', DECEIT_MENTOR_ENCOUNTER_STORY + '本次尚未替你选择开战。'); return; }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'DECEIT_MENTOR_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('承担原净空干院的真实冲突', '双方用同一原身体、独立原武器与实际灵性交战。本场第三人确在界外；共同伤势、死亡、撤退无豁免，原敌和自己的原杖不被欺瞒搬走。');
}
export const applyDeceitMentorEncounter = applyDeceitMentorEncounterCommand;
export function startDeceitMentorEncounter(s: SliceState, ctx: SeerContext): void { applyDeceitMentorEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasDeceitMentorDisputeOpponent(s: SliceState): boolean {
  const e = s.deceitMentor?.encounter, c = s.combat;
  return s.deceitMentor.guidanceKnown && s.deceitMentor.promotionWeek !== null && stage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && !otherSceneOpen(s) &&
    !!e && e.status === 'FIGHTING' && e.targetId === DECEIT_MENTOR_TARGET_ID && e.terminal === null && e.enemyStatus === 'RESISTING' && e.weaponLocation === 'HAND' &&
    actualCourt(e) && e.approachWeek !== null && e.attemptWeek === s.week && c?.encounterId === 'DECEIT_MENTOR_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 &&
    e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind && same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk &&
    integer(s.deceitMentor.life.clockSeconds) && integer(e.enemySpirituality, 0, 120) && DECEIT_MENTOR_POWER_IDS.every(id => integer(e.powerUses[id])) &&
    e.enemySpirituality === 120 - DECEIT_MENTOR_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) &&
    integer(c.round, 1) && e.startHistoryIndex !== null && integer(e.startHistoryIndex) && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
export function settleDeceitMentorEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.deceitMentor.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'DECEIT_MENTOR_DISPUTE') throw new Error('没有同一原吉迪恩·哈特的真实战斗。');
  if (outcome === 'CONTINUE') return;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知原干院战斗结果。');
  const last = c.lastRound, o = last?.deceitMentorOutcome;
  if (e.terminal || e.startHistoryIndex === null || !last || !validateDeceitMentorRoundOutcome(o) || o.continuing || c.round !== last.round + 1 ||
      s.combatHistory.length - e.startHistoryIndex !== last.round || !same(s.combatHistory.at(-1), last) ||
      o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || o.enemySpirituality !== e.enemySpirituality || !same(o.powerUses, e.powerUses) ||
      !same(o.enemyInjuriesAfter, c.enemyInjuries) || o.enemyRiskAfter !== c.enemyRisk ||
      o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality || o.lifeClockSecondsAfter !== s.deceitMentor.life.clockSeconds ||
      (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS')) ||
      (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
      (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
      (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')))
    throw new Error('真实原身体、原场或资源与已保存战斗结果不符。');
  e.terminal = { outcome: outcome as DeceitMentorEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('原干院冲突结束', `${outcome === 'PLAYER_DEAD' ? '玩家原身体真实死亡，不自动返回、复活或补充灵性。' : outcome === 'RETREATED' ? '本人沿净空普通出口离开，无追逐或瞬移。' : outcome === 'ENEMY_DEAD' ? '原吉迪恩·哈特真实死亡，自己的唯一原杖留在原干院。' : '原吉迪恩·哈特仍活着，因真实重伤停止抵抗，把自己的唯一原杖放在原干院。'}本轮有限欺瞒、辨伪与屏护已结束；实付灵性与共同伤势保留，旧寄生者宿主、旧拉尔夫、原棍与暂窃历史不改。`);
}
export function deceitMentorEncounterActions(s: SliceState): DeceitMentorEncounterAction[] {
  if (!stage(s)) return [];
  return ([['ENCOUNTER_TALK', '前往原净空干院交谈', '1行动 · 另留开战1行动'], ['ENCOUNTER_FIGHT', '承担原吉迪恩·哈特的真实冲突', '1行动 · 真实受伤或死亡风险'],
    ['LEAVE_ENCOUNTER', '沿原出口和平离开', '0行动']] as const).map(([type, label, cost]) => {
    const command: DeceitMentorEncounterCommand = { type }, reason = blockDeceitMentorEncounter(s, command);
    return { id: `deceitMentor-${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectDeceitMentorEncounter(s: SliceState): DeceitMentorEncounterProjection {
  const e = s.deceitMentor.encounter;
  if (!hasHistory(s)) return { title: '尚未开放的欺瞒导师遭遇', story: '', status: e.status, inside: false, scene: null, enemy: null, actions: [], facts: [] };
  return { title: '原干院与独立的吉迪恩·哈特', story: DECEIT_MENTOR_ENCOUNTER_STORY, status: e.status, inside: hasDeceitMentorEncounterLock(s), scene: { ...e.scene },
    enemy: { id: DECEIT_MENTOR_TARGET_ID, name: '吉迪恩·哈特', age: 47, source: 'ORIGINAL_LIMITED_G', sequence: 3, health: e.enemyHealth,
      mind: e.enemyMind, spirituality: e.enemySpirituality, status: e.enemyStatus, weaponId: 'DM3-GIDEON-ROD', weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses } },
    actions: deceitMentorEncounterActions(s), facts: ['欺瞒导师规则欺瞒与诈骗深化方向有原核；本场技巧、原人物与所有定量均为有限原创G',
      '原干院相距2米，原普通出口开放、无追击；吉迪恩为独立原人，旧拉尔夫及原宿主只保留原历史',
      '新欺瞒只减当前优势，不直接扣H/M、不控制身体、不强迫投降；原物、身份、记忆与库存不改',
      '敌辨伪实耗4灵性，只抵本轮下一成功欺瞒一次；不叠加、不跨轮，不免疫普通打击或共同伤势盘',
      '本场普通STRIKE只用自己实际握持原棍或徒手；两个新欺瞒槽不提供旧能力/念头窃取',
      `已实际经过${s.combatHistory.reduce((n, r) => n + (r.deceitMentorOutcome?.elapsedSeconds ?? 0), 0)}秒战斗；每轮结束所有有限欺瞒停止，原敌剩余灵性与伤势保留`] };
}

/** Original-opponent and resource continuity. The shared wheel owns actual injury resolution. */
export function validateDeceitMentorEncounter(s: SliceState): boolean {
  try {
    const e = s.deceitMentor?.encounter, initial = createDeceitMentorEncounterState();
    if (!e || !same(Object.keys(e).sort(), Object.keys(initial).sort()) || e.targetId !== DECEIT_MENTOR_TARGET_ID ||
        !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || !actualCourt(e, e.status !== 'AVAILABLE') || !same(Object.keys(e.scene).sort(), Object.keys(initial.scene).sort()) ||
        !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 1, 100) || !integer(e.enemySpirituality, 0, 120) || !integer(e.enemyRisk) ||
        !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) ||
        e.weaponLocation !== (e.enemyStatus === 'RESISTING' ? 'HAND' : 'COURT') || !Array.isArray(e.enemyInjuries) ||
        !e.powerUses || Object.keys(e.powerUses).length !== 3 || !DECEIT_MENTOR_POWER_IDS.every(id => integer(e.powerUses[id])) ||
        e.enemySpirituality !== 120 - DECEIT_MENTOR_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) ||
        [e.approachWeek, e.attemptWeek].some(w => w !== null && !integer(w, 1, s.week))) return false;
    if (e.status === 'AVAILABLE') return same(e, initial) && s.combat?.encounterId !== 'DECEIT_MENTOR_DISPUTE';
    if (!hasHistory(s) || !s.deceitMentor.guidanceKnown || s.deceitMentor.promotionWeek === null || e.approachWeek === null || e.approachWeek < s.deceitMentor.promotionWeek) return false;
    if (e.startHistoryIndex === null) return ['READY', 'RESOLVED'].includes(e.status) && e.attemptWeek === null && e.terminal === null &&
      same({ ...e, status: initial.status, approachWeek: null, scene: { ...e.scene, clearanceConfirmed: false, playerPosition: 'ORIGIN' } }, initial) && s.combat?.encounterId !== 'DECEIT_MENTOR_DISPUTE';
    if (!integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek === null || e.attemptWeek < e.approachWeek) return false;
    const end = e.terminal ? e.terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
    for (const [i, round] of rounds.entries()) {
      const o = round.deceitMentorOutcome, previous = rounds[i - 1]?.deceitMentorOutcome;
      if (!validateDeceitMentorRoundOutcome(o) || round.round !== i + 1 || o.round !== round.round || o.stance !== round.stance || round.winner === null ||
          o.source.runId !== s.runId || o.source.startHistoryIndex !== e.startHistoryIndex || o.source.attemptWeek !== e.attemptWeek ||
          (i < rounds.length - 1 && (!o.continuing || round.retreat === 'SUCCESS'))) return false;
      if (previous ? o.source.enemyHealth !== previous.enemyHealth || o.source.enemyMind !== previous.enemyMind ||
          o.source.playerHealth !== previous.playerHealthAfter || o.source.playerMind !== previous.playerMindAfter ||
          o.playerSpiritualityBefore !== Math.min(120, previous.playerSpiritualityAfter + 12) || o.enemySpiritualityBefore !== previous.enemySpirituality ||
          !same(o.source.powerUses, previous.powerUses) ||
          !same(o.source.enemyInjuries, previous.enemyInjuriesAfter) || o.source.enemyRisk !== previous.enemyRiskAfter || o.source.lifeClockSeconds !== previous.lifeClockSecondsAfter ||
          ['knowledge', 'clubHeld'].some(k => !same(o.source[k as keyof typeof o.source], previous.source[k as keyof typeof previous.source]))
        : o.source.enemyHealth !== 100 || o.source.enemyMind !== 100 || o.enemySpiritualityBefore !== 120 || Object.values(o.source.powerUses).some(n => n !== 0) || o.source.enemyInjuries.length !== 0 || o.source.enemyRisk !== 0) return false;
      const moves = [...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))]
        .sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
      const first = round.round % 2 === 1 ? 'PLAYER' : 'ENEMY';
      if (!integer(round.playerCountRoll, 1, 100) || !integer(round.enemyCountRoll, 1, 100) || round.first !== first ||
          round.playerCount !== deceitMentorActionCount(round.playerCountRoll) || round.enemyCount !== deceitMentorEnemyActionCount(round.enemyCountRoll) ||
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
    const last = rounds.at(-1), o = last?.deceitMentorOutcome;
    if (o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemySpirituality !== e.enemySpirituality || o.enemyStatus !== e.enemyStatus ||
        !same(o.powerUses, e.powerUses) || !same(o.enemyInjuriesAfter, e.enemyInjuries) || o.enemyRiskAfter !== e.enemyRisk)) return false;
    if (e.status === 'FIGHTING') return e.terminal === null && hasDeceitMentorDisputeOpponent(s) &&
      (o ? o.continuing && same(last, s.combat!.lastRound) && s.spirituality === Math.min(120, o.playerSpiritualityAfter + 12) && s.health === o.playerHealthAfter && s.mind === o.playerMindAfter && s.deceitMentor.life.clockSeconds === o.lifeClockSecondsAfter
        : s.combat!.lastRound === null && e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 120 && e.enemyInjuries.length === 0 && e.enemyRisk === 0);
    const t = e.terminal;
    if (s.combat?.encounterId === 'DECEIT_MENTOR_DISPUTE' || !t || !last || !o || o.continuing || !integer(t.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1) ||
        t.round !== last.round || rounds.length !== t.round || t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus) return false;
    if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY' && o.playerHealthAfter > 0;
    if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 && last.winner === 'ENEMY';
    return e.status === 'RESOLVED' && last.winner === 'PLAYER' && last.retreat === 'NONE' &&
      (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' : t.outcome === 'ENEMY_SURRENDERED' && e.enemyStatus === 'SURRENDERED');
  } catch { return false; }
}
