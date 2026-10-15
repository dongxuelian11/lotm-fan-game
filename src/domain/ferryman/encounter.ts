import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasUndyingLifeLock, hasUndyingOldPractice } from '../undying/life.js';
import { hasUndyingRitualLock } from '../undying/ritual.js';
import { activeFerrymanChannel, hasFerrymanRitualLock } from './index.js';
import { hasFerrymanLifeLock } from './life.js';
import { ferrymanActionCount, ferrymanEnemyActionCount, validateFerrymanRoundOutcome } from './combat.js';

export const FERRYMAN_TARGET_ID = 'FR3-ROWAN' as const;
export const FERRYMAN_POWER_IDS = ['ECHO_STRIKE', 'SEAL_WARD', 'FOCUS'] as const;
export type FerrymanPowerId = typeof FERRYMAN_POWER_IDS[number];
export type FerrymanEnemyIntent = FerrymanPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const FERRYMAN_POWERS = [
  { id: 'ECHO_STRIKE', label: '原创G有限灵体干扰攻击', cost: 5, selfGain: 75, enemyReduction: 0 },
  { id: 'SEAL_WARD', label: '原创G有限屏护', cost: 4, selfGain: 0, enemyReduction: 45 },
  { id: 'FOCUS', label: '原创G本轮有限定神', cost: 4, selfGain: 0, enemyReduction: 0 },
] as const;
export interface FerrymanEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface FerrymanEncounterScene {
  courtId: 'FR3-COURT'; ground: 'DRY'; ordinaryExit: 'OPEN'; thirdPartiesInArea: 0; clearanceConfirmed: boolean;
}
export interface FerrymanEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof FERRYMAN_TARGET_ID;
  sourceEpoch: 'ORIGINAL' | 'POST_CYCLE' | null; approachWeek: number | null; attemptWeek: number | null; startHistoryIndex: number | null; scene: FerrymanEncounterScene;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  weaponLocation: 'HAND' | 'COURT'; enemyInjuries: SliceInjury[]; enemyRisk: number; powerUses: Record<FerrymanPowerId, number>;
  terminal: FerrymanEncounterTerminal | null;
}
export type FerrymanEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface FerrymanEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: FerrymanEncounterCommand }
export interface FerrymanEncounterProjection {
  title: string; story: string; status: FerrymanEncounterState['status']; inside: boolean; scene: FerrymanEncounterScene | null;
  enemy: null | { id: typeof FERRYMAN_TARGET_ID; name: '罗温·谢尔'; age: 51; source: 'CURRENT_CHANNEL_COURT_ADULT_G'; sourceEpoch: 'ORIGINAL' | 'POST_CYCLE' | null; sequence: 3;
    health: number; mind: number; spirituality: number; status: FerrymanEncounterState['enemyStatus'];
    weaponId: 'FR3-ROWAN-CLUB'; weaponLocation: 'HAND' | 'COURT'; powerUses: Record<FerrymanPowerId, number> };
  actions: FerrymanEncounterAction[]; facts: string[];
}
export const FERRYMAN_ENCOUNTER_STORY = '成年罗温·谢尔（51岁，FR3-ROWAN）在本次真实渠道时代、晋升后才接触的原干院FR3-COURT，持自己的唯一原棍FR3-ROWAN-CLUB提出通路争议。他是本场原创有限G3等效对手，独立H100/M100/S120，自有明确G灵体干扰与屏护技巧，不冒充原著纯序列3技能。旧欧文的原身体结果、原棍位置与已经发生的六十年历史全部保留；不将旧人复活成罗温，也不声称他在旧年代等了六十年。双方原身体相距2米，原普通出口开放、没有追击；先交谈确认原人和出口，再明确选择交战或和平离开。玩家六槽有限摆渡25/离程屏护20/继承死者之语20/继承冥界借力封印15/普通避让15/偏差5。新两项6S、意志18减势36与知识18减势32，只限制本轮短窗口，不搬运活人、剥离或永久控制灵魂。旧死者之语6S意志16优势38×原掌握、旧封印6S知识16减势20×原掌握，系数0.65+0.35×掌握/500。名称与范围定量均明确G；灵性不足仅普通0S回退，检验失败照耗。敌五类灵体干扰攻击35/屏护25/原棍20/定神15/偏差5，实际付费5/4/0/4/0S。定神只抵本轮下一成功有限摆渡或旧封印一次，不抵护持、死者之语攻击或共同伤势盘。只有实际攻击威胁伤势；减势不直接扣H/M或强制投降。原灰羽不免费帮战，当地原芦羽不是战宠；不生成幽灵军队、不治疗、不因摆渡人之名复活。';
export function createFerrymanEncounterState(): FerrymanEncounterState {
  return { status: 'AVAILABLE', targetId: FERRYMAN_TARGET_ID, sourceEpoch: null, approachWeek: null, attemptWeek: null, startHistoryIndex: null, scene: { courtId: 'FR3-COURT', ground: 'DRY', ordinaryExit: 'OPEN', thirdPartiesInArea: 0, clearanceConfirmed: false },
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', enemyInjuries: [], enemyRisk: 0,
    powerUses: { ECHO_STRIKE: 0, SEAL_WARD: 0, FOCUS: 0 }, terminal: null };
}
const stage = (s: SliceState) => s.progression.pathwayId === 'death' && s.progression.sequence === 3;
const hasHistory = (s: SliceState) => s.progression.pathwayId === 'death' && [3, 2].includes(s.progression.sequence ?? 0);
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function validateFerrymanEncounterCommand(v: unknown): v is FerrymanEncounterCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 &&
    ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String((v as { type: unknown }).type));
}
export const isFerrymanEncounterCommand = validateFerrymanEncounterCommand;
export const hasFerrymanEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.ferryman.encounter.status);
export const isInsideFerrymanEncounter = hasFerrymanEncounterLock;
function currentChannel(s: SliceState) {
  const channel = activeFerrymanChannel(s);
  if (!channel || channel.introducedWeek > s.week || channel.provider.id !== (channel.id === 'ORIGINAL' ? 'FR3-LEWIS' : 'FR3-HANNA')) return null;
  return channel;
}
function otherSceneOpen(s: SliceState): boolean {
  const channel = currentChannel(s);
  if (!channel || hasFerrymanRitualLock(s) || hasFerrymanLifeLock(s) || Object.values(s.ferryman.life.cases).some(r => r.status === 'PREPARED')) return true;
  // After the handoff, old people and objects remain historical. Only current scenes own new actions.
  if (channel.id === 'POST_CYCLE') return s.ferryman.era.location !== 'RECEPTION';
  return hasUndyingLifeLock(s) || hasUndyingRitualLock(s) || hasUndyingOldPractice(s) ||
    ['READY', 'FIGHTING'].includes(s.undying.encounter.status);
}
function actualCourt(e: FerrymanEncounterState, confirmed = true): boolean {
  return e.scene?.courtId === 'FR3-COURT' && e.scene.ground === 'DRY' && e.scene.ordinaryExit === 'OPEN' &&
    e.scene.thirdPartiesInArea === 0 && (!confirmed || e.scene.clearanceConfirmed === true);
}
export function blockFerrymanEncounter(s: SliceState, c: FerrymanEncounterCommand): string | null {
  if (!validateFerrymanEncounterCommand(c)) return '摆渡人遭遇命令无效。';
  const e = s.ferryman.encounter;
  if (s.status !== 'ACTIVE' || !stage(s) || s.health <= 0) return '须本人仍活着并已成为摆渡人·死神序列3。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  const channel = currentChannel(s);
  if (!channel || e.sourceEpoch !== null && e.sourceEpoch !== channel.id) return '须本次真实介绍且尚未结束约定的摆渡人渠道，不能复用旧时代原人。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德原净空干院空场。';
  if (otherSceneOpen(s)) return '先在本次接待处实际收束当前实践、准备与原物借还。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status !== 'READY' ? '须先到场交谈，才能沿原普通出口和平离开。' : e.scene.ordinaryExit !== 'OPEN' ? '须原普通出口确实畅通。' : null;
  if (!actualCourt(e, e.status === 'READY')) return '须原FR3-COURT真实干燥净空、普通出口开放，并先实际确认第三人在界外。';
  if (s.mind <= 0) return '先恢复精神；尚未开战仍可普通离开。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') return e.status !== 'AVAILABLE' ? '同一原罗温·谢尔已有进展或结局，不重新生成或补充资源。'
    : s.actionsRemaining < 2 ? '交谈需1行动，另留1行动供明确开战；仍可和平离开。' : null;
  return e.status === 'READY' ? null : '先实际交谈，确认原人、原棍、净空原院和普通出口。';
}
export const ferrymanEncounterReason = blockFerrymanEncounter;
export function applyFerrymanEncounterCommand(s: SliceState, c: FerrymanEncounterCommand, ctx: SeerContext): void {
  const reason = blockFerrymanEncounter(s, c); if (reason) throw new Error(reason);
  const e = s.ferryman.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') { e.status = 'RESOLVED'; ctx.note('沿原净空干院普通出口和平离开', '本人普通离开，没有追逐、瞬移或战斗奖励；原罗温·谢尔及自己的原棍留场，旧欧文实际结果、原灰羽位置及所有原人原物历史保留。'); return; }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') { e.status = 'READY'; e.sourceEpoch = currentChannel(s)!.id; e.approachWeek = s.week; e.scene.clearanceConfirmed = true; ctx.note('与原罗温·谢尔实际交谈', FERRYMAN_ENCOUNTER_STORY + '本次尚未替你选择开战。'); return; }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'FERRYMAN_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('承担原净空干院的真实冲突', '双方用同一原身体、各自原棍与独立实际灵性交战。本场其他人确在界外，原灰羽与当地原芦羽都未派出；共同伤势、死亡、撤退无豁免，不搬运活人或复活旧人。');
}
export const applyFerrymanEncounter = applyFerrymanEncounterCommand;
export function startFerrymanEncounter(s: SliceState, ctx: SeerContext): void { applyFerrymanEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasFerrymanDisputeOpponent(s: SliceState): boolean {
  const e = s.ferryman?.encounter, c = s.combat, channel = currentChannel(s);
  return !!channel && e?.sourceEpoch === channel.id && stage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && !otherSceneOpen(s) &&
    !!e && e.status === 'FIGHTING' && e.targetId === FERRYMAN_TARGET_ID && e.terminal === null && e.enemyStatus === 'RESISTING' && e.weaponLocation === 'HAND' &&
    actualCourt(e) && e.approachWeek !== null && e.attemptWeek === s.week && c?.encounterId === 'FERRYMAN_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 &&
    e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind && same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk &&
    integer(e.enemySpirituality, 0, 120) && FERRYMAN_POWER_IDS.every(id => integer(e.powerUses[id])) &&
    e.enemySpirituality === 120 - FERRYMAN_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) &&
    integer(c.round, 1) && e.startHistoryIndex !== null && integer(e.startHistoryIndex) && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
export function settleFerrymanEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.ferryman.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'FERRYMAN_DISPUTE') throw new Error('没有同一原罗温·谢尔的真实战斗。');
  if (outcome === 'CONTINUE') return;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知原干院战斗结果。');
  const last = c.lastRound, o = last?.ferrymanOutcome;
  if (e.terminal || e.startHistoryIndex === null || !last || !validateFerrymanRoundOutcome(o) || o.continuing || c.round !== last.round + 1 ||
      s.combatHistory.length - e.startHistoryIndex !== last.round || !same(s.combatHistory.at(-1), last) ||
      o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || o.enemySpirituality !== e.enemySpirituality || !same(o.powerUses, e.powerUses) ||
      !same(o.enemyInjuriesAfter, c.enemyInjuries) || o.enemyRiskAfter !== c.enemyRisk ||
      o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality ||
      (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS')) ||
      (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
      (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
      (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')))
    throw new Error('真实原身体、原场或资源与已保存战斗结果不符。');
  e.terminal = { outcome: outcome as FerrymanEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('原干院冲突结束', `${outcome === 'PLAYER_DEAD' ? '玩家原身体真实死亡，摆渡人不触发不死者周期或战斗复活。' : outcome === 'RETREATED' ? '本人沿净空普通出口离开，无追逐或瞬移。' : outcome === 'ENEMY_DEAD' ? '原罗温·谢尔真实死亡，自己的唯一原棍留在原干院。' : '原罗温·谢尔仍活着，因真实重伤停止抵抗，把自己的唯一原棍放在原干院。'}本轮有限灵体迟滞与屏护已结束；实付灵性、共同伤势与原环境保留，旧欧文实际结果、原灰羽和本地原芦羽及旧物不改。`);
}
export function ferrymanEncounterActions(s: SliceState): FerrymanEncounterAction[] {
  if (!stage(s)) return [];
  return ([['ENCOUNTER_TALK', '前往原净空干院交谈', '1行动 · 另留开战1行动'], ['ENCOUNTER_FIGHT', '承担原罗温·谢尔的真实冲突', '1行动 · 真实受伤或死亡风险'],
    ['LEAVE_ENCOUNTER', '沿原出口和平离开', '0行动']] as const).map(([type, label, cost]) => {
    const command: FerrymanEncounterCommand = { type }, reason = blockFerrymanEncounter(s, command);
    return { id: `ferryman-${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectFerrymanEncounter(s: SliceState): FerrymanEncounterProjection {
  const e = s.ferryman.encounter;
  if (!hasHistory(s)) return { title: '尚未开放的摆渡人遭遇', story: '', status: e.status, inside: false, scene: null, enemy: null, actions: [], facts: [] };
  return { title: '原干院与独立的罗温·谢尔', story: FERRYMAN_ENCOUNTER_STORY, status: e.status, inside: hasFerrymanEncounterLock(s), scene: { ...e.scene },
    enemy: { id: FERRYMAN_TARGET_ID, name: '罗温·谢尔', age: 51, source: 'CURRENT_CHANNEL_COURT_ADULT_G', sourceEpoch: e.sourceEpoch, sequence: 3, health: e.enemyHealth,
      mind: e.enemyMind, spirituality: e.enemySpirituality, status: e.enemyStatus, weaponId: 'FR3-ROWAN-CLUB', weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses } },
    actions: ferrymanEncounterActions(s), facts: ['摆渡人序列3名称有原文依据；两项新技巧、本场人物、敌方技巧与所有定量均为原创有限G',
      '2米原干院，实际普通出口开放、无追击；仅在本次实际渠道时代登记此原人，不复原旧历史身体',
      '敌五类行动权重35/25/20/15/5，共100；定神只抵本轮下一成功摆渡或旧封印，不抵护持、死者之语攻击与伤势盘',
      '有限摆渡和离程屏护只减势，不直接扣H/M；原灰羽不自动参战，当地芦羽也不是战宠',
      `旧欧文历史H${s.undying.encounter.enemy.health}/${s.undying.encounter.enemy.status}、原棍${s.undying.encounter.enemy.weaponLocation}保留；该历史不等于后世仍在场`] };

}
/** Original-opponent and resource continuity. The shared wheel owns actual injury resolution. */
export function validateFerrymanEncounter(s: SliceState): boolean {
  try {
    const e = s.ferryman?.encounter, initial = createFerrymanEncounterState();
    if (!e || !same(Object.keys(e).sort(), Object.keys(initial).sort()) || e.targetId !== FERRYMAN_TARGET_ID ||
        !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || !actualCourt(e, e.status !== 'AVAILABLE') || !same(Object.keys(e.scene).sort(), Object.keys(initial.scene).sort()) ||
        !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 1, 100) || !integer(e.enemySpirituality, 0, 120) || !integer(e.enemyRisk) ||
        !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) ||
        e.weaponLocation !== (e.enemyStatus === 'RESISTING' ? 'HAND' : 'COURT') || !Array.isArray(e.enemyInjuries) ||
        !e.powerUses || Object.keys(e.powerUses).length !== 3 || !FERRYMAN_POWER_IDS.every(id => integer(e.powerUses[id])) ||
        e.enemySpirituality !== 120 - FERRYMAN_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) ||
        [e.approachWeek, e.attemptWeek].some(w => w !== null && !integer(w, 1, s.week))) return false;
    if (e.status === 'AVAILABLE') return same(e, initial) && s.combat?.encounterId !== 'FERRYMAN_DISPUTE';
    const channel = currentChannel(s);
    if (!hasHistory(s) || (s.progression.sequence === 2 && ['READY', 'FIGHTING'].includes(e.status)) || !channel || e.sourceEpoch !== channel.id || s.ferryman.promotionWeek === null || e.approachWeek === null || e.approachWeek < s.ferryman.promotionWeek || e.approachWeek < channel.introducedWeek) return false;
    if (e.startHistoryIndex === null) return ['READY', 'RESOLVED'].includes(e.status) && e.attemptWeek === null && e.terminal === null &&
      same({ ...e, status: initial.status, sourceEpoch: null, approachWeek: null, scene: { ...e.scene, clearanceConfirmed: false } }, initial) && s.combat?.encounterId !== 'FERRYMAN_DISPUTE';
    if (!integer(e.startHistoryIndex, 0, s.combatHistory.length) || e.attemptWeek === null || e.attemptWeek < e.approachWeek) return false;
    const end = e.terminal ? e.terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
    for (const [i, round] of rounds.entries()) {
      const o = round.ferrymanOutcome, previous = rounds[i - 1]?.ferrymanOutcome;
      if (!validateFerrymanRoundOutcome(o) || round.round !== i + 1 || o.round !== round.round || o.stance !== round.stance || round.winner === null ||
          o.source.runId !== s.runId || o.source.sourceEpoch !== e.sourceEpoch || o.source.providerId !== channel.provider.id || o.source.startHistoryIndex !== e.startHistoryIndex || o.source.attemptWeek !== e.attemptWeek ||
          (i < rounds.length - 1 && (!o.continuing || round.retreat === 'SUCCESS'))) return false;
      if (previous ? o.source.enemyHealth !== previous.enemyHealth || o.source.enemyMind !== previous.enemyMind ||
          o.source.playerHealth !== previous.playerHealthAfter || o.source.playerMind !== previous.playerMindAfter ||
          o.playerSpiritualityBefore !== Math.min(120, previous.playerSpiritualityAfter + 12) || o.enemySpiritualityBefore !== previous.enemySpirituality ||
          !same(o.source.powerUses, previous.powerUses) ||
          !same(o.source.enemyInjuries, previous.enemyInjuriesAfter) || o.source.enemyRisk !== previous.enemyRiskAfter ||
          ['knowledge', 'will', 'sealMastery', 'deadWordsMastery', 'clubHeld'].some(k => !same(o.source[k as keyof typeof o.source], previous.source[k as keyof typeof previous.source]))
        : o.source.enemyHealth !== 100 || o.source.enemyMind !== 100 || o.enemySpiritualityBefore !== 120 || Object.values(o.source.powerUses).some(n => n !== 0) || o.source.enemyInjuries.length !== 0 || o.source.enemyRisk !== 0) return false;
      const moves = [...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))]
        .sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
      const first = round.round % 2 === 1 ? 'PLAYER' : 'ENEMY';
      if (!integer(round.playerCountRoll, 1, 100) || !integer(round.enemyCountRoll, 1, 100) || round.first !== first ||
          round.playerCount !== ferrymanActionCount(round.playerCountRoll) || round.enemyCount !== ferrymanEnemyActionCount(round.enemyCountRoll) ||
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
    const last = rounds.at(-1), o = last?.ferrymanOutcome;
    if (o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemySpirituality !== e.enemySpirituality || o.enemyStatus !== e.enemyStatus ||
        !same(o.powerUses, e.powerUses) || !same(o.enemyInjuriesAfter, e.enemyInjuries) || o.enemyRiskAfter !== e.enemyRisk)) return false;
    if (e.status === 'FIGHTING') return e.terminal === null && hasFerrymanDisputeOpponent(s) &&
      (o ? o.continuing && same(last, s.combat!.lastRound) && s.spirituality === Math.min(120, o.playerSpiritualityAfter + 12) && s.health === o.playerHealthAfter && s.mind === o.playerMindAfter
        : s.combat!.lastRound === null && e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 120 && e.enemyInjuries.length === 0 && e.enemyRisk === 0);
    const t = e.terminal;
    if (s.combat?.encounterId === 'FERRYMAN_DISPUTE' || !t || !last || !o || o.continuing || !integer(t.historyIndex, e.startHistoryIndex, s.combatHistory.length - 1) ||
        t.round !== last.round || rounds.length !== t.round || t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus) return false;
    if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY' && o.playerHealthAfter > 0;
    if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 && last.winner === 'ENEMY';
    return e.status === 'RESOLVED' && last.winner === 'PLAYER' && last.retreat === 'NONE' &&
      (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' : t.outcome === 'ENEMY_SURRENDERED' && e.enemyStatus === 'SURRENDERED');
  } catch { return false; }
}
