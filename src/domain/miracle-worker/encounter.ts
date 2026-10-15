import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { miracleWorkerWinChance, validateMiracleWorkerRoundOutcome, type MiracleWorkerRoundOutcome } from './combat.js';
import type { MiracleWorkerAction } from './types.js';
import { hasMiracleWorkerLifeLock } from './life.js';

/** All identities, geography, numbers and finite power definitions here are G.
 * Corven is one original living S3 Beyonder in 1651, never a canonical person,
 * historical image, ordinary human with invented spells, or renewable enemy. */
export const MIRACLE_WORKER_TARGET_ID = 'MW2-CORVEN-HALE' as const;
export const MIRACLE_WORKER_SITE = 'MW2-OLD-QUARRY-STONE' as const;
export const MIRACLE_WORKER_EXIT = 'MW2-NORTH-DRAIN-STAIR' as const;
export const MIRACLE_WORKER_POWER_IDS = ['ARC_BOLT', 'WARD', 'COMPOSE'] as const;
export type MiracleWorkerPowerId = typeof MIRACLE_WORKER_POWER_IDS[number];
export type MiracleWorkerEnemyIntent = MiracleWorkerPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const MIRACLE_WORKER_POWERS = [
  { id: 'ARC_BOLT', label: '本人原有有限灰弧术（G）', cost: 6, selfGain: 85, enemyReduction: 0 },
  { id: 'WARD', label: '本人原有有限护术（G）', cost: 5, selfGain: 0, enemyReduction: 50 },
  { id: 'COMPOSE', label: '普通整理自有原棍姿势（G）', cost: 0, selfGain: 0, enemyReduction: 0 },
] as const;
export interface MiracleWorkerCombatSupplies {
  kitId: 'MW2-CURRENT-KIT-1'; purchasedWeek: number | null; pricePaid: 0 | 120;
  clubId: 'MW2-NEW-CLUB'; clubHeld: boolean; paperSheets: number; paperSpent: number;
  lampId: 'MW2-NEW-LAMP'; oilHeld: 0 | 1; oilSpent: 0 | 1; lanternPreparedWeek: number | null;
}
export interface MiracleWorkerEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED';
  round: number; historyIndex: number; revision: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyRisk: number; enemyInjuries: SliceInjury[];
  enemyWeaponAt: 'WITH_ENEMY' | typeof MIRACLE_WORKER_SITE;
  /** A location reference, not a second inventory or an item grant. */
  playerOriginalsAt: 'WITH_PLAYER' | typeof MIRACLE_WORKER_SITE;
  playerBodyAt: 'WITH_PLAYER' | typeof MIRACLE_WORKER_SITE;
}
export interface MiracleWorkerEncounterState {
  status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'REVIVAL_PENDING' | 'REVIVED' | 'LOST';
  targetId: typeof MIRACLE_WORKER_TARGET_ID;
  location: 'RECEPTION' | typeof MIRACLE_WORKER_SITE | typeof MIRACLE_WORKER_EXIT;
  investigatedWeek: number | null; investigationPaid: 0 | 24; arrivalWeek: number | null;
  attemptWeek: number | null; startHistoryIndex: number | null;
  enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  powerUses: Record<MiracleWorkerPowerId, number>; supplies: MiracleWorkerCombatSupplies;
  terminal: MiracleWorkerEncounterTerminal | null;
  /** Only the shared, validated S2 revival transition may populate this receipt.
   * The encounter never grants health, spirit, a body or replacement items. */
  revivalReceipt: { deathHistoryIndex: number; revivedRevision: number; revivalId: string } | null;
  originalsRecoveredRevision: number | null; leftRevision: number | null;
  recoverySeconds: 0 | 10; exitWalkSeconds: 0 | 30;
}
export type MiracleWorkerEncounterCommand = {
  type: 'ENCOUNTER_INVESTIGATE' | 'ENCOUNTER_APPROACH' | 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT'
    | 'BUY_CURRENT_KIT' | 'LIGHT_CURRENT_LANTERN' | 'ENCOUNTER_RECOVER_ORIGINALS' | 'ENCOUNTER_LEAVE';
};
export type MiracleWorkerEncounterAction = MiracleWorkerAction & { command: MiracleWorkerEncounterCommand };
export interface MiracleWorkerEncounterProjection {
  encounter: (MiracleWorkerEncounterState & {
    name: string; story: string; sequence: 3; age: 46; originalExit: string; pursuit: false;
    distanceMetres: 3; noBystanders: true;
    abilities: { id: MiracleWorkerPowerId; label: string; cost: number; selfGain: number; enemyReduction: number; available: boolean }[];
    facts: string[];
  }) | null;
}
export const MIRACLE_WORKER_ENCOUNTER_STORY = '1651年，原创成年敌对非凡者科文·黑尔（MW2-CORVEN-HALE，46岁，实际序列3，G）追查旧采石场的当代封存标记。他只有这一个真实原身体、独立H100/M100/S120和自有原棍MW2-CORVEN-CLUB，既有灰弧术每次6灵性/贡献85G、护术每次5灵性/减势50G；不再生、不回灵、不补法术。本人先实付24便士与1行动核对当代封存图，再另花1行动走到旧采石场界石，亲眼确认双方相距3米、无旁人、北侧排水梯通往旧采石场公共出口。对方只争这一处标记，拒绝或离开后不追逐；无需交战也没有保胜。双方沿用共同六槽盘、1250/底125与共同伤势风险，所有数值都是有限玩法G，不是原著定量结论。本人新晋奇迹师2，能力只能依真实来源和当下资源结算；不凭许愿跳过共同致伤盘，不赠原物，不重置敌人或战场。';

export function createMiracleWorkerEncounterState(): MiracleWorkerEncounterState {
  return { status: 'AVAILABLE', targetId: MIRACLE_WORKER_TARGET_ID, location: 'RECEPTION', investigatedWeek: null,
    investigationPaid: 0, arrivalWeek: null, attemptWeek: null, startHistoryIndex: null,
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0,
    powerUses: { ARC_BOLT: 0, WARD: 0, COMPOSE: 0 }, terminal: null, revivalReceipt: null,
    originalsRecoveredRevision: null, leftRevision: null, recoverySeconds: 0, exitWalkSeconds: 0,
    supplies: { kitId: 'MW2-CURRENT-KIT-1', purchasedWeek: null, pricePaid: 0, clubId: 'MW2-NEW-CLUB', clubHeld: false,
      paperSheets: 0, paperSpent: 0, lampId: 'MW2-NEW-LAMP', oilHeld: 0, oilSpent: 0, lanternPreparedWeek: null } };
}
export const isMiracleWorkerEncounterStage = (s: SliceState): boolean =>
  s.progression.pathwayId === 'diviner' && s.progression.sequence === 2 && s.miracleWorker.promotionWeek !== null;
export const hasMiracleWorkerEncounterLock = (s: SliceState): boolean =>
  s.miracleWorker.encounter.location === MIRACLE_WORKER_SITE && s.miracleWorker.encounter.leftRevision === null;
const COMMANDS = ['ENCOUNTER_INVESTIGATE', 'ENCOUNTER_APPROACH', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT',
  'BUY_CURRENT_KIT', 'LIGHT_CURRENT_LANTERN', 'ENCOUNTER_RECOVER_ORIGINALS', 'ENCOUNTER_LEAVE'] as const;
export function validateMiracleWorkerEncounterCommand(v: unknown): v is MiracleWorkerEncounterCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 &&
    COMMANDS.includes((v as { type: MiracleWorkerEncounterCommand['type'] }).type);
}
export function blockMiracleWorkerEncounter(s: SliceState, c: MiracleWorkerEncounterCommand): string | null {
  if (!validateMiracleWorkerEncounterCommand(c)) return '奇迹师遭遇命令无效；不可传入新敌、伪造资源或复活凭证。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0 || !isMiracleWorkerEncounterStage(s)) return '须本人真实活着晋升奇迹师2；死亡时由独立复活规则处理。';
  if (s.activeEvent || s.combat) return '先处理当前事件或同一场实际战斗。';
  if (hasMiracleWorkerLifeLock(s)) return '先归还生活案原物、结束实际场景影像并收束生活现场。';
  const e = s.miracleWorker.encounter, p = e.supplies;
  if (c.type === 'ENCOUNTER_LEAVE') return e.location !== MIRACLE_WORKER_SITE || !['RESOLVED', 'REVIVED'].includes(e.status)
    ? '须先实际结束冲突或完成本次死亡的真实复起，才能普通步行离场。' : null;
  if (c.type === 'ENCOUNTER_RECOVER_ORIGINALS') return e.status !== 'REVIVED' || e.location !== MIRACLE_WORKER_SITE ||
    e.terminal?.playerOriginalsAt !== MIRACLE_WORKER_SITE || e.originalsRecoveredRevision !== null
    ? '仅能在原尸位亲手拾回本次死亡掉落的同一批自有原物一次。' : null;
  if (e.status !== 'AVAILABLE') return '同一科文已有选择或结局，不能刷新、重开、补灵性或自动再次交战。';
  if (c.type !== 'ENCOUNTER_TALK' && s.actionsRemaining < 1) return '需要1行动；仍可普通拒绝并步行退出。';
  if (c.type === 'ENCOUNTER_INVESTIGATE') return e.investigatedWeek !== null ? '这份当代封存图与出口已核对，不重复收钱或造新情报。'
    : e.location !== 'RECEPTION' ? '先在新时代接待处查阅当代封存图。' : s.cash < 24 ? '当代原档核验须实付24便士，可先从事普通工作。' : null;
  if (c.type === 'BUY_CURRENT_KIT') return e.location !== 'RECEPTION' ? '须在走到现场之前从接待处现有柜存购买。'
    : p.purchasedWeek !== null ? '唯一原器材包已经买过，不刷新补货。' : s.cash < 120 ? '唯一原器材包需要120便士；可以不买。' : null;
  if (c.type === 'ENCOUNTER_APPROACH') return e.investigatedWeek === null ? '先实付调查确认同一当代原人、原场和具名出口。'
    : e.location !== 'RECEPTION' ? '本人已到这一个现场，不能再造一个科文。' : null;
  if (e.location !== MIRACLE_WORKER_SITE || e.arrivalWeek === null) return '先实际步行到旧采石场界石。';
  if (c.type === 'LIGHT_CURRENT_LANTERN') return p.purchasedWeek === null || p.oilHeld !== 1 || p.oilSpent !== 0
    ? '没有本次真实购买且尚未消耗的唯一原灯油。' : null;
  return null;
}
export const miracleWorkerEncounterReason = blockMiracleWorkerEncounter;
export function applyMiracleWorkerEncounter(s: SliceState, c: MiracleWorkerEncounterCommand, ctx: SeerContext): void {
  const reason = blockMiracleWorkerEncounter(s, c); if (reason) throw new Error(reason);
  const e = s.miracleWorker.encounter, p = e.supplies;
  if (!['ENCOUNTER_TALK', 'ENCOUNTER_RECOVER_ORIGINALS', 'ENCOUNTER_LEAVE'].includes(c.type)) s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_INVESTIGATE') {
    s.cash -= 24; e.investigatedWeek = s.week; e.investigationPaid = 24;
    ctx.note('实付核对1651年原现场', '1行动和24便士已付给接待处当代档案柜存服务；核对同一科文的公开登记、有限原能力记录、旧采石场界石与北侧排水梯。没有占卜未知秘密、历史改写或新NPC。'); return;
  }
  if (c.type === 'BUY_CURRENT_KIT') {
    s.cash -= 120; p.purchasedWeek = s.week; p.pricePaid = 120; p.clubHeld = true; p.paperSheets = 4; p.oilHeld = 1;
    ctx.note('实付取得当代唯一原器材', '120便士、1行动真实换取柜存MW2-CURRENT-KIT-1：MW2-NEW-CLUB、4张原纸、MW2-NEW-LAMP及1份油。只有这一个原包；旧物不复制，原纸不是免费预制纸人。'); return;
  }
  if (c.type === 'ENCOUNTER_APPROACH') {
    e.location = MIRACLE_WORKER_SITE; e.arrivalWeek = s.week;
    ctx.note('本人步行到旧采石场界石', `${MIRACLE_WORKER_ENCOUNTER_STORY}现场事实由这次实际抵达核对，尚未开战。`); return;
  }
  if (c.type === 'LIGHT_CURRENT_LANTERN') {
    p.oilHeld = 0; p.oilSpent = 1; p.lanternPreparedWeek = s.week;
    ctx.note('原灯实耗唯一原油', '1行动、1份原油已消耗；MW2-NEW-LAMP置于同一界石，三米局部有真实火焰。同周有效，结局即熄灭，没有任意落点。'); return;
  }
  if (c.type === 'ENCOUNTER_RECOVER_ORIGINALS') {
    e.originalsRecoveredRevision = s.revision + 1; e.recoverySeconds = 10;
    p.clubHeld = p.purchasedWeek !== null;
    ctx.note('在原尸位拾回同一批自有原物', '实际10秒G、0周行动；只把本次死亡前已持有且未消耗的原物位置从界石改回本人携带。既有库存不增加，已用纸油不恢复，对方原棍不属于本人。'); return;
  }
  if (c.type === 'ENCOUNTER_LEAVE') {
    e.location = MIRACLE_WORKER_EXIT; e.leftRevision = s.revision + 1; e.exitWalkSeconds = 30; p.lanternPreparedWeek = null;
    ctx.note('普通步行离开同一现场', `实际30秒G、0周行动；沿北侧排水梯走到旧采石场公共出口，无追逐或自动重战。${e.terminal?.playerOriginalsAt === MIRACLE_WORKER_SITE && e.originalsRecoveredRevision === null ? '未拾回的原物仍留界石，不另发一套。' : '仅携带本人已有原物。'}科文的原H/M/S、伤势、原棍位置与终局全部保留。`); return;
  }
  e.attemptWeek = s.week;
  if (c.type === 'ENCOUNTER_TALK') {
    e.status = 'RETREATED'; e.location = MIRACLE_WORKER_EXIT; e.leftRevision = s.revision + 1; e.exitWalkSeconds = 30; p.lanternPreparedWeek = null;
    ctx.note('普通拒绝并从具名出口离开', '实际30秒G、0周行动；拒绝争夺当代封存标记，沿北侧排水梯步行离开，无追逐、奖励或夺棍。同一原科文保持H100/M100/S120，不再开放重战。'); return;
  }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'MIRACLE_WORKER_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('与同一当代原科文实际开战', MIRACLE_WORKER_ENCOUNTER_STORY);
}
export const applyMiracleWorkerEncounterCommand = applyMiracleWorkerEncounter;

export function hasMiracleWorkerDisputeOpponent(s: SliceState): boolean {
  const e = s.miracleWorker.encounter, c = s.combat;
  return isMiracleWorkerEncounterStage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && s.activeEvent === null &&
    !hasMiracleWorkerLifeLock(s) &&
    e.location === MIRACLE_WORKER_SITE && e.investigatedWeek !== null && e.arrivalWeek !== null && e.investigationPaid === 24 &&
    c?.encounterId === 'MIRACLE_WORKER_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 &&
    e.status === 'FIGHTING' && e.targetId === MIRACLE_WORKER_TARGET_ID && e.terminal === null && e.attemptWeek === s.week &&
    e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind && e.enemyStatus === c.enemyStatus &&
    stableStringify(e.enemyInjuries) === stableStringify(c.enemyInjuries) && e.enemyRisk === c.enemyRisk &&
    Number.isSafeInteger(e.enemySpirituality) && e.enemySpirituality >= 0 &&
    e.enemySpirituality === 120 - MIRACLE_WORKER_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) &&
    e.startHistoryIndex !== null && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}

/** Call after the common adapter has appended its terminal round to history.
 * On PLAYER_DEAD the shared S2 transition must decide REVIVAL_PENDING vs LOST;
 * this function deliberately does not change global status or grant revival. */
export function settleMiracleWorkerEncounter(s: SliceState, outcome: string, ctx: SeerContext,
  _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.miracleWorker.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'MIRACLE_WORKER_DISPUTE') throw new Error('没有同一当代原科文的实际冲突。');
  if (outcome === 'CONTINUE') return;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知奇迹师冲突结果。');
  const last = c.lastRound, o = last?.miracleWorkerOutcome;
  if (e.terminal || e.startHistoryIndex === null || !last || !validateMiracleWorkerRoundOutcome(o) || o.continuing ||
    c.round !== last.round + 1 || s.combatHistory.length - e.startHistoryIndex !== last.round ||
    stableStringify(s.combatHistory.at(-1)) !== stableStringify(last) || o.enemySpirituality !== e.enemySpirituality ||
    o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || o.enemyStatus !== c.enemyStatus ||
    o.playerHealthAfter !== s.health || o.playerMindAfter !== s.mind || o.playerSpiritualityAfter !== s.spirituality ||
    o.playerRiskAfter !== s.injuryRisk || o.enemyRiskAfter !== c.enemyRisk ||
    stableStringify(o.playerInjuriesAfter) !== stableStringify(s.injuries) || stableStringify(o.enemyInjuriesAfter) !== stableStringify(c.enemyInjuries) ||
    outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS') ||
    outcome === 'RETREATED' && (s.health <= 0 || last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY') ||
    outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER') ||
    outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER'))
    throw new Error('结局不对应同一真实原回合、身体和有限原资源。');
  e.terminal = { outcome: outcome as MiracleWorkerEncounterTerminal['outcome'], round: last.round,
    historyIndex: s.combatHistory.length - 1, revision: s.revision + 1,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality,
    enemyStatus: c.enemyStatus, enemyRisk: c.enemyRisk, enemyInjuries: structuredClone(c.enemyInjuries),
    enemyWeaponAt: outcome === 'ENEMY_DEAD' ? MIRACLE_WORKER_SITE : 'WITH_ENEMY',
    playerOriginalsAt: outcome === 'PLAYER_DEAD' ? MIRACLE_WORKER_SITE : 'WITH_PLAYER',
    playerBodyAt: outcome === 'PLAYER_DEAD' ? MIRACLE_WORKER_SITE : 'WITH_PLAYER' };
  e.status = outcome === 'PLAYER_DEAD' ? 'REVIVAL_PENDING' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  if (outcome === 'PLAYER_DEAD') e.supplies.clubHeld = false;
  if (outcome === 'RETREATED') { e.location = MIRACLE_WORKER_EXIT; e.leftRevision = s.revision + 1; e.exitWalkSeconds = 30; }
  e.supplies.lanternPreparedWeek = null; s.combat = null;
  ctx.note('同一当代原冲突结算', `${outcome === 'PLAYER_DEAD' ? '本人实际PLAYER_DEAD，原尸位与未消耗自有原物留在界石；只留下REVIVAL_PENDING接口，是否能复起由独立奇迹师复活账本验证。' : outcome === 'RETREATED' ? '本人沿北侧排水梯实际步行撤出，未夺原棍，无追逐。' : outcome === 'ENEMY_DEAD' ? '科文同一原身体实际死亡，自有原棍留在界石，不刷新新敌或发放战利品。' : '科文因原伤自行停止抵抗，仍活着并保有自己的原棍。'}全部真实消耗、敌人H/M/S与伤势保留；原灯熄灭、临时历史效果结束。复起不会重置终局，也不会自动重战。`);
}

/** Internal integration hook, never an externally accepted command. The caller
 * must first validate and persist the shared revival ledger for this death.
 * Retains PLAYER_DEAD history and corpse-site/property records immutably. */
export function markMiracleWorkerEncounterRevived(s: SliceState,
  receipt: NonNullable<MiracleWorkerEncounterState['revivalReceipt']>): void {
  const e = s.miracleWorker.encounter;
  if (e.status !== 'REVIVAL_PENDING' || e.terminal?.outcome !== 'PLAYER_DEAD' || e.revivalReceipt ||
    e.location !== MIRACLE_WORKER_SITE || receipt.deathHistoryIndex !== e.terminal.historyIndex ||
    receipt.revivedRevision !== s.revision + 1 || !receipt.revivalId || s.health <= 0 || s.mind <= 0 || s.combat)
    throw new Error('复起回执必须属于这一次真实PLAYER_DEAD，不能创造第二身体、原物或重置敌人。');
  e.revivalReceipt = { ...receipt }; e.status = 'REVIVED';
}

export function miracleWorkerEncounterActions(s: SliceState): MiracleWorkerEncounterAction[] {
  if (!isMiracleWorkerEncounterStage(s)) return [];
  return ([['ENCOUNTER_INVESTIGATE', '核对当代原人、界石和出口', '1行动 · 24便士（G）'],
    ['BUY_CURRENT_KIT', '购买唯一当代原器材包', '1行动 · 120便士（G）'],
    ['ENCOUNTER_APPROACH', '步行到旧采石场界石', '1行动 · 亲眼核对原现场'],
    ['LIGHT_CURRENT_LANTERN', '点燃同一现场原灯', '1行动 · 唯一原油1'],
    ['ENCOUNTER_TALK', '拒绝争夺并普通离开', '30秒G · 0周行动 · 无追逐'],
    ['ENCOUNTER_FIGHT', '与同一原科文实际交战', '1行动 · 共同六槽与真实死亡风险'],
    ['ENCOUNTER_RECOVER_ORIGINALS', '从原尸位拾回自有原物', '10秒G · 0周行动 · 只拾原物'],
    ['ENCOUNTER_LEAVE', '普通步行到采石场公共出口', '30秒G · 0周行动 · 无自动重战']] as const).map(([type, label, cost]) => {
    const command: MiracleWorkerEncounterCommand = { type }, reason = blockMiracleWorkerEncounter(s, command);
    return { id: `MW2-ENCOUNTER:${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectMiracleWorkerEncounter(s: SliceState): MiracleWorkerEncounterProjection {
  if (!isMiracleWorkerEncounterStage(s)) return { encounter: null };
  const e = s.miracleWorker.encounter, p = e.supplies;
  return { encounter: { ...structuredClone(e), name: '科文·黑尔（1651年原创成年S3，46岁，G）', story: MIRACLE_WORKER_ENCOUNTER_STORY,
    sequence: 3, age: 46, originalExit: '旧采石场北侧排水梯 → 旧采石场公共出口', pursuit: false, distanceMetres: 3, noBystanders: true,
    abilities: MIRACLE_WORKER_POWERS.map(x => ({ ...x, available: e.enemyStatus === 'RESISTING' && e.enemySpirituality >= x.cost })),
    facts: [`同一原科文H${e.enemyHealth}/M${e.enemyMind}/S${e.enemySpirituality}；原棍MW2-CORVEN-CLUB始终属于科文。`,
      e.investigatedWeek === null ? '尚未付费调查，尚无现场通行依据。' : '调查已真实支付24便士和1行动；进入现场另需1行动。',
      p.purchasedWeek === null ? '未购买本阶段原器材；没有免费新棍、原纸、油或纸人。' : `已购唯一原包：纸余${p.paperSheets}/4，耗纸${p.paperSpent}，油余${p.oilHeld}，原棍${p.clubHeld ? '随本人' : '留原尸位'}。`,
      p.lanternPreparedWeek === s.week ? '本周同场原灯已真实点燃，可供三米局部有限火焰能力。' : '没有本周同场实付火源，相关能力按原槽普通回退。',
      'PLAYER_DEAD证据永久保留；复活另验，敌状态、尸位与物件位置不重置。',
      e.status === 'REVIVED' ? e.leftRevision !== null ? '复起后已普通步行到采石场公共出口；同一原敌与未拾原物留在原处，不自动再战。'
        : '已经复起在界石北侧一米处（G）；可以走回原尸位拾回自己的原物，或直接走北侧排水梯，不自动再战。'
        : '退出不会复制库存、复活敌人、清空消耗或改写旧时代结局。'] } };
}
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const injuriesValid = (v: SliceInjury[]) => Array.isArray(v) && v.every(i => !!i && typeof i.id === 'string' && ['LIGHT', 'HEAVY'].includes(i.severity) &&
  integer(i.acquiredRevision) && (i.treatedRevision === null || integer(i.treatedRevision, i.acquiredRevision)));
export function validateMiracleWorkerEncounter(s: SliceState): boolean {
  try {
    const e = s.miracleWorker.encounter, p = e.supplies, fresh = createMiracleWorkerEncounterState();
    if (!e || e.targetId !== MIRACLE_WORKER_TARGET_ID || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'REVIVAL_PENDING', 'REVIVED', 'LOST'].includes(e.status) ||
      !['RECEPTION', MIRACLE_WORKER_SITE, MIRACLE_WORKER_EXIT].includes(e.location) || !integer(e.enemyHealth, 0, 100) ||
      !integer(e.enemyMind, 1, 100) || !integer(e.enemySpirituality, 0, 120) || !integer(e.enemyRisk) || !injuriesValid(e.enemyInjuries) ||
      !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0)) return false;
    if (!e.powerUses || Object.keys(e.powerUses).length !== 3 || MIRACLE_WORKER_POWER_IDS.some(id => !integer(e.powerUses[id])) ||
      e.enemySpirituality !== 120 - MIRACLE_WORKER_POWERS.reduce((n, x) => n + e.powerUses[x.id] * x.cost, 0)) return false;
    const minWeek = s.miracleWorker.promotionWeek ?? 0;
    for (const n of [e.investigatedWeek, e.arrivalWeek, e.attemptWeek, p.purchasedWeek, p.lanternPreparedWeek]) if (n !== null && !integer(n, minWeek, s.week)) return false;
    if (e.investigatedWeek === null ? e.investigationPaid !== 0 || e.arrivalWeek !== null || e.location !== 'RECEPTION' : e.investigationPaid !== 24) return false;
    if (e.arrivalWeek !== null && (e.investigatedWeek === null || e.arrivalWeek < e.investigatedWeek || e.location === 'RECEPTION')) return false;
    if (e.location !== 'RECEPTION' && e.arrivalWeek === null) return false;
    if (e.attemptWeek !== null && (e.arrivalWeek === null || e.attemptWeek < e.arrivalWeek)) return false;
    for (const n of [e.leftRevision, e.originalsRecoveredRevision]) if (n !== null && !integer(n, 1, s.revision)) return false;
    if ((e.location === MIRACLE_WORKER_EXIT) !== (e.leftRevision !== null)) return false;
    if (e.exitWalkSeconds !== (e.leftRevision === null ? 0 : 30) || e.recoverySeconds !== (e.originalsRecoveredRevision === null ? 0 : 10)) return false;
    if (!p || p.kitId !== fresh.supplies.kitId || p.clubId !== fresh.supplies.clubId || p.lampId !== fresh.supplies.lampId || typeof p.clubHeld !== 'boolean' ||
      !integer(p.paperSheets, 0, 4) || !integer(p.paperSpent, 0, 4) || ![0, 1].includes(p.oilHeld) || ![0, 1].includes(p.oilSpent)) return false;
    if (p.purchasedWeek === null) { if (stableStringify(p) !== stableStringify(fresh.supplies)) return false; }
    else if (p.pricePaid !== 120 || p.paperSheets + p.paperSpent !== 4 || p.oilHeld + p.oilSpent !== 1 ||
      p.clubHeld !== (e.terminal?.outcome !== 'PLAYER_DEAD' || e.originalsRecoveredRevision !== null) ||
      p.lanternPreparedWeek !== null && (p.lanternPreparedWeek < p.purchasedWeek || p.oilSpent !== 1)) return false;
    if (s.miracleWorker.promotionWeek === null) return stableStringify(e) === stableStringify(fresh) && s.combat?.encounterId !== 'MIRACLE_WORKER_DISPUTE';
    if (e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length)) return false;
    if (e.startHistoryIndex === null) return ['AVAILABLE', 'RETREATED'].includes(e.status) && e.terminal === null && e.revivalReceipt === null &&
      e.originalsRecoveredRevision === null && e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 120 &&
      Object.values(e.powerUses).every(n => n === 0) && e.enemyInjuries.length === 0 && e.enemyRisk === 0 && p.paperSpent === 0 &&
      (e.status === 'AVAILABLE' ? e.attemptWeek === null && e.location !== MIRACLE_WORKER_EXIT : e.attemptWeek !== null && e.location === MIRACLE_WORKER_EXIT) &&
      s.combat?.encounterId !== 'MIRACLE_WORKER_DISPUTE';
    if (e.investigatedWeek === null || e.attemptWeek === null) return false;
    const end = e.terminal ? e.terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
    let previous: MiracleWorkerRoundOutcome | undefined;
    for (const [index, round] of rounds.entries()) {
      const o = round.miracleWorkerOutcome;
      if (!validateMiracleWorkerRoundOutcome(o) || round.round !== index + 1 || round.round !== o.round || round.stance !== o.stance || round.winner === null ||
        o.source.runId !== s.runId || o.source.week !== e.attemptWeek || o.source.startHistoryIndex !== e.startHistoryIndex ||
        index < rounds.length - 1 && (!o.continuing || round.retreat === 'SUCCESS')) return false;
      if (previous ? o.source.enemyHealth !== previous.enemyHealth || o.source.enemyMind !== previous.enemyMind ||
        o.enemySpiritualityBefore !== previous.enemySpirituality || o.source.playerHealth !== previous.playerHealthAfter ||
        o.source.playerMind !== previous.playerMindAfter || o.playerSpiritualityBefore !== Math.min(120, previous.playerSpiritualityAfter + 12) ||
        o.source.playerRisk !== previous.playerRiskAfter || o.source.enemyRisk !== previous.enemyRiskAfter ||
        stableStringify(o.source.playerInjuries) !== stableStringify(previous.playerInjuriesAfter) ||
        stableStringify(o.source.enemyInjuries) !== stableStringify(previous.enemyInjuriesAfter) ||
        stableStringify(o.source.damageTransfers) !== stableStringify(previous.damageTransfersAfter) ||
        stableStringify(o.source.supplies) !== stableStringify(previous.suppliesAfter) || stableStringify(o.source.powerUses) !== stableStringify(previous.powerUses)
        : o.source.enemyHealth !== 100 || o.source.enemyMind !== 100 || o.enemySpiritualityBefore !== 120 ||
          o.source.enemyRisk !== 0 || o.source.enemyInjuries.length !== 0 || Object.values(o.source.powerUses).some(n => n !== 0) || o.source.supplies.paperSpent !== 0) return false;
      const moves = [...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))]
        .sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
      if (stableStringify(moves) !== stableStringify(round.moves) || o.playerActions.length > round.playerCount || o.enemyActions.length > round.enemyCount) return false;
      if (round.winChance !== miracleWorkerWinChance(round.playerAdvantage, round.enemyAdvantage, o.winChanceBonus)) return false;
      previous = o;
    }
    if (previous && (e.enemyHealth !== previous.enemyHealth || e.enemyMind !== previous.enemyMind || e.enemySpirituality !== previous.enemySpirituality ||
      e.enemyRisk !== previous.enemyRiskAfter || stableStringify(e.enemyInjuries) !== stableStringify(previous.enemyInjuriesAfter) ||
      stableStringify(e.powerUses) !== stableStringify(previous.powerUses) || p.paperSheets !== previous.suppliesAfter.paperSheets || p.paperSpent !== previous.suppliesAfter.paperSpent)) return false;
    if (!previous && (e.enemyHealth !== 100 || e.enemyMind !== 100 || e.enemySpirituality !== 120 || e.enemyRisk !== 0 ||
      e.enemyInjuries.length !== 0 || p.paperSpent !== 0 || Object.values(e.powerUses).some(n => n !== 0))) return false;
    if (e.status === 'FIGHTING') return e.terminal === null && e.revivalReceipt === null && e.originalsRecoveredRevision === null &&
      hasMiracleWorkerDisputeOpponent(s) && (!previous || previous.continuing);
    const t = e.terminal, last = rounds.at(-1);
    if (!t || !previous || !last || previous.continuing || t.round !== last.round || t.historyIndex !== end - 1 ||
      !integer(t.revision, 1, s.revision) || t.enemyHealth !== e.enemyHealth || t.enemyMind !== e.enemyMind || t.enemySpirituality !== e.enemySpirituality ||
      t.enemyStatus !== e.enemyStatus || t.enemyRisk !== e.enemyRisk || stableStringify(t.enemyInjuries) !== stableStringify(e.enemyInjuries) ||
      s.combat?.encounterId === 'MIRACLE_WORKER_DISPUTE' || p.lanternPreparedWeek !== null) return false;
    if (t.enemyWeaponAt !== (t.outcome === 'ENEMY_DEAD' ? MIRACLE_WORKER_SITE : 'WITH_ENEMY') ||
      t.playerBodyAt !== (t.outcome === 'PLAYER_DEAD' ? MIRACLE_WORKER_SITE : 'WITH_PLAYER') ||
      t.playerOriginalsAt !== (t.outcome === 'PLAYER_DEAD' ? MIRACLE_WORKER_SITE : 'WITH_PLAYER')) return false;
    if (t.outcome === 'PLAYER_DEAD') {
      if (last.winner !== 'ENEMY' || previous.playerHealthAfter !== 0 || last.retreat === 'SUCCESS') return false;
      if (!e.revivalReceipt) return ['REVIVAL_PENDING', 'LOST'].includes(e.status) && s.health === 0 && e.location === MIRACLE_WORKER_SITE && e.originalsRecoveredRevision === null;
      const r = e.revivalReceipt;
      return e.status === 'REVIVED' && r.deathHistoryIndex === t.historyIndex && typeof r.revivalId === 'string' && r.revivalId.length > 0 &&
        integer(r.revivedRevision, t.revision + 1, s.revision) && (e.originalsRecoveredRevision === null || e.originalsRecoveredRevision > r.revivedRevision) &&
        (e.leftRevision === null || e.leftRevision > r.revivedRevision);
    }
    return e.revivalReceipt === null && e.originalsRecoveredRevision === null &&
      (t.outcome === 'RETREATED' ? e.status === 'RETREATED' && e.location === MIRACLE_WORKER_EXIT && last.retreat === 'SUCCESS'
        : t.outcome === 'ENEMY_DEAD' ? e.status === 'RESOLVED' && e.enemyStatus === 'DEAD' && last.winner === 'PLAYER'
        : t.outcome === 'ENEMY_SURRENDERED' && e.status === 'RESOLVED' && e.enemyStatus === 'SURRENDERED' && last.winner === 'PLAYER');
  } catch { return false; }
}
