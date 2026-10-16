import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasNightwatcherLifeLock } from '../nightwatcher/life.js';
import { hasFearBishopLifeLock } from '../fear-bishop/life.js';
import { hasConcealmentServantLifeLock } from './life.js';
import { validateConcealmentServantRoundOutcome, validateConcealmentServantCombatRound, validateConcealmentServantAbilityUses } from './combat.js';

export const CONCEALMENT_SERVANT_TARGET_ID = 'CS2-OSWIN' as const;
export const CONCEALMENT_SERVANT_POWER_IDS = ['DARK_BOLT', 'WARD', 'ANCHOR_LIGHT'] as const;
export type ConcealmentServantPowerId = typeof CONCEALMENT_SERVANT_POWER_IDS[number];
export type ConcealmentServantEnemyIntent = ConcealmentServantPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const CONCEALMENT_SERVANT_POWERS = [
  { id: 'DARK_BOLT', label: '有限暗矢', cost: 7, selfGain: 105, enemyReduction: 0 },
  { id: 'WARD', label: '有限护术', cost: 6, selfGain: 0, enemyReduction: 60 },
  { id: 'ANCHOR_LIGHT', label: '本轮有限照明锚', cost: 4, selfGain: 0, enemyReduction: 0 },
] as const;
export interface ConcealmentServantEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface ConcealmentServantAbilityUse { attempts: number; successes: number; effects: number }
export interface ConcealmentServantAbilityUses { BOUNDED_CONCEALMENT: ConcealmentServantAbilityUse; TRACE_VEIL: ConcealmentServantAbilityUse }
export interface ConcealmentServantEncounterRoom {
  id: 'CS2-OSWIN-ROOM'; widthMetres: 6; doorId: 'CS2-OSWIN-DOOR'; doorStatus: 'OPEN'; traceId: 'CS2-OSWIN-TRACE'; tracePresent: true;
}
export interface ConcealmentServantEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof CONCEALMENT_SERVANT_TARGET_ID;
  approachWeek: number | null; attemptWeek: number | null; startHistoryIndex: number | null;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  weaponLocation: 'HAND' | 'YARD'; enemyInjuries: SliceInjury[]; enemyRisk: number; powerUses: Record<ConcealmentServantPowerId, number>;
  terminal: ConcealmentServantEncounterTerminal | null;
  room: ConcealmentServantEncounterRoom; playerLocation: 'OUTSIDE' | 'DOORSTEP'; playerTravelMetres: number; clockSeconds: number; abilityUses: ConcealmentServantAbilityUses;
}
export type ConcealmentServantEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface ConcealmentServantEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ConcealmentServantEncounterCommand }
export interface ConcealmentServantEncounterProjection {
  title: string; story: string; status: ConcealmentServantEncounterState['status']; inside: boolean;
  enemy: null | { id: typeof CONCEALMENT_SERVANT_TARGET_ID; name: '奥斯温'; age: 47; source: 'ORIGINAL_OPEN_COURT_ADULT'; sequence: 2;
    health: number; mind: number; spirituality: number; status: ConcealmentServantEncounterState['enemyStatus'];
    weaponId: 'CS2-OSWIN-CLUB'; weaponLocation: 'HAND' | 'YARD'; powerUses: Record<ConcealmentServantPowerId, number> };
  actions: ConcealmentServantEncounterAction[]; facts: string[];
  room: ConcealmentServantEncounterRoom | null; playerLocation: 'OUTSIDE' | 'DOORSTEP'; playerTravelMetres: number; clockSeconds: number; abilityUses: ConcealmentServantAbilityUses;
}
export const CONCEALMENT_SERVANT_ENCOUNTER_STORY = '原创47岁奥斯温CS2-OSWIN（有限G2，身体核心24）持自己唯一原棍CS2-OSWIN-CLUB，独立H100/M100/S120，站在原6米房间外的可达门口。本人实际步行2米到原门槛，双方2米可达，身体从未离开普通门口；只可有限隐藏房间内部视线。房间隐秘6S/知识18成功开≤60秒窗口，遮踪5S/意志18仅对原弱标记开≤20秒窗口；本槽0优势，随后实际暗矢检索才消费窗口并减35/20G一次。敌原暗矢7S/105、护术6S/60、照明锚4S每轮一次，按实际顺序打断当前窗口或抵抗下一新窗口，不能回滚已完成效果。普通原棍20×身体仍能攻击已知门口身体。继承原黑暗毁灭6S/知识18、睡恐5S/意志18、厄运4S/意志16；原卷叶须真实取得，SEALED先2S派出0贡献，后槽2S协助减22，轮末召回。原门始终实际开放，离场须普通判定与2米步行；不因隐秘免费撤退。双方共同1至6次、胜负与65/30/5初始伤势盘；原死者、旧原物、伤势和原灵历史保持。场景、数值和限制均为G，不是完整原著权柄。';

export function createConcealmentServantEncounterState(): ConcealmentServantEncounterState {
  return { status: 'AVAILABLE', targetId: CONCEALMENT_SERVANT_TARGET_ID, approachWeek: null, attemptWeek: null, startHistoryIndex: null,
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', enemyInjuries: [], enemyRisk: 0,
    powerUses: { DARK_BOLT: 0, WARD: 0, ANCHOR_LIGHT: 0 }, terminal: null,
    room: { id: 'CS2-OSWIN-ROOM', widthMetres: 6, doorId: 'CS2-OSWIN-DOOR', doorStatus: 'OPEN', traceId: 'CS2-OSWIN-TRACE', tracePresent: true },
    playerLocation: 'OUTSIDE', playerTravelMetres: 0, clockSeconds: 0, abilityUses: { BOUNDED_CONCEALMENT: { attempts: 0, successes: 0, effects: 0 }, TRACE_VEIL: { attempts: 0, successes: 0, effects: 0 } } };
}
const stage = (s: SliceState) => s.progression.pathwayId === 'darkness' && s.progression.sequence === 2;
const same = (a: unknown, b: unknown) => a === b || (a !== undefined && b !== undefined && stableStringify(a) === stableStringify(b));
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function validateConcealmentServantEncounterCommand(v: unknown): v is ConcealmentServantEncounterCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 &&
    ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String((v as { type: unknown }).type));
}
export const isConcealmentServantEncounterCommand = validateConcealmentServantEncounterCommand;
export const hasConcealmentServantEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.concealmentServant.encounter.status);
export const isInsideConcealmentServantEncounter = hasConcealmentServantEncounterLock;
function otherSceneOpen(s: SliceState): boolean {
  return hasFearBishopLifeLock(s) || s.fearBishop.preparedWeek !== null || ['READY','FIGHTING'].includes(s.fearBishop.encounter.status) || s.concealmentServant.preparedWeek !== null || hasConcealmentServantLifeLock(s) || Object.values(s.concealmentServant.life.cases).some(r => r.status === 'PREPARED') ||
    hasNightwatcherLifeLock(s) || Object.values(s.nightwatcher.life.cases).some(r => r.status === 'PREPARED') ||
    ['READY', 'FIGHTING'].includes(s.nightwatcher.encounter.status) || s.nightwatcher.ritual.playerLocation !== 'OUTSIDE' ||
    Object.values(s.spiritWarlock.cases).some(r => r.contactOpen || r.status === 'PREPARED') ||
    s.spiritWarlock.practice.note !== 'TABLE' || s.spiritWarlock.practice.dreamOpen;
}
export function blockConcealmentServantEncounter(s: SliceState, c: ConcealmentServantEncounterCommand): string | null {
  if (!validateConcealmentServantEncounterCommand(c)) return '隐秘之仆遭遇命令无效。';
  const e = s.concealmentServant.encounter;
  if (s.status !== 'ACTIVE' || !stage(s) || s.health <= 0) return '须本人仍活着并已成为隐秘之仆2。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德原奥斯温房间的门口。';
  if (otherSceneOpen(s) || s.spiritWarlock.companion.status === 'DEPLOYED') return '先实际收束当前及旧实践、准备与原卷叶派出。';
  if (e.room.doorStatus !== 'OPEN') return '原门受阻，不能伪称普通离场。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' && e.playerLocation === 'DOORSTEP' ? null : '须先到场交谈，才能普通和平离开。';
  if (s.mind <= 0) return '先恢复精神；尚未开战仍可普通离开。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') return e.status !== 'AVAILABLE' ? '同一原奥斯温已有进展或结局，不重新生成或补充资源。'
    : s.actionsRemaining < 2 ? '交谈需1行动，另留1行动供明确开战；仍可和平离开。' : null;
  return e.status === 'READY' ? null : '先实际交谈，确认原人、原棍和普通出口。';
}
export const concealmentServantEncounterReason = blockConcealmentServantEncounter;
export function applyConcealmentServantEncounterCommand(s: SliceState, c: ConcealmentServantEncounterCommand, ctx: SeerContext): void {
  const reason = blockConcealmentServantEncounter(s, c); if (reason) throw new Error(reason);
  const e = s.concealmentServant.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') { e.status = 'RESOLVED'; e.playerLocation = 'OUTSIDE'; e.playerTravelMetres += 2; e.clockSeconds += 2; ctx.note('沿原门实际步行2米和平离开', '本人普通步行2米/2秒离开，没有追逐或战斗奖励；原奥斯温及自己的原棍留场，旧布拉姆死亡、旧原物和原卷叶全部历史保留。'); return; }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') { e.status = 'READY'; e.approachWeek = s.week; e.playerLocation = 'DOORSTEP'; e.playerTravelMetres += 2; e.clockSeconds += 2; ctx.note('与原奥斯温实际交谈', CONCEALMENT_SERVANT_ENCOUNTER_STORY + '本次尚未替你选择开战。'); return; }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'CONCEALMENT_SERVANT_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('承担原门口的真实冲突', '双方用同一原身体、原棍与独立实际灵性交战。原卷叶仍在实际原处，不自动派出；共同伤势、死亡、撤退无豁免。');
}
export const applyConcealmentServantEncounter = applyConcealmentServantEncounterCommand;
export function startConcealmentServantEncounter(s: SliceState, ctx: SeerContext): void { applyConcealmentServantEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, ctx); }
export function hasConcealmentServantDisputeOpponent(s: SliceState): boolean {
  const e = s.concealmentServant?.encounter, c = s.combat;
  return stage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && !otherSceneOpen(s) &&
    !!e && e.status === 'FIGHTING' && e.targetId === CONCEALMENT_SERVANT_TARGET_ID && e.terminal === null && e.enemyStatus === 'RESISTING' && e.weaponLocation === 'HAND' &&
    same(e.room, createConcealmentServantEncounterState().room) && e.playerLocation === 'DOORSTEP' && e.playerTravelMetres === 2 && e.clockSeconds === 2 + ((c?.round ?? 0) - 1) * 60 &&
    e.approachWeek !== null && e.attemptWeek === s.week && c?.encounterId === 'CONCEALMENT_SERVANT_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 &&
    e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind && same(e.enemyInjuries, c.enemyInjuries) && e.enemyRisk === c.enemyRisk &&
    integer(e.enemySpirituality, 0, 120) && CONCEALMENT_SERVANT_POWER_IDS.every(id => integer(e.powerUses[id])) &&
    e.enemySpirituality === 120 - CONCEALMENT_SERVANT_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) &&
    integer(c.round, 1) && e.startHistoryIndex !== null && integer(e.startHistoryIndex) && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
export function settleConcealmentServantEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.concealmentServant.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'CONCEALMENT_SERVANT_DISPUTE') throw new Error('没有同一原奥斯温的真实战斗。');
  if (outcome === 'CONTINUE') return;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知原庭战斗结果。');
  const last = c.lastRound, o = last?.concealmentServantOutcome;
  if (e.terminal || e.startHistoryIndex === null || !last || !validateConcealmentServantRoundOutcome(o) || !validateConcealmentServantCombatRound(last) || o.continuing || c.round !== last.round + 1 ||
      s.combatHistory.length - e.startHistoryIndex !== last.round || !same(s.combatHistory.at(-1), last) ||
      o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || o.enemySpirituality !== e.enemySpirituality || !same(o.companionAfter, s.spiritWarlock.companion) ||
      !same(o.abilityUses, e.abilityUses) || o.playerLocationAfter !== e.playerLocation || o.playerTravelMetresAfter !== e.playerTravelMetres || o.clockSecondsAfter !== e.clockSeconds ||
      !same(o.playerInjuriesAfter, s.injuries) || !same(o.enemyInjuriesAfter, e.enemyInjuries) || o.playerRiskAfter !== s.injuryRisk || o.enemyRiskAfter !== e.enemyRisk ||
      o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality ||
      (outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS')) ||
      (outcome === 'RETREATED' && (last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY' || s.health <= 0)) ||
      (outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')) ||
      (outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER' || last.retreat !== 'NONE')))
    throw new Error('真实原身体、原卷叶或资源与已保存战斗结果不符。');
  e.terminal = { outcome: outcome as ConcealmentServantEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: e.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('原庭冲突结束', `${outcome === 'PLAYER_DEAD' ? '玩家原身体真实死亡，睡眠、恐惧和原卷叶不复活。' : outcome === 'RETREATED' ? '本人沿净空普通出口离开，无追逐或瞬移。' : outcome === 'ENEMY_DEAD' ? '原奥斯温真实死亡，自己的唯一原棍留场。' : '原奥斯温仍活着，因真实重伤停止抵抗，把自己的唯一原棍放在原院。'}本轮原卷叶已实际召回，原释放与再邀请历史不重置；实付灵性及共同伤势保留，旧布拉姆、原人原物不改。`);
}
export function concealmentServantEncounterActions(s: SliceState): ConcealmentServantEncounterAction[] {
  if (!stage(s)) return [];
  return ([['ENCOUNTER_TALK', '步行到原门口交谈', '1行动 · 另留开战1行动'], ['ENCOUNTER_FIGHT', '承担原奥斯温的真实冲突', '1行动 · 真实受伤或死亡风险'],
    ['LEAVE_ENCOUNTER', '沿原出口和平离开', '0行动']] as const).map(([type, label, cost]) => {
    const command: ConcealmentServantEncounterCommand = { type }, reason = blockConcealmentServantEncounter(s, command);
    return { id: `concealmentServant-${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectConcealmentServantEncounter(s: SliceState): ConcealmentServantEncounterProjection {
  const e = s.concealmentServant.encounter;
  if (!stage(s)) return { title: '尚未开放的隐秘之仆遭遇', story: '', status: e.status, inside: false, enemy: null, actions: [], facts: [], room: null, playerLocation: e.playerLocation, playerTravelMetres: e.playerTravelMetres, clockSeconds: e.clockSeconds, abilityUses: structuredClone(e.abilityUses) };
  return { title: '原门口与独立的奥斯温', story: CONCEALMENT_SERVANT_ENCOUNTER_STORY, status: e.status, inside: hasConcealmentServantEncounterLock(s),
    enemy: { id: CONCEALMENT_SERVANT_TARGET_ID, name: '奥斯温', age: 47, source: 'ORIGINAL_OPEN_COURT_ADULT', sequence: 2, health: e.enemyHealth,
      mind: e.enemyMind, spirituality: e.enemySpirituality, status: e.enemyStatus, weaponId: 'CS2-OSWIN-CLUB', weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses } },
    room: { ...e.room }, playerLocation: e.playerLocation, playerTravelMetres: e.playerTravelMetres, clockSeconds: e.clockSeconds, abilityUses: structuredClone(e.abilityUses),
    actions: concealmentServantEncounterActions(s), facts: ['原6米房间，本人仍在2米可达门口；原门开放，普通进出各2米/2秒', '成功开窗不等于实际应用；下一暗矢才消费窗口减35/20，强光锚只影响当前或下一窗口',
      '同一原卷叶派出2S/0贡献，后槽协助另付2S/减22，轮末真实召回', '双方独立S120、共同次数与伤势盘；旧布拉姆死亡和原棍去向保留'] };
}
/** Validate only this original encounter's bounded history; later fights never extend its terminal window. */
export function validateConcealmentServantEncounter(s: SliceState): boolean {
  try {
    const e = s.concealmentServant?.encounter, initial = createConcealmentServantEncounterState();
    if (!e || !same(Object.keys(e).sort(),Object.keys(initial).sort()) || e.targetId !== CONCEALMENT_SERVANT_TARGET_ID || !same(e.room,initial.room) ||
        !['AVAILABLE','READY','FIGHTING','RESOLVED','RETREATED','LOST'].includes(e.status) || !['OUTSIDE','DOORSTEP'].includes(e.playerLocation) ||
        !integer(e.playerTravelMetres) || !integer(e.clockSeconds) || !validateConcealmentServantAbilityUses(e.abilityUses) ||
        !integer(e.enemyHealth,0,100) || e.enemyMind !== 100 || !integer(e.enemySpirituality,0,120) || !integer(e.enemyRisk) ||
        !['RESISTING','SURRENDERED','DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) ||
        e.weaponLocation !== (e.enemyStatus === 'RESISTING' ? 'HAND' : 'YARD') || !Array.isArray(e.enemyInjuries) ||
        !e.powerUses || !same(Object.keys(e.powerUses).sort(),[...CONCEALMENT_SERVANT_POWER_IDS].sort()) || !CONCEALMENT_SERVANT_POWER_IDS.every(id => integer(e.powerUses[id])) ||
        e.enemySpirituality !== 120 - CONCEALMENT_SERVANT_POWERS.reduce((n,p) => n + e.powerUses[p.id]*p.cost,0) ||
        [e.approachWeek,e.attemptWeek].some(w => w !== null && !integer(w,1,s.week))) return false;
    const allNew = s.combatHistory.flatMap((r,i) => r.concealmentServantOutcome ? [i] : []);
    if (e.status === 'AVAILABLE') return same(e,initial) && allNew.length === 0 && s.combat?.encounterId !== 'CONCEALMENT_SERVANT_DISPUTE';
    if (!stage(s) || s.concealmentServant.promotionWeek === null || e.approachWeek === null || e.approachWeek < s.concealmentServant.promotionWeek) return false;
    if (e.startHistoryIndex === null) {
      const ready = e.status === 'READY', peaceful = e.status === 'RESOLVED';
      return (ready || peaceful) && e.attemptWeek === null && e.terminal === null && allNew.length === 0 &&
        e.playerLocation === (ready ? 'DOORSTEP' : 'OUTSIDE') && e.playerTravelMetres === (ready ? 2 : 4) && e.clockSeconds === (ready ? 2 : 4) &&
        same({ ...e,status: initial.status,approachWeek: null,playerLocation: initial.playerLocation,playerTravelMetres: 0,clockSeconds: 0 },initial) &&
        s.combat?.encounterId !== 'CONCEALMENT_SERVANT_DISPUTE' && (!ready || s.status === 'ACTIVE' && s.world.city === 'BACKLUND' && !otherSceneOpen(s));
    }
    if (!integer(e.startHistoryIndex,0,s.combatHistory.length) || e.attemptWeek === null || e.attemptWeek < e.approachWeek) return false;
    if (e.terminal && (!same(Object.keys(e.terminal).sort(),['outcome','round','historyIndex','enemyHealth','enemyMind','enemySpirituality','enemyStatus'].sort()) ||
        !integer(e.terminal.historyIndex,e.startHistoryIndex,s.combatHistory.length-1))) return false;
    const end = e.terminal ? e.terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex,end);
    if (!same(allNew,rounds.map((_r,i) => e.startHistoryIndex! + i))) return false;
    for (const [i,round] of rounds.entries()) {
      const o = round.concealmentServantOutcome, previous = rounds[i-1]?.concealmentServantOutcome;
      if (!validateConcealmentServantRoundOutcome(o) || !validateConcealmentServantCombatRound(round) || round.round !== i+1 ||
          o.source.runId !== s.runId || o.source.randomSeed !== s.random.seed || o.source.revision >= s.revision || o.randomCursorAfter > s.random.cursor ||
          o.source.startHistoryIndex !== e.startHistoryIndex || o.source.attemptWeek !== e.attemptWeek ||
          (i < rounds.length-1 && !o.continuing)) return false;
      if (previous) {
        if (o.source.enemyHealth !== previous.enemyHealth || o.source.enemyMind !== previous.enemyMind ||
            o.source.playerHealth !== previous.playerHealthAfter || o.source.playerMind !== previous.playerMindAfter ||
            o.playerSpiritualityBefore !== Math.min(120,previous.playerSpiritualityAfter+12) || o.enemySpiritualityBefore !== previous.enemySpirituality ||
            !same(o.source.powerUses,previous.powerUses) || !same(o.source.abilityUses,previous.abilityUses) || !same(o.source.companion,previous.companionAfter) ||
            !same(o.source.playerInjuries,previous.playerInjuriesAfter) || !same(o.source.enemyInjuries,previous.enemyInjuriesAfter) ||
            o.source.playerRisk !== previous.playerRiskAfter || o.source.enemyRisk !== previous.enemyRiskAfter ||
            o.source.clockSeconds !== previous.clockSecondsAfter || o.source.playerTravelMetres !== previous.playerTravelMetresAfter ||
            o.source.randomCursor !== previous.randomCursorAfter || o.source.revision !== previous.source.revision+1 ||
            !['physique','perception','knowledge','will','dissolutionMastery','clubHeld','spiritPromotionWeek','spiritCaseStatus'].every(key =>
              same(o.source[key as keyof typeof o.source],previous.source[key as keyof typeof previous.source]))) return false;
      } else if (o.source.enemyHealth !== 100 || o.source.enemyMind !== 100 || o.enemySpiritualityBefore !== 120 || o.source.enemyRisk !== 0 || o.source.enemyInjuries.length !== 0 ||
          !same(o.source.powerUses,initial.powerUses) || !same(o.source.abilityUses,initial.abilityUses)) return false;
    }
    const last = rounds.at(-1), o = last?.concealmentServantOutcome;
    if (o && (o.enemyHealth !== e.enemyHealth || o.enemyMind !== e.enemyMind || o.enemySpirituality !== e.enemySpirituality || o.enemyStatus !== e.enemyStatus ||
        !same(o.powerUses,e.powerUses) || !same(o.abilityUses,e.abilityUses) || !same(o.enemyInjuriesAfter,e.enemyInjuries) || o.enemyRiskAfter !== e.enemyRisk ||
        o.playerLocationAfter !== e.playerLocation || o.playerTravelMetresAfter !== e.playerTravelMetres || o.clockSecondsAfter !== e.clockSeconds)) return false;
    if (e.status === 'FIGHTING') {
      if (e.terminal !== null || !hasConcealmentServantDisputeOpponent(s)) return false;
      if (!o) return s.combat!.lastRound === null && same(e.powerUses,initial.powerUses) && same(e.abilityUses,initial.abilityUses) &&
        e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 120 && e.enemyRisk === 0 && e.enemyInjuries.length === 0;
      return o.continuing && same(o.companionAfter,s.spiritWarlock.companion) && same(last,s.combat!.lastRound) &&
        same(o.playerInjuriesAfter,s.injuries) && o.playerRiskAfter === s.injuryRisk && o.playerHealthAfter === s.health && o.playerMindAfter === s.mind &&
        Math.min(120,o.playerSpiritualityAfter+12) === s.spirituality && o.randomCursorAfter === s.random.cursor;
    }
    const t = e.terminal;
    if (s.combat?.encounterId === 'CONCEALMENT_SERVANT_DISPUTE' || !t || !last || !o || o.continuing || t.round !== last.round || rounds.length !== t.round ||
        t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality || t.enemyStatus !== e.enemyStatus) return false;
    if (t.outcome === 'RETREATED') return e.status === 'RETREATED' && last.retreat === 'SUCCESS' && last.winner === 'ENEMY' && o.playerHealthAfter > 0;
    if (t.outcome === 'PLAYER_DEAD') return e.status === 'LOST' && s.status === 'DEAD' && o.playerHealthAfter === 0 && last.winner === 'ENEMY';
    return e.status === 'RESOLVED' && last.winner === 'PLAYER' && last.retreat === 'NONE' &&
      (t.outcome === 'ENEMY_DEAD' ? e.enemyStatus === 'DEAD' : t.outcome === 'ENEMY_SURRENDERED' && e.enemyStatus === 'SURRENDERED');
  } catch { return false; }
}
