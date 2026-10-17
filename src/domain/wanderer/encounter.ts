import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasSecretsSorcererLifeLock } from '../secrets-sorcerer/life.js';
import { hasSecretsSorcererOldPractice } from '../secrets-sorcerer/index.js';
import { hasSecretsSorcererRitualLock } from '../secrets-sorcerer/ritual.js';
import { hasWandererRitualLock } from './index.js';
import { hasWandererLifeLock } from './life.js';
import { wandererActionCount, wandererEnemyActionCount, validateWandererRoundOutcome } from './combat.js';

export const WANDERER_TARGET_ID = 'WN3-CASSIAN' as const;
export const WANDERER_POWER_IDS = ['VECTOR_STRIKE', 'REFRACT_WARD', 'PARALLAX'] as const;
export type WandererPowerId = typeof WANDERER_POWER_IDS[number];
export type WandererEnemyIntent = WandererPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const WANDERER_POWERS = [
  { id: 'VECTOR_STRIKE', label: '原创G有限定点折光击', cost: 5, selfGain: 75, enemyReduction: 0 },
  { id: 'REFRACT_WARD', label: '原创G有限折光屏护', cost: 4, selfGain: 0, enemyReduction: 45 },
  { id: 'PARALLAX', label: '原创G本轮有限视差', cost: 4, selfGain: 0, enemyReduction: 0 },
] as const;
export interface WandererEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface WandererEncounterScene {
  courtId: 'WN3-COURT'; ground: 'DRY'; ordinaryExit: 'OPEN'; thirdPartiesInArea: 0; clearanceConfirmed: boolean; playerPosition: 'ORIGIN' | 'SIDE';
}
export interface WandererEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof WANDERER_TARGET_ID;
  approachWeek: number | null; attemptWeek: number | null; startHistoryIndex: number | null; scene: WandererEncounterScene;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  weaponLocation: 'HAND' | 'COURT'; enemyInjuries: SliceInjury[]; enemyRisk: number; powerUses: Record<WandererPowerId, number>;
  terminal: WandererEncounterTerminal | null;
}
export type WandererEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface WandererEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: WandererEncounterCommand }
export interface WandererEncounterProjection {
  title: string; story: string; status: WandererEncounterState['status']; inside: boolean; scene: WandererEncounterScene | null;
  enemy: null | { id: typeof WANDERER_TARGET_ID; name: '卡西安·格里夫'; age: 49; source: 'ORIGINAL_COURT_ADULT_G'; sequence: 3;
    health: number; mind: number; spirituality: number; status: WandererEncounterState['enemyStatus'];
    weaponId: 'WN3-CASSIAN-ROD'; weaponLocation: 'HAND' | 'COURT'; powerUses: Record<WandererPowerId, number> };
  actions: WandererEncounterAction[]; facts: string[];
}
export const WANDERER_ENCOUNTER_STORY = '成年卡西安·格里夫（49岁，WN3-CASSIAN）在原干院WN3-COURT持自己的唯一原杖WN3-CASSIAN-ROD提出通路争议。他是本场原创有限G3等效对手，独立H100/M100/S120，自有定点折光击与屏护，不是旧秘法师半神B复活。双方原身体相距2米，原普通出口开放、没有追击、无第三人；先交谈确认，再明确选择交战或和平离开。玩家六槽侧避25/定位20/继承小电击20/继承旅行15/普通避让15/偏差5。新侧避6S感知18减势36，同槽原身体到原侧位1米并返回1米，起止敌距2米；定位6S知识18自身优势30，两者均不致伤。旧小电击6S知识16优势36×掌握、旧旅行6S感知16减势22×掌握，系数0.65+0.35×掌握/500。敌五类折光击35/屏护25/原杖20/视差15/偏差5，实际付费5/4/0/4/0S。视差只抵本轮下一成功定位或新侧避一次。只有实际小电击或普通STRIKE威胁共同伤势盘；失败照耗，灵性不足仅普通回退。本场没有星际打击、隐形、任意星空目标或复活，也不消费或复制原记录库。旧半神和原箱全部历史保持。';
export function createWandererEncounterState(): WandererEncounterState {
  return { status: 'AVAILABLE', targetId: WANDERER_TARGET_ID, approachWeek: null, attemptWeek: null, startHistoryIndex: null, scene: { courtId: 'WN3-COURT', ground: 'DRY', ordinaryExit: 'OPEN', thirdPartiesInArea: 0, clearanceConfirmed: false, playerPosition: 'ORIGIN' },
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', enemyInjuries: [], enemyRisk: 0,
    powerUses: { VECTOR_STRIKE: 0, REFRACT_WARD: 0, PARALLAX: 0 }, terminal: null };
}
const stage = (s: SliceState) => s.progression.pathwayId === 'door' && s.progression.sequence === 3;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function validateWandererEncounterCommand(v: unknown): v is WandererEncounterCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 &&
    ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String((v as { type: unknown }).type));
}
export const isWandererEncounterCommand = validateWandererEncounterCommand;
export const hasWandererEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.wanderer.encounter.status);
export const isInsideWandererEncounter = hasWandererEncounterLock;
function otherSceneOpen(s: SliceState): boolean {
  return hasWandererRitualLock(s) || hasWandererLifeLock(s) || Object.values(s.wanderer.life.cases).some(r => r.status === 'PREPARED') ||
    hasSecretsSorcererLifeLock(s) || hasSecretsSorcererRitualLock(s) || hasSecretsSorcererOldPractice(s) ||
    s.secretsSorcerer.life.pocket.linked || s.secretsSorcerer.life.pocket.mode !== 'NONE' ||
    Object.values(s.secretsSorcerer.life.cases).some(r => r.status === 'PREPARED' || r.suspended);
}
function actualCourt(e: WandererEncounterState, confirmed = true): boolean {
  return e.scene?.courtId === 'WN3-COURT' && e.scene.ground === 'DRY' && e.scene.ordinaryExit === 'OPEN' &&
    e.scene.thirdPartiesInArea === 0 && e.scene.playerPosition === 'ORIGIN' && (!confirmed || e.scene.clearanceConfirmed === true);
}
export function blockWandererEncounter(s: SliceState, c: WandererEncounterCommand): string | null {
  if (!validateWandererEncounterCommand(c)) return '漫游者遭遇命令无效。';
  const e = s.wanderer.encounter;
  if (s.status !== 'ACTIVE' || !stage(s) || s.health <= 0) return '须本人仍活着并已成为漫游者·门序列3。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (!s.wanderer.guidanceKnown || s.wanderer.promotionWeek === null) return '须保有赫斯特的实际指导且已完成漫游者晋升，不能复用旧半神原人。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德原净空干院空场。';
  if (otherSceneOpen(s)) return '先在本地原工坊实际收束当前实践、准备与原物借还。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status !== 'READY' ? '须先到场交谈，才能沿原普通出口和平离开。' : e.scene.ordinaryExit !== 'OPEN' ? '须原普通出口确实畅通。' : null;
  if (!actualCourt(e, e.status === 'READY')) return '须原WN3-COURT真实干燥净空、普通出口开放，并先实际确认第三人在界外。';
  if (s.mind <= 0) return '先恢复精神；尚未开战仍可普通离开。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') return e.status !== 'AVAILABLE' ? '同一原卡西安·格里夫已有进展或结局，不重新生成或补充资源。'
    : s.actionsRemaining < 2 ? '交谈需1行动，另留1行动供明确开战；仍可和平离开。' : null;
  return e.status === 'READY' ? null : '先实际交谈，确认原人、原杖、净空原院和普通出口。';
}
export const wandererEncounterReason = blockWandererEncounter;
export function applyWandererEncounterCommand(s: SliceState, c: WandererEncounterCommand, ctx: SeerContext): void {
  const reason = blockWandererEncounter(s, c); if (reason) throw new Error(reason);
  const e = s.wanderer.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') { e.status = 'RESOLVED'; ctx.note('沿原净空干院普通出口和平离开', '本人普通离开，没有追逐、瞬移或战斗奖励；原卡西安·格里夫及自己的原杖留场，旧秘法师半神、原箱、原记录和随身物品的历史保留。'); return; }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') { e.status = 'READY'; e.approachWeek = s.week; e.scene.clearanceConfirmed = true; ctx.note('与原卡西安·格里夫实际交谈', WANDERER_ENCOUNTER_STORY + '本次尚未替你选择开战。'); return; }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'WANDERER_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('承担原净空干院的真实冲突', '双方用同一原身体、独立原武器与实际灵性交战。本场第三人确在界外；共同伤势、死亡、撤退无豁免，原敌和自己的原杖不被侧避搬走。');
}
export const applyWandererEncounter = applyWandererEncounterCommand;
export function startWandererEncounter(s: SliceState, ctx: SeerContext): void { applyWandererEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasWandererDisputeOpponent(s: SliceState): boolean {
  const e = s.wanderer?.encounter, c = s.combat;
  return s.wanderer.guidanceKnown && s.wanderer.promotionWeek !== null && stage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && !otherSceneOpen(s) &&
    !!e && e.status === 'FIGHTING' && e.targetId === WANDERER_TARGET_ID && e.terminal === null && e.enemyStatus === 'RESISTING' && e.weaponLocation === 'HAND' &&
    actualCourt(e) && e.approachWeek !== null && e.attemptWeek === s.week && c?.encounterId === 'WANDERER_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 &&
    e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind && same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk &&
    integer(e.enemySpirituality, 0, 120) && WANDERER_POWER_IDS.every(id => integer(e.powerUses[id])) &&
    e.enemySpirituality === 120 - WANDERER_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) &&
    integer(c.round, 1) && e.startHistoryIndex !== null && integer(e.startHistoryIndex) && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
export function settleWandererEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.wanderer.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'WANDERER_DISPUTE') throw new Error('没有同一原卡西安·格里夫的真实战斗。');
  if (outcome === 'CONTINUE') return;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知原干院战斗结果。');
  const last = c.lastRound, o = last?.wandererOutcome;
  if (e.terminal || e.startHistoryIndex === null || !last || !validateWandererRoundOutcome(o) || o.continuing || c.round !== last.round + 1 ||
      s.combatHistory.length - e.startHistoryIndex !== last.round || !same(s.combatHistory.at(-1), last) ||
      o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || o.enemySpirituality !== e.enemySpirituality || !same(o.powerUses, e.powerUses) ||
      !same(o.enemyInjuriesAfter, c.enemyInjuries) || o.enemyRiskAfter !== c.enemyRisk ||
      o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality ||
      (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS')) ||
      (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
      (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
      (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')))
    throw new Error('真实原身体、原场或资源与已保存战斗结果不符。');
  e.terminal = { outcome: outcome as WandererEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('原干院冲突结束', `${outcome === 'PLAYER_DEAD' ? '玩家原身体真实死亡，不自动返回、复活或补充灵性。' : outcome === 'RETREATED' ? '本人沿净空普通出口离开，无追逐或瞬移。' : outcome === 'ENEMY_DEAD' ? '原卡西安·格里夫真实死亡，自己的唯一原杖留在原干院。' : '原卡西安·格里夫仍活着，因真实重伤停止抵抗，把自己的唯一原杖放在原干院。'}本轮有限侧避、定位与屏护已结束；实付灵性、共同伤势和已经实际完成的侧避记录保留，旧秘法师目标、封框与原记录库不改。`);
}
export function wandererEncounterActions(s: SliceState): WandererEncounterAction[] {
  if (!stage(s)) return [];
  return ([['ENCOUNTER_TALK', '前往原净空干院交谈', '1行动 · 另留开战1行动'], ['ENCOUNTER_FIGHT', '承担原卡西安·格里夫的真实冲突', '1行动 · 真实受伤或死亡风险'],
    ['LEAVE_ENCOUNTER', '沿原出口和平离开', '0行动']] as const).map(([type, label, cost]) => {
    const command: WandererEncounterCommand = { type }, reason = blockWandererEncounter(s, command);
    return { id: `wanderer-${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectWandererEncounter(s: SliceState): WandererEncounterProjection {
  const e = s.wanderer.encounter;
  if (!stage(s)) return { title: '尚未开放的漫游者遭遇', story: '', status: e.status, inside: false, scene: null, enemy: null, actions: [], facts: [] };
  return { title: '原干院与独立的卡西安·格里夫', story: WANDERER_ENCOUNTER_STORY, status: e.status, inside: hasWandererEncounterLock(s), scene: { ...e.scene },
    enemy: { id: WANDERER_TARGET_ID, name: '卡西安·格里夫', age: 49, source: 'ORIGINAL_COURT_ADULT_G', sequence: 3, health: e.enemyHealth,
      mind: e.enemyMind, spirituality: e.enemySpirituality, status: e.enemyStatus, weaponId: 'WN3-CASSIAN-ROD', weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses } },
    actions: wandererEncounterActions(s), facts: ['漫游者3本体空间漫游方向有原核；本场端点、技巧、原人物与所有定量均为有限原创G',
      '原干院相距2米，原普通出口开放、无追击；卡西安为独立原人，旧秘法师各目标仅作历史保留',
      '新侧避同槽真实侧移1米再返回1米，定位只给自身优势；不隐形、不作星际打击，不直接扣H/M或强制投降',
      '敌视差只抵本轮下一成功新定位或侧避，不挡旧小电击、旧旅行闪避或共同伤势盘',
      `当前原卡西安战史实际侧避${s.combatHistory.reduce((n, r) => n + (r.wandererOutcome?.movementCount ?? 0), 0)}段，共${s.combatHistory.reduce((n, r) => n + (r.wandererOutcome?.totalMetres ?? 0), 0)}米；每次两段结束均回原位，原敌距2米`,
      ...s.secretsSorcerer.ritual.targets.map(t => `旧目标${t.id}历史${t.status}/H${t.body.health}保持；不替换成卡西安或再次生成`)] };


}
/** Original-opponent and resource continuity. The shared wheel owns actual injury resolution. */
export function validateWandererEncounter(s: SliceState): boolean {
  try {
    const e = s.wanderer?.encounter, initial = createWandererEncounterState();
    if (!e || !same(Object.keys(e).sort(), Object.keys(initial).sort()) || e.targetId !== WANDERER_TARGET_ID ||
        !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || !actualCourt(e, e.status !== 'AVAILABLE') || !same(Object.keys(e.scene).sort(), Object.keys(initial.scene).sort()) ||
        !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 1, 100) || !integer(e.enemySpirituality, 0, 120) || !integer(e.enemyRisk) ||
        !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) ||
        e.weaponLocation !== (e.enemyStatus === 'RESISTING' ? 'HAND' : 'COURT') || !Array.isArray(e.enemyInjuries) ||
        !e.powerUses || Object.keys(e.powerUses).length !== 3 || !WANDERER_POWER_IDS.every(id => integer(e.powerUses[id])) ||
        e.enemySpirituality !== 120 - WANDERER_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) ||
        [e.approachWeek, e.attemptWeek].some(w => w !== null && !integer(w, 1, s.week))) return false;
    if (e.status === 'AVAILABLE') return same(e, initial) && s.combat?.encounterId !== 'WANDERER_DISPUTE';
    if (!(s.progression.pathwayId==='door'&&[3,2].includes(s.progression.sequence??0)) || !s.wanderer.guidanceKnown || s.wanderer.promotionWeek === null || e.approachWeek === null || e.approachWeek < s.wanderer.promotionWeek) return false;
    if (e.startHistoryIndex === null) return ['READY', 'RESOLVED'].includes(e.status) && e.attemptWeek === null && e.terminal === null &&
      same({ ...e, status: initial.status, approachWeek: null, scene: { ...e.scene, clearanceConfirmed: false, playerPosition: 'ORIGIN' } }, initial) && s.combat?.encounterId !== 'WANDERER_DISPUTE';
    if (!integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek === null || e.attemptWeek < e.approachWeek) return false;
    const end = e.terminal ? e.terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
    for (const [i, round] of rounds.entries()) {
      const o = round.wandererOutcome, previous = rounds[i - 1]?.wandererOutcome;
      if (!validateWandererRoundOutcome(o) || round.round !== i + 1 || o.round !== round.round || o.stance !== round.stance || round.winner === null ||
          o.source.runId !== s.runId || o.source.startHistoryIndex !== e.startHistoryIndex || o.source.attemptWeek !== e.attemptWeek ||
          (i < rounds.length - 1 && (!o.continuing || round.retreat === 'SUCCESS'))) return false;
      if (previous ? o.source.enemyHealth !== previous.enemyHealth || o.source.enemyMind !== previous.enemyMind ||
          o.source.playerHealth !== previous.playerHealthAfter || o.source.playerMind !== previous.playerMindAfter ||
          o.playerSpiritualityBefore !== Math.min(120, previous.playerSpiritualityAfter + 12) || o.enemySpiritualityBefore !== previous.enemySpirituality ||
          !same(o.source.powerUses, previous.powerUses) ||
          !same(o.source.enemyInjuries, previous.enemyInjuriesAfter) || o.source.enemyRisk !== previous.enemyRiskAfter ||
          ['knowledge', 'perception', 'tricksMastery', 'travelMastery', 'clubHeld'].some(k => !same(o.source[k as keyof typeof o.source], previous.source[k as keyof typeof previous.source]))
        : o.source.enemyHealth !== 100 || o.source.enemyMind !== 100 || o.enemySpiritualityBefore !== 120 || Object.values(o.source.powerUses).some(n => n !== 0) || o.source.enemyInjuries.length !== 0 || o.source.enemyRisk !== 0) return false;
      const moves = [...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))]
        .sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
      const first = round.round % 2 === 1 ? 'PLAYER' : 'ENEMY';
      if (!integer(round.playerCountRoll, 1, 100) || !integer(round.enemyCountRoll, 1, 100) || round.first !== first ||
          round.playerCount !== wandererActionCount(round.playerCountRoll) || round.enemyCount !== wandererEnemyActionCount(round.enemyCountRoll) ||
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
    const last = rounds.at(-1), o = last?.wandererOutcome;
    if (o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemySpirituality !== e.enemySpirituality || o.enemyStatus !== e.enemyStatus ||
        !same(o.powerUses, e.powerUses) || !same(o.enemyInjuriesAfter, e.enemyInjuries) || o.enemyRiskAfter !== e.enemyRisk)) return false;
    if (e.status === 'FIGHTING') return e.terminal === null && hasWandererDisputeOpponent(s) &&
      (o ? o.continuing && same(last, s.combat!.lastRound) && s.spirituality === Math.min(120, o.playerSpiritualityAfter + 12) && s.health === o.playerHealthAfter && s.mind === o.playerMindAfter
        : s.combat!.lastRound === null && e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 120 && e.enemyInjuries.length === 0 && e.enemyRisk === 0);
    const t = e.terminal;
    if (s.combat?.encounterId === 'WANDERER_DISPUTE' || !t || !last || !o || o.continuing || !integer(t.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1) ||
        t.round !== last.round || rounds.length !== t.round || t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus) return false;
    if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY' && o.playerHealthAfter > 0;
    if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 && last.winner === 'ENEMY';
    return e.status === 'RESOLVED' && last.winner === 'PLAYER' && last.retreat === 'NONE' &&
      (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' : t.outcome === 'ENEMY_SURRENDERED' && e.enemyStatus === 'SURRENDERED');
  } catch { return false; }
}
