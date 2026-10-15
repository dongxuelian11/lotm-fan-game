import { stableStringify } from '../canonical.js';
import { consequenceWeights } from '../slice/combat.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import type { MiracleWorkerAction } from './types.js';
import { validateMiracleWorkerRoundOutcome } from './combat.js';
import { MIRACLE_WORKER_SITE, MIRACLE_WORKER_EXIT, MIRACLE_WORKER_TARGET_ID,
  markMiracleWorkerEncounterRevived } from './encounter.js';

/** Four lifetime uses are the supplied ordinary Miracle Invoker source boundary.
 * This player has never borrowed uses through Sefirah Castle. The duration,
 * distance and restored health below are explicit, local gameplay G only. */
export const MIRACLE_WORKER_REVIVAL_ALLOWANCE = 4 as const;
export const MIRACLE_WORKER_REVIVAL_WINDOW_SECONDS = 120 as const;
export const MIRACLE_WORKER_REBUILD_SECONDS = 30 as const;
export const MIRACLE_WORKER_REVIVAL_HEALTH = 30 as const;
export const MIRACLE_WORKER_REBUILD_POINT = 'MW2-OLD-QUARRY-STONE:NORTH-1M' as const;

export type MiracleWorkerRevivalCommand =
  | { type: 'REVIVE_NEARBY' | 'FORFEIT_REVIVAL'; deathId: string; confirmed: true }
  | { type: 'WAIT_REVIVAL'; deathId: string };
export type MiracleWorkerRevivalResult = 'REVIVED' | 'WAITING' | 'FINAL_DEATH';
export type MiracleWorkerRevivalOutcome = 'PENDING' | 'REVIVED' | 'FORFEITED' | 'EXPIRED';
export interface MiracleWorkerDeathRecord {
  id: string; sourceEncounterId: 'MIRACLE_WORKER_DISPUTE'; sourceHistoryIndex: number;
  deathRevision: number; deathWeek: number; bodyId: string;
  siteId: typeof MIRACLE_WORKER_SITE; deathAt: typeof MIRACLE_WORKER_SITE;
  remains: 'PRESENT' | 'RECONSTITUTED' | 'FINAL';
  /** Persisted game time since this death. Menu time and reloads do not advance it. */
  elapsedSeconds: number; waitCount: number; deadlineSeconds: 120;
  deathMind: number; deathSpirituality: number; deathInjuries: SliceInjury[]; deathRisk: number;
  outcome: MiracleWorkerRevivalOutcome; resolvedRevision: number | null;
  returnAt: typeof MIRACLE_WORKER_REBUILD_POINT | null; healthAfter: 30 | null;
}
export interface MiracleWorkerRevivalState {
  allowance: 4; used: number; pendingDeathId: string | null; records: MiracleWorkerDeathRecord[];
}
export interface MiracleWorkerRevivalProjection {
  title: string; available: boolean; pending: boolean; allowance: 4; used: number; remaining: number;
  supportedScope: string; source: string; boundary: string;
  current: null | {
    deathId: string; bodyId: string; deathHistoryIndex: number; deathRevision: number;
    deathAt: string; rebuildAt: string; elapsedSeconds: number; remainingSeconds: number;
    reconstructionSeconds: 30; healthAfter: 30; mindAfter: number; spiritualityAfter: number;
    existingInjuries: number; existingRisk: number; canCompleteInTime: boolean;
  };
  bodyLocation: string | null; history: string[]; facts: string[]; actions: MiracleWorkerAction[];
}

export const MIRACLE_WORKER_REVIVAL_SCOPE = '本版只在已经实际抵达并交战的旧采石场界石，支持本人的真实战斗死亡后有限复起。其他已开放遭遇尚未接入；旧普通死亡槽位不能重开。跨遭遇支持仍是1.0前未完成的覆盖项。';
export const MIRACLE_WORKER_REVIVAL_SOURCE = '奇迹师通过借助过去的灵之虫有限复活，总计4次。本玩家没有源堡预支，因此首次真实复起前可用4次；克莱恩预支3次及其72小时个例不是这里的通则。';
export const MIRACLE_WORKER_REVIVAL_BOUNDARY = '本场重组点为原界石北侧一米空地，不是公共出口或任意地图点。120秒完成窗口、30秒重组、1米距离与健康30均为本作有限G；精神/灵性不补，旧伤、污染、累计风险及真实消耗保留。复起不重抽死亡盘、不改赢原战斗、不重开敌人、不从工作台或远处库存取物。';

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number =>
  Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const qualified = (s: SliceState) => s.progression.pathwayId === 'diviner' && s.progression.sequence === 2 &&
  s.miracleWorker.promotionWeek !== null;
const deathId = (s: SliceState, revision: number) => `${s.runId}:MW2-DEATH:${revision}`;
const pendingRecord = (s: SliceState) => s.miracleWorker.revival.records.find(r => r.id === s.miracleWorker.revival.pendingDeathId);
const noOtherActivity = (s: SliceState) => s.combat === null && s.activeEvent === null && s.eventQueue.length === 0 && s.pulse === 'NONE' &&
  s.miracleWorker.life.activeCase === null && s.miracleWorker.life.scene.image === null &&
  s.miracleWorker.life.items.every(i => i.holder !== 'PLAYER');

export function createMiracleWorkerRevivalState(): MiracleWorkerRevivalState {
  return { allowance: MIRACLE_WORKER_REVIVAL_ALLOWANCE, used: 0, pendingDeathId: null, records: [] };
}
export const hasMiracleWorkerRevivalLock = (s: SliceState): boolean =>
  s.status === 'REVIVAL_PENDING' || s.miracleWorker.revival.pendingDeathId !== null;

export function validateMiracleWorkerRevivalCommand(v: unknown): v is MiracleWorkerRevivalCommand {
  if (!isRecord(v) || typeof v.deathId !== 'string' || v.deathId.length < 1 || v.deathId.length > 260) return false;
  if (v.type === 'WAIT_REVIVAL') return shape(v, ['type', 'deathId']);
  return (v.type === 'REVIVE_NEARBY' || v.type === 'FORFEIT_REVIVAL') &&
    shape(v, ['type', 'deathId', 'confirmed']) && v.confirmed === true;
}
export const isMiracleWorkerRevivalCommand = validateMiracleWorkerRevivalCommand;

/** References the actual immutable history and the encounter's actual terminal.
 * A health-zero snapshot or a user-supplied death object can never open this route. */
function actualDeath(s: SliceState, historyIndex: number) {
  const e = s.miracleWorker.encounter, t = e.terminal;
  if (!t || t.outcome !== 'PLAYER_DEAD' || !integer(historyIndex, 0, s.combatHistory.length - 1) ||
    t.historyIndex !== historyIndex || e.targetId !== MIRACLE_WORKER_TARGET_ID || e.startHistoryIndex === null ||
    t.playerBodyAt !== MIRACLE_WORKER_SITE || t.playerOriginalsAt !== MIRACLE_WORKER_SITE ||
    t.enemyStatus !== 'RESISTING' || t.enemyHealth <= 0 || t.enemyMind <= 0 || t.enemyWeaponAt !== 'WITH_ENEMY') return null;
  const round = s.combatHistory[historyIndex], o = round?.miracleWorkerOutcome;
  if (!round || !validateMiracleWorkerRoundOutcome(o) || round.winner !== 'ENEMY' || round.retreat === 'SUCCESS' ||
    o.continuing || o.playerHealthAfter !== 0 || o.enemyStatus !== 'RESISTING' || o.enemyHealth <= 0 ||
    o.source.runId !== s.runId || o.source.encounterId !== 'MIRACLE_WORKER_DISPUTE' ||
    o.source.targetId !== MIRACLE_WORKER_TARGET_ID || o.source.actualOriginalBody !== true ||
    o.source.bodyId !== `${s.runId}:body` || o.source.space !== MIRACLE_WORKER_SITE ||
    o.ownerAt !== MIRACLE_WORKER_SITE || o.source.playerSequence !== 2 ||
    o.source.startHistoryIndex !== e.startHistoryIndex || o.source.week !== e.attemptWeek ||
    t.round !== round.round || round.round !== o.round || t.revision !== o.source.revision + 1 ||
    t.enemyHealth !== o.enemyHealth || t.enemyMind !== o.enemyMind || t.enemySpirituality !== o.enemySpirituality ||
    e.enemyHealth !== t.enemyHealth || e.enemyMind !== t.enemyMind || e.enemySpirituality !== t.enemySpirituality ||
    t.enemyRisk !== o.enemyRiskAfter || !same(t.enemyInjuries, o.enemyInjuriesAfter) ||
    e.enemyStatus !== t.enemyStatus || e.enemyRisk !== t.enemyRisk || !same(e.enemyInjuries, t.enemyInjuries) ||
    !same(e.powerUses, o.powerUses)) return null;
  // A matching H0/terminal alone is insufficient: the saved shared wheel must
  // actually produce this death. Low-health LIGHT/HEAVY deaths remain legal.
  const risk = o.source.playerRisk + (o.playerInjuriesBeforeConsequence.length ? 1 : 0);
  const weights = consequenceWeights(risk), roll = round.consequenceRoll;
  if (!o.enemyActions.some(a => a.threatens) || o.playerRiskAfter !== risk ||
    !same(round.consequenceWeights, weights) || !integer(roll, 1, 100)) return null;
  const severity = roll <= weights.light ? 'LIGHT' : roll <= weights.light + weights.heavy ? 'HEAVY' : 'DEATH';
  if (severity === 'DEATH') {
    if (!same(o.playerInjuriesAfter, o.playerInjuriesBeforeConsequence)) return null;
  } else {
    const damage = severity === 'LIGHT' ? 10 : 30;
    const expected = [...o.playerInjuriesBeforeConsequence, {
      id: `${s.runId}:combat:${round.round}:PLAYER:${o.source.revision + 1}:${o.playerInjuriesBeforeConsequence.length}`,
      severity, acquiredRevision: o.source.revision + 1, treatedRevision: null,
    }];
    if (Math.max(0, o.playerHealthBeforeConsequence - damage) !== 0 || !same(o.playerInjuriesAfter, expected)) return null;
  }
  return { round, outcome: o, terminal: t };
}

/** Called only by the new encounter's PLAYER_DEAD branch, after append+settle,
 * before finish(DEATH), while the old revision is still the current revision.
 * true: caller must persist REVIVAL_PENDING without invoking finish.
 * false: the real death has no remaining use; caller must invoke finish(DEATH).
 * This never accepts a previously persisted DEAD run or a historic death. */
export function openMiracleWorkerRevival(s: SliceState, ctx: SeerContext): boolean {
  const v = s.miracleWorker.revival, e = s.miracleWorker.encounter, t = e.terminal;
  if (s.status !== 'ACTIVE' || s.ending !== null || s.health !== 0 || !qualified(s) || !noOtherActivity(s) ||
    e.status !== 'REVIVAL_PENDING' || e.location !== MIRACLE_WORKER_SITE || e.revivalReceipt !== null ||
    e.originalsRecoveredRevision !== null || e.leftRevision !== null || !t || t.revision !== s.revision + 1 ||
    t.historyIndex !== s.combatHistory.length - 1 || v.pendingDeathId !== null ||
    !integer(v.used, 0, 4) || v.allowance !== 4 || v.used !== v.records.filter(r => r.outcome === 'REVIVED').length)
    throw new Error('只能从新采石场当前真实PLAYER_DEAD提交开启有限复起；旧死亡与伪造尸体不可进入。');
  const source = actualDeath(s, t.historyIndex);
  if (!source || !same(source.round, s.lastCombatRound) || s.mind !== source.outcome.playerMindAfter ||
    s.spirituality !== source.outcome.playerSpiritualityAfter || !same(s.injuries, source.outcome.playerInjuriesAfter) ||
    s.injuryRisk !== source.outcome.playerRiskAfter || v.records.some(r => r.sourceHistoryIndex === t.historyIndex || r.id === deathId(s, t.revision)))
    throw new Error('复起来源不对应刚刚提交的同一死亡回合、身体、精神、灵性和伤势。');
  if (v.used >= MIRACLE_WORKER_REVIVAL_ALLOWANCE) { e.status = 'LOST'; return false; }
  const r: MiracleWorkerDeathRecord = {
    id: deathId(s, t.revision), sourceEncounterId: 'MIRACLE_WORKER_DISPUTE', sourceHistoryIndex: t.historyIndex,
    deathRevision: t.revision, deathWeek: source.outcome.source.week, bodyId: `${s.runId}:body`,
    siteId: MIRACLE_WORKER_SITE, deathAt: MIRACLE_WORKER_SITE, remains: 'PRESENT', elapsedSeconds: 0,
    waitCount: 0, deadlineSeconds: MIRACLE_WORKER_REVIVAL_WINDOW_SECONDS,
    deathMind: s.mind, deathSpirituality: s.spirituality, deathInjuries: structuredClone(s.injuries), deathRisk: s.injuryRisk,
    outcome: 'PENDING', resolvedRevision: null, returnAt: null, healthAfter: null,
  };
  v.records.push(r); v.pendingDeathId = r.id; s.status = 'REVIVAL_PENDING';
  ctx.note('真实战死，有限复起待决', `原回合${r.sourceHistoryIndex + 1}已经成立PLAYER_DEAD，${r.bodyId}的H0原身体与未耗原物留在旧采石场界石；原敌仍活着且原资源不补。当前余${4 - v.used}/4次，可在120游戏秒内完成一次30秒G就近重组，也可等待或明确放弃。此刻尚未消耗次数，没有自动复活或重新掷骰。`);
  return true;
}
export const openRevival = openMiracleWorkerRevival;

export function blockMiracleWorkerRevival(s: SliceState, c: MiracleWorkerRevivalCommand): string | null {
  if (!validateMiracleWorkerRevivalCommand(c)) return '复起命令无效；必须引用当前死亡，复起或放弃须独立确认。';
  if (s.status !== 'REVIVAL_PENDING' || s.ending !== null || s.health !== 0 || !qualified(s))
    return '只接受本阶段当前真实死亡的待决窗口；普通DEAD封存永不能恢复。';
  const v = s.miracleWorker.revival, r = pendingRecord(s), e = s.miracleWorker.encounter;
  if (!r || r.id !== c.deathId || r.outcome !== 'PENDING' || !validateMiracleWorkerRevivalState(s))
    return '死亡来源或当前复起窗口已经变化，不能重复使用旧死亡。';
  if (!noOtherActivity(s) || e.status !== 'REVIVAL_PENDING' || e.location !== MIRACLE_WORKER_SITE)
    return '原死亡现场与独立窗口不一致，不能通过其他现场复起。';
  if (c.type === 'REVIVE_NEARBY') {
    if (v.used >= v.allowance) return '四次全生涯复起已经真实耗尽，不能补满或预支。';
    if (r.elapsedSeconds + MIRACLE_WORKER_REBUILD_SECONDS > r.deadlineSeconds)
      return '剩余游戏时间不足完成本场30秒G重组。';
  }
  return null;
}
export const miracleWorkerRevivalReason = blockMiracleWorkerRevival;

/** The enclosing SliceApplication owns one transaction and idempotent receipt.
 * FINAL_DEATH deliberately leaves finish(DEATH) to the parent slice dispatcher;
 * call it before validating or persisting this returned transition. */
export function applyMiracleWorkerRevivalCommand(s: SliceState, c: MiracleWorkerRevivalCommand,
  ctx: SeerContext): MiracleWorkerRevivalResult {
  const reason = blockMiracleWorkerRevival(s, c); if (reason) throw new Error(reason);
  const v = s.miracleWorker.revival, r = pendingRecord(s)!, e = s.miracleWorker.encounter;
  if (c.type === 'REVIVE_NEARBY') {
    r.elapsedSeconds += MIRACLE_WORKER_REBUILD_SECONDS;
    r.outcome = 'REVIVED'; r.remains = 'RECONSTITUTED'; r.returnAt = MIRACLE_WORKER_REBUILD_POINT;
    r.healthAfter = MIRACLE_WORKER_REVIVAL_HEALTH; r.resolvedRevision = s.revision + 1;
    v.used += 1; v.pendingDeathId = null;
    s.health = MIRACLE_WORKER_REVIVAL_HEALTH;
    // Mind, spirituality, wounds, risk, pollution, money, AP, random cursor,
    // every prior outcome and every object's custody deliberately remain untouched.
    markMiracleWorkerEncounterRevived(s, { deathHistoryIndex: r.sourceHistoryIndex,
      revivedRevision: s.revision + 1, revivalId: r.id });
    s.status = 'ACTIVE';
    ctx.note('同一身体在界石北侧一米处重组', `${r.bodyId}经过30游戏秒G，在${MIRACLE_WORKER_REBUILD_POINT}重新站起；真实消耗第${v.used}/4次，尚余${4 - v.used}次。健康30G，精神${s.mind}、灵性${s.spirituality}仍为死亡后实值；原伤${s.injuries.length}处与累计风险${s.injuryRisk}保留。原死亡回合及敌人终态没有改写，旧遗骸不再是第二身体或第二份特性。未耗原物仍在原尸位，接待处工作台上的原工具与原盒也没有移动。之后需另行实际拾物或沿北侧排水梯普通离开。`);
    return 'REVIVED';
  }
  if (c.type === 'WAIT_REVIVAL') {
    r.waitCount += 1; r.elapsedSeconds += MIRACLE_WORKER_REBUILD_SECONDS;
    if (r.elapsedSeconds < r.deadlineSeconds) {
      ctx.note('复起窗口实际经过30秒', `已过${r.elapsedSeconds}/120游戏秒G。本人仍H0、原敌与原物仍在原处，尚未消耗复起次数；复起需再留出30秒G，返回标题与读档不会重置此时钟。`);
      return 'WAITING';
    }
    r.outcome = 'EXPIRED';
  } else r.outcome = 'FORFEITED';
  r.remains = 'FINAL'; r.resolvedRevision = s.revision + 1; v.pendingDeathId = null; e.status = 'LOST';
  ctx.note(r.outcome === 'EXPIRED' ? '本次重组时限已过' : '主动放弃本次复起',
    `本人仍H0，原尸位与未耗原物留在旧采石场界石，原敌、资源、伤势及历史完整保留。${r.outcome === 'EXPIRED' ? '120游戏秒G已真实经过，无法再完成这次重组。' : '本人已经独立确认终止这次机会。'}没有实际复起，因此次数不扣；本次周目转为最终死亡并只读封存。`);
  return 'FINAL_DEATH';
}
export const applyMiracleWorkerRevival = applyMiracleWorkerRevivalCommand;

export function miracleWorkerRevivalActions(s: SliceState): MiracleWorkerAction[] {
  if (s.status !== 'REVIVAL_PENDING') return [];
  const r = pendingRecord(s); if (!r) return [];
  const rows: { id: string; label: string; cost: string; command: MiracleWorkerRevivalCommand }[] = [
    { id: 'MW2-REVIVE-NEARBY', label: '借过去灵之虫，在界石北侧一米处复起',
      cost: '真实消耗1/4全生涯次数 · 30游戏秒G · H30G · 原M/S/伤势不清',
      command: { type: 'REVIVE_NEARBY', deathId: r.id, confirmed: true } },
    { id: 'MW2-WAIT-REVIVAL', label: '仍不复起，实际再等30秒',
      cost: '30游戏秒G · 达到120秒后最终封存', command: { type: 'WAIT_REVIVAL', deathId: r.id } },
    { id: 'MW2-FORFEIT-REVIVAL', label: '放弃这次复起并最终封存',
      cost: '独立确认 · 不耗次数 · 周目不可恢复', command: { type: 'FORFEIT_REVIVAL', deathId: r.id, confirmed: true } },
  ];
  return rows.map(row => { const reason = blockMiracleWorkerRevival(s, row.command); return { ...row, enabled: reason === null, reason }; });
}

export function projectMiracleWorkerRevival(s: SliceState): MiracleWorkerRevivalProjection {
  const v = s.miracleWorker.revival, e = s.miracleWorker.encounter, r = pendingRecord(s);
  const last = v.records.at(-1), active = s.status === 'REVIVAL_PENDING';
  // The immutable returnAt states where rebuilding occurred; current actual
  // movement remains owned by encounter's existing pickup and departure commands.
  const bodyLocation = !last ? null : e.leftRevision !== null ? MIRACLE_WORKER_EXIT :
    last.outcome === 'REVIVED' && e.originalsRecoveredRevision === null ? MIRACLE_WORKER_REBUILD_POINT : MIRACLE_WORKER_SITE;
  return { title: active ? '已真实战死 · 有限复起待决' : '借过去灵之虫的有限复起',
    available: qualified(s), pending: active, allowance: 4, used: v.used, remaining: 4 - v.used,
    supportedScope: MIRACLE_WORKER_REVIVAL_SCOPE, source: MIRACLE_WORKER_REVIVAL_SOURCE, boundary: MIRACLE_WORKER_REVIVAL_BOUNDARY,
    current: r ? { deathId: r.id, bodyId: r.bodyId, deathHistoryIndex: r.sourceHistoryIndex, deathRevision: r.deathRevision,
      deathAt: '旧采石场原界石尸位', rebuildAt: '界石北侧一米的隐蔽空地（同一原场，G）',
      elapsedSeconds: r.elapsedSeconds, remainingSeconds: Math.max(0, r.deadlineSeconds - r.elapsedSeconds),
      reconstructionSeconds: MIRACLE_WORKER_REBUILD_SECONDS, healthAfter: MIRACLE_WORKER_REVIVAL_HEALTH,
      mindAfter: r.deathMind, spiritualityAfter: r.deathSpirituality, existingInjuries: r.deathInjuries.length,
      existingRisk: r.deathRisk, canCompleteInTime: r.elapsedSeconds + MIRACLE_WORKER_REBUILD_SECONDS <= r.deadlineSeconds } : null,
    bodyLocation, actions: miracleWorkerRevivalActions(s),
    history: v.records.map(x => `第${x.deathWeek}周原死亡回合${x.sourceHistoryIndex + 1}：${x.outcome === 'PENDING' ? '真实战死，待决' : x.outcome === 'REVIVED' ? '另行消耗一次，已就近重组' : x.outcome === 'EXPIRED' ? '窗口到期，最终封存' : '主动放弃，最终封存'}；已过${x.elapsedSeconds}游戏秒G，${x.bodyId}始终同一本人；原PLAYER_DEAD不改写。`),
    facts: [MIRACLE_WORKER_REVIVAL_SCOPE, `原总额度4，真实已用${v.used}，余${4 - v.used}；晋升不补灵性，后续继承也不重置本账本。`,
      '死亡已成立；这里只处理其后是否重组，不是生存骰重抽、旧档恢复、历史替身或源堡备份。',
      '原敌仍保留自己的原身体、H/M/S、原伤、原能力消耗和原棍；没有复起胜利奖励。',
      '所有时间都是本场游戏时间G；等待、重组真实推进，菜单暂停或重载不推进也不清零。',
      '复起只重组同一本人；当代工作台工具/原盒、原尸位未耗物与任何远处库存都不会随之移位。'],
  };
}

const recordKeys = ['id', 'sourceEncounterId', 'sourceHistoryIndex', 'deathRevision', 'deathWeek', 'bodyId',
  'siteId', 'deathAt', 'remains', 'elapsedSeconds', 'waitCount', 'deadlineSeconds', 'deathMind', 'deathSpirituality',
  'deathInjuries', 'deathRisk', 'outcome', 'resolvedRevision', 'returnAt', 'healthAfter'] as const;
export function validateMiracleWorkerRevivalState(s: SliceState): boolean {
  try {
    const v = s.miracleWorker.revival, e = s.miracleWorker.encounter;
    if (!isRecord(v) || !shape(v, ['allowance', 'used', 'pendingDeathId', 'records']) || v.allowance !== 4 ||
      !integer(v.used, 0, 4) || !Array.isArray(v.records) || v.records.length > 4 ||
      !(v.pendingDeathId === null || typeof v.pendingDeathId === 'string')) return false;
    if (new Set(v.records.map(r => r.id)).size !== v.records.length ||
      new Set(v.records.map(r => r.sourceHistoryIndex)).size !== v.records.length ||
      v.used !== v.records.filter(r => r.outcome === 'REVIVED').length) return false;
    if (s.miracleWorker.promotionWeek === null) return same(v, createMiracleWorkerRevivalState()) && s.status !== 'REVIVAL_PENDING';
    let pending = 0;
    for (const r of v.records) {
      if (!isRecord(r) || !shape(r, recordKeys) || r.sourceEncounterId !== 'MIRACLE_WORKER_DISPUTE' ||
        !integer(r.sourceHistoryIndex, 0, s.combatHistory.length - 1) || !integer(r.deathRevision, 1, s.revision) ||
        r.id !== deathId(s, r.deathRevision) || r.bodyId !== `${s.runId}:body` || r.siteId !== MIRACLE_WORKER_SITE ||
        r.deathAt !== MIRACLE_WORKER_SITE || r.deadlineSeconds !== MIRACLE_WORKER_REVIVAL_WINDOW_SECONDS ||
        !integer(r.deathWeek, s.miracleWorker.promotionWeek, s.week) || !integer(r.elapsedSeconds, 0, 120) ||
        !integer(r.waitCount, 0, 4) || !integer(r.deathMind, 1, 100) || !integer(r.deathSpirituality, 0, 120) ||
        !integer(r.deathRisk) || !Array.isArray(r.deathInjuries) ||
        !['PENDING', 'REVIVED', 'FORFEITED', 'EXPIRED'].includes(r.outcome)) return false;
      const source = actualDeath(s, r.sourceHistoryIndex);
      if (!source || source.terminal.revision !== r.deathRevision || source.outcome.source.week !== r.deathWeek ||
        source.outcome.playerMindAfter !== r.deathMind || source.outcome.playerSpiritualityAfter !== r.deathSpirituality ||
        !same(source.outcome.playerInjuriesAfter, r.deathInjuries) || source.outcome.playerRiskAfter !== r.deathRisk) return false;
      if (r.outcome === 'PENDING') {
        pending++;
        if (v.pendingDeathId !== r.id || r.remains !== 'PRESENT' || r.resolvedRevision !== null || r.returnAt !== null ||
          r.healthAfter !== null || r.elapsedSeconds !== r.waitCount * 30 || r.elapsedSeconds >= r.deadlineSeconds ||
          v.used >= 4 || s.status !== 'REVIVAL_PENDING' || s.ending !== null || !noOtherActivity(s) ||
          s.revision !== r.deathRevision + r.waitCount || s.week !== r.deathWeek ||
          s.health !== 0 || s.mind !== r.deathMind || s.spirituality !== r.deathSpirituality ||
          !same(s.injuries, r.deathInjuries) || s.injuryRisk !== r.deathRisk || e.status !== 'REVIVAL_PENDING' ||
          e.location !== MIRACLE_WORKER_SITE || e.revivalReceipt !== null || e.leftRevision !== null ||
          e.originalsRecoveredRevision !== null || !same(s.lastCombatRound, source.round) ||
          !same(s.magician.damageTransfers, source.outcome.damageTransfersAfter)) return false;
      } else {
        if (!integer(r.resolvedRevision, r.deathRevision + 1, s.revision) ||
          r.resolvedRevision !== r.deathRevision + r.waitCount + (r.outcome === 'EXPIRED' ? 0 : 1)) return false;
        if (r.outcome === 'REVIVED') {
          if (r.remains !== 'RECONSTITUTED' || r.returnAt !== MIRACLE_WORKER_REBUILD_POINT || r.healthAfter !== 30 ||
            r.elapsedSeconds !== r.waitCount * 30 + 30 || r.elapsedSeconds > r.deadlineSeconds || e.status !== 'REVIVED' ||
            e.revivalReceipt?.revivalId !== r.id || e.revivalReceipt.deathHistoryIndex !== r.sourceHistoryIndex ||
            e.revivalReceipt.revivedRevision !== r.resolvedRevision) return false;
          if (s.revision === r.resolvedRevision && (s.status !== 'ACTIVE' || s.ending !== null || s.health !== 30 ||
            s.mind !== r.deathMind || s.spirituality !== r.deathSpirituality || !same(s.injuries, r.deathInjuries) ||
            s.injuryRisk !== r.deathRisk || e.location !== MIRACLE_WORKER_SITE || e.leftRevision !== null ||
            e.originalsRecoveredRevision !== null || !same(s.magician.damageTransfers, source.outcome.damageTransfersAfter))) return false;
        } else if (r.remains !== 'FINAL' || r.returnAt !== null || r.healthAfter !== null ||
          r.elapsedSeconds !== r.waitCount * 30 || (r.outcome === 'EXPIRED' ? r.elapsedSeconds !== 120 : r.elapsedSeconds >= 120) ||
          e.status !== 'LOST' || e.revivalReceipt !== null || e.location !== MIRACLE_WORKER_SITE || e.leftRevision !== null ||
          e.originalsRecoveredRevision !== null || s.status !== 'DEAD' || s.ending?.kind !== 'DEATH' || s.health !== 0 ||
          s.mind !== r.deathMind || s.spirituality !== r.deathSpirituality || !same(s.injuries, r.deathInjuries) || s.injuryRisk !== r.deathRisk)
          return false;
      }
    }
    if (pending > 1 || (pending === 1) !== (v.pendingDeathId !== null) || (s.status === 'REVIVAL_PENDING') !== (pending === 1)) return false;
    if (e.status === 'REVIVAL_PENDING' && pending !== 1) return false;
    if (e.revivalReceipt !== null && !v.records.some(r => r.outcome === 'REVIVED' && r.id === e.revivalReceipt?.revivalId)) return false;
    // This version has one real encounter, hence at most one valid distinct death
    // source. Future S1 scenarios must explicitly add supported sources; migration
    // must not invent extra records or refill the four lifetime uses.
    return v.records.length <= 1;
  } catch { return false; }
}
export const validateMiracleWorkerRevival = validateMiracleWorkerRevivalState;
