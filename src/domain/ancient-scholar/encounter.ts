import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasAncientScholarLifeLock, isAncientScholarStage } from './life.js';
import { validateAncientScholarRoundOutcome, type AncientScholarRoundOutcome } from './combat.js';
import type { AncientScholarAction } from './types.js';

export const ANCIENT_SCHOLAR_TARGET_ID = 'AS3-ROOK-VENN' as const;
export const ANCIENT_SCHOLAR_POWER_IDS = ['ARC_BOLT', 'WARD', 'COMPOSE'] as const;
export type AncientScholarPowerId = typeof ANCIENT_SCHOLAR_POWER_IDS[number];
export type AncientScholarEnemyIntent = AncientScholarPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const ANCIENT_SCHOLAR_POWERS = [
  { id: 'ARC_BOLT', label: '原有限弧光术（G）', cost: 5, selfGain: 75, enemyReduction: 0 },
  { id: 'WARD', label: '原有限小型护术（G）', cost: 4, selfGain: 0, enemyReduction: 45 },
  { id: 'COMPOSE', label: '本人普通整理原棍姿势（G）', cost: 0, selfGain: 0, enemyReduction: 0 },
] as const;
export interface AncientScholarEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface AncientScholarCombatSupplies {
  kitId: 'AS3-CURRENT-KIT-1'; purchasedWeek: number | null; pricePaid: 0 | 120;
  clubId: 'AS3-NEW-CLUB'; clubHeld: boolean; paperSheets: number; paperSpent: number;
  lampId: 'AS3-NEW-LAMP'; oilHeld: 0 | 1; oilSpent: 0 | 1; lanternPreparedWeek: number | null;
}
export interface AncientScholarEncounterState {
  status: 'AVAILABLE' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof ANCIENT_SCHOLAR_TARGET_ID;
  attemptWeek: number | null; startHistoryIndex: number | null; enemyHealth: number; enemyMind: number; enemySpirituality: number;
  enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD'; enemyInjuries: SliceInjury[]; enemyRisk: number;
  powerUses: Record<AncientScholarPowerId, number>; supplies: AncientScholarCombatSupplies; terminal: AncientScholarEncounterTerminal | null;
}
export type AncientScholarEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'BUY_CURRENT_KIT' | 'LIGHT_CURRENT_LANTERN' };
export interface AncientScholarEncounterProjection {
  encounter: (AncientScholarEncounterState & { name: string; story: string; sequence: 4; age: 41; originalExit: string; pursuit: false; distanceMetres: 2; noBystanders: true;
    abilities: { id: AncientScholarPowerId; label: string; cost: number; selfGain: number; enemyReduction: number; available: boolean }[]; facts: string[] }) | null;
}
export const ANCIENT_SCHOLAR_ENCOUNTER_STORY = '后世原创成年非凡者鲁克·文恩（AS3-ROOK-VENN，41岁，序列4等效G）在新时代接待处独立净空外院，坚持自行保有自己的AS3-ROOK-CLUB，与本人相隔2米。两人原身体可见、独立心智、无旁人；本次新物权争议的原普通出口开放，无追逐，可普通拒绝。鲁克不是旧多恩或玛拉，不是历史影像，不会复活、重生或补充资源。原H100/M100/S120，弧光实耗5灵性、贡献75，护术实耗4灵性、减势45；资源不足原槽用原棍20×身体，不重抽。双方同六槽盘、本版保占卜家既有1250/底125、最大灵性120/回合恢复12的有限G基线，不用天使库或保证胜利。旧纸、旧油和旧预制纸人仅保历史，不可使用；可实付120便士和1行动取得本时代唯一原器材包，再付1行动耗唯一油准备真实原灯。借力、影像、藏身都须本人已经真实学习的来源与当下灵性；能力无来源或资源不足只普通回退，无高位免费影像、未知秘密、独立双自我或任意无敌逃跑。';
export function createAncientScholarEncounterState(): AncientScholarEncounterState {
  return { status: 'AVAILABLE', targetId: ANCIENT_SCHOLAR_TARGET_ID, attemptWeek: null, startHistoryIndex: null,
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', enemyInjuries: [], enemyRisk: 0,
    powerUses: { ARC_BOLT: 0, WARD: 0, COMPOSE: 0 }, terminal: null,
    supplies: { kitId: 'AS3-CURRENT-KIT-1', purchasedWeek: null, pricePaid: 0, clubId: 'AS3-NEW-CLUB', clubHeld: false, paperSheets: 0, paperSpent: 0,
      lampId: 'AS3-NEW-LAMP', oilHeld: 0, oilSpent: 0, lanternPreparedWeek: null } };
}
const ready = (s: SliceState) => isAncientScholarStage(s) && s.ancientScholar.ritual.location === 'RECEPTION';
const reported = (s: SliceState) => Object.values(s.ancientScholar.life.cases).some(c => c.status === 'RESOLVED');
const closed = (s: SliceState) => !hasAncientScholarLifeLock(s) && Object.values(s.ancientScholar.life.cases).every(c => c.status !== 'PREPARED');
export const hasAncientScholarEncounterLock = (s: SliceState): boolean => s.ancientScholar.encounter.status === 'FIGHTING';
export function validateAncientScholarEncounterCommand(v: unknown): v is AncientScholarEncounterCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'BUY_CURRENT_KIT', 'LIGHT_CURRENT_LANTERN'].includes(String((v as { type?: unknown }).type));
}
export function blockAncientScholarEncounter(s: SliceState, c: AncientScholarEncounterCommand): string | null {
  if (!validateAncientScholarEncounterCommand(c)) return '古代学者遭遇命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0 || !ready(s)) return '须本人活着晋升古代学者3，实际到新时代接待处。';
  if (s.activeEvent || s.combat || !closed(s)) return '先处理事件并真实结束实践、返回现实与收束准备。';
  const e = s.ancientScholar.encounter, p = e.supplies;
  if (e.status !== 'AVAILABLE') return '同一鲁克已有选择或结局，不能重开、复活或补灵性。';
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'BUY_CURRENT_KIT') return p.purchasedWeek !== null ? '本时代这一包原器材已取得，不凭空补货。' : s.cash < 120 ? '本时代原器材包需要120便士；仍可不买，使用本人空手或既有能力。' : null;
  if (c.type === 'LIGHT_CURRENT_LANTERN') return p.purchasedWeek === null || p.oilHeld < 1 || p.oilSpent ? '没有本时代实际购入且未耗的原灯油；旧油仅是历史。' : null;
  return reported(s) ? null : '先完成至少一份古代学者真实报告，熟悉新时代接待处。';
}
export const ancientScholarEncounterReason = blockAncientScholarEncounter;
export function applyAncientScholarEncounter(s: SliceState, c: AncientScholarEncounterCommand, ctx: SeerContext): void {
  const reason = blockAncientScholarEncounter(s, c); if (reason) throw new Error(reason);
  const e = s.ancientScholar.encounter, p = e.supplies; s.actionsRemaining--;
  if (c.type === 'BUY_CURRENT_KIT') { s.cash -= 120; p.purchasedWeek = s.week; p.pricePaid = 120; p.clubHeld = true; p.paperSheets = 4; p.oilHeld = 1;
    ctx.note('新时代原器材实际买到本人手中', '艾琳从接待处当代柜存交付AS3-CURRENT-KIT-1；120便士、1行动实付，内有新原短棍AS3-NEW-CLUB、4张普通原纸与AS3-NEW-LAMP及1份油。它们是本次真实采购，不恢复旧耗材、不能循环购买，也没有预制纸人。'); return; }
  if (c.type === 'LIGHT_CURRENT_LANTERN') { p.oilHeld = 0; p.oilSpent = 1; p.lanternPreparedWeek = s.week; ctx.note('实耗新时代唯一原灯油', '1行动、1份原油已用；新原灯只为同周这场两米净空外院提供实际火源，后续周或结局熄灭，原油不补。'); return; }
  e.attemptWeek = s.week;
  if (c.type === 'ENCOUNTER_TALK') { e.status = 'RETREATED'; p.lanternPreparedWeek = null; ctx.note('普通拒绝这次物权争议并离开', '本人实付1行动，沿接待处原普通出口离开，无追逐；鲁克原人仍活着，自己的棍、健康和120灵性未变。旧NPC不重开，没有奖励。'); return; }
  e.status = 'FIGHTING'; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'ANCIENT_SCHOLAR_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind, enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('新时代同一原鲁克的真实冲突', ANCIENT_SCHOLAR_ENCOUNTER_STORY);
}
export const applyAncientScholarEncounterCommand = applyAncientScholarEncounter;
export function hasAncientScholarDisputeOpponent(s: SliceState): boolean {
  const e = s.ancientScholar.encounter, c = s.combat;
  return ready(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && s.activeEvent === null && closed(s) && reported(s) &&
    c?.encounterId === 'ANCIENT_SCHOLAR_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 &&
    e.status === 'FIGHTING' && e.targetId === ANCIENT_SCHOLAR_TARGET_ID && e.terminal === null && e.attemptWeek === s.week &&
    e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind && e.enemyStatus === c.enemyStatus && stableStringify(e.enemyInjuries) === stableStringify(c.enemyInjuries) && e.enemyRisk === c.enemyRisk &&
    Number.isSafeInteger(e.enemySpirituality) && e.enemySpirituality >= 0 && e.enemySpirituality === 120 - ANCIENT_SCHOLAR_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) &&
    e.startHistoryIndex !== null && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
export function settleAncientScholarEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.ancientScholar.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'ANCIENT_SCHOLAR_DISPUTE') throw new Error('没有同一鲁克的真实冲突。');
  if (outcome === 'CONTINUE') return;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知后世冲突结果。');
  const last = c.lastRound, o = last?.ancientScholarOutcome;
  if (e.terminal || e.startHistoryIndex === null || !last || !o || !validateAncientScholarRoundOutcome(o) || o.continuing || c.round !== last.round + 1 || s.combatHistory.length - e.startHistoryIndex !== last.round || stableStringify(s.combatHistory.at(-1)) !== stableStringify(last) ||
    o.enemySpirituality !== e.enemySpirituality || o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind ||
    outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS') ||
    outcome === 'RETREATED' && (s.health <= 0 || last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY') ||
    outcome === 'ENEMY_DEAD' && (c.enemyStatus !== 'DEAD' || c.enemyHealth !== 0 || last.winner !== 'PLAYER') ||
    outcome === 'ENEMY_SURRENDERED' && (c.enemyStatus !== 'SURRENDERED' || c.enemyHealth <= 0 || last.winner !== 'PLAYER')) throw new Error('结局与同一原回合、身体、有限原资源不一致。');
  e.terminal = { outcome: outcome as AncientScholarEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1, enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; e.supplies.lanternPreparedWeek = null; s.combat = null;
  ctx.note('同一后世鲁克的冲突实际结束', `${outcome === 'PLAYER_DEAD' ? '本人原身体真实死亡，借过去和历史影像不能复活。' : outcome === 'ENEMY_DEAD' ? '同一鲁克真实死亡，自己的原棍留在原现场，没有替身或再生新敌。' : outcome === 'RETREATED' ? '本人沿原普通出口离开，无追逐；不是藏身永久避战或瞬移。' : '原鲁克因真实伤势自行停止抵抗，仍活着、保有自己的原棍，不是历史影像强制控制。'}真实消耗与原伤保留，临时借力与唯一影像全部失效、本人已返回现实；旧多恩、旧鼠和旧时代物权完全不变。`);
}
export function ancientScholarEncounterActions(s: SliceState): AncientScholarAction[] {
  if (!ready(s)) return [];
  return ([['BUY_CURRENT_KIT', '买新时代唯一原器材包', '1行动 · 120便士 · 原棍/4纸/灯与1油'], ['LIGHT_CURRENT_LANTERN', '点燃新时代同一原灯', '1行动 · 实耗唯一原油'], ['ENCOUNTER_TALK', '普通拒绝后世争议并离开', '1行动 · 无追逐'], ['ENCOUNTER_FIGHT', '与同一后世鲁克实际交战', '1行动 · 真实受伤与死亡风险']] as const).map(([type, label, cost]) => {
    const command: AncientScholarEncounterCommand = { type }, reason = blockAncientScholarEncounter(s, command); return { id: `AS3-ENCOUNTER:${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectAncientScholarEncounter(s: SliceState): AncientScholarEncounterProjection {
  if (!isAncientScholarStage(s)) return { encounter: null };
  const e = s.ancientScholar.encounter, p = e.supplies;
  return { encounter: { ...structuredClone(e), name: '鲁克·文恩（原创后世成人，41岁，G）', story: ANCIENT_SCHOLAR_ENCOUNTER_STORY, sequence: 4, age: 41,
    originalExit: '新时代接待处独立净空外院的原普通出口', pursuit: false, distanceMetres: 2, noBystanders: true,
    abilities: ANCIENT_SCHOLAR_POWERS.map(x => ({ ...x, available: e.enemyStatus === 'RESISTING' && e.enemySpirituality >= x.cost })),
    facts: [`原鲁克H${e.enemyHealth}/M${e.enemyMind}/S${e.enemySpirituality}，原棍属于他本人；不与旧NPC共用身份。`,
      p.purchasedWeek === null ? '尚未购入本时代器材，旧纸/油/预制纸人只保历史；没有赠送装备。' : `本时代实际120便士原包：本人原棍${p.clubHeld ? '在手' : '不在手'}、纸${p.paperSheets}/4、已用纸${p.paperSpent}、原油剩${p.oilHeld}。`,
      p.lanternPreparedWeek === s.week ? '本周同一原灯已实耗油，现场两米内存在真实火焰。' : '没有本周实际准备的火源，火焰技能普通回退。',
      '仅本次物权争议有开放出口且无追逐；普通拒绝、撤退、投降或死亡均保留。'] } };
}
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export function validateAncientScholarEncounter(s: SliceState): boolean {
  try {
    const e = s.ancientScholar.encounter, p = e.supplies;
    if (!e || e.targetId !== ANCIENT_SCHOLAR_TARGET_ID || !['AVAILABLE', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 1, 100) || !integer(e.enemySpirituality, 0, 120) || !integer(e.enemyRisk) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) || !Array.isArray(e.enemyInjuries) || e.enemyInjuries.some(i => !i || typeof i.id !== 'string' || !['LIGHT', 'HEAVY'].includes(i.severity) || !integer(i.acquiredRevision) || i.treatedRevision !== null && !integer(i.treatedRevision, i.acquiredRevision))) return false;
    if (!e.powerUses || Object.keys(e.powerUses).length !== 3 || ANCIENT_SCHOLAR_POWER_IDS.some(id => !integer(e.powerUses[id])) || e.enemySpirituality !== 120 - ANCIENT_SCHOLAR_POWERS.reduce((n, a) => n + e.powerUses[a.id] * a.cost, 0)) return false;
    if (!p || p.kitId !== 'AS3-CURRENT-KIT-1' || p.clubId !== 'AS3-NEW-CLUB' || p.lampId !== 'AS3-NEW-LAMP' || typeof p.clubHeld !== 'boolean' || !integer(p.paperSheets, 0, 4) || !integer(p.paperSpent, 0, 4) || ![0, 1].includes(p.oilHeld) || ![0, 1].includes(p.oilSpent)) return false;
    if (p.purchasedWeek === null) { if (stableStringify(p) !== stableStringify(createAncientScholarEncounterState().supplies)) return false; }
    else if (!integer(p.purchasedWeek, s.ancientScholar.promotionWeek ?? 0, s.week) || p.pricePaid !== 120 || !p.clubHeld || p.paperSheets + p.paperSpent !== 4 || p.oilHeld + p.oilSpent !== 1 || p.lanternPreparedWeek !== null && (!integer(p.lanternPreparedWeek, p.purchasedWeek, s.week) || p.oilSpent !== 1)) return false;
    if (e.attemptWeek !== null && !integer(e.attemptWeek, s.ancientScholar.promotionWeek ?? 0, s.week) || e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length)) return false;
    if (s.ancientScholar.promotionWeek === null) return stableStringify(e) === stableStringify(createAncientScholarEncounterState()) && s.combat?.encounterId !== 'ANCIENT_SCHOLAR_DISPUTE';
    if (e.startHistoryIndex === null) return ['AVAILABLE', 'RETREATED'].includes(e.status) && e.terminal === null && e.enemyHealth === 100 && e.enemyMind === 100 && e.enemySpirituality === 120 && Object.values(e.powerUses).every(n => n === 0) && e.enemyInjuries.length === 0 && e.enemyRisk === 0 && p.paperSpent === 0 && (e.status === 'AVAILABLE' ? e.attemptWeek === null : e.attemptWeek !== null && reported(s)) && s.combat?.encounterId !== 'ANCIENT_SCHOLAR_DISPUTE';
    if (!reported(s) || e.attemptWeek === null) return false;
    const end = e.terminal ? e.terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
    let previous: AncientScholarRoundOutcome | undefined;
    for (const [index, round] of rounds.entries()) {
      const o = round.ancientScholarOutcome;
      if (!validateAncientScholarRoundOutcome(o) || round.round !== index + 1 || round.round !== o.round || round.stance !== o.stance || round.winner === null || o.source.runId !== s.runId || o.source.week !== e.attemptWeek || o.source.startHistoryIndex !== e.startHistoryIndex || index < rounds.length - 1 && (!o.continuing || round.retreat === 'SUCCESS')) return false;
      if (previous ? o.source.enemyHealth !== previous.enemyHealth || o.source.enemyMind !== previous.enemyMind || o.enemySpiritualityBefore !== previous.enemySpirituality || o.source.playerHealth !== previous.playerHealthAfter || o.source.playerMind !== previous.playerMindAfter || o.playerSpiritualityBefore !== Math.min(120, previous.playerSpiritualityAfter + 12) || o.source.supplies.paperSheets !== previous.suppliesAfter.paperSheets || o.source.supplies.paperSpent !== previous.suppliesAfter.paperSpent || stableStringify(o.source.powerUses) !== stableStringify(previous.powerUses) : o.source.enemyHealth !== 100 || o.source.enemyMind !== 100 || o.enemySpiritualityBefore !== 120 || o.source.supplies.paperSpent !== 0) return false;
      const moves = [...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))].sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
      if (stableStringify(moves) !== stableStringify(round.moves) || o.playerActions.length > round.playerCount || o.enemyActions.length > round.enemyCount) return false;
      previous = o;
    }
    if (previous && (e.enemyHealth !== previous.enemyHealth || e.enemyMind !== previous.enemyMind || e.enemySpirituality !== previous.enemySpirituality || stableStringify(e.powerUses) !== stableStringify(previous.powerUses) || p.paperSheets !== previous.suppliesAfter.paperSheets || p.paperSpent !== previous.suppliesAfter.paperSpent)) return false;
    if (e.status === 'FIGHTING') return e.terminal === null && hasAncientScholarDisputeOpponent(s) && (!previous || previous.continuing);
    const t = e.terminal, last = rounds.at(-1);
    return !!t && !!previous && !!last && !previous.continuing && t.round === last.round && t.historyIndex === end - 1 && t.enemyHealth === e.enemyHealth && t.enemyMind === e.enemyMind && t.enemySpirituality === e.enemySpirituality && t.enemyStatus === e.enemyStatus && s.combat?.encounterId !== 'ANCIENT_SCHOLAR_DISPUTE' && p.lanternPreparedWeek === null &&
      (t.outcome === 'PLAYER_DEAD' ? e.status === 'LOST' && s.health === 0 && last.winner === 'ENEMY' : t.outcome === 'RETREATED' ? e.status === 'RETREATED' && last.retreat === 'SUCCESS' : t.outcome === 'ENEMY_DEAD' ? e.status === 'RESOLVED' && e.enemyStatus === 'DEAD' && last.winner === 'PLAYER' : e.status === 'RESOLVED' && e.enemyStatus === 'SURRENDERED' && last.winner === 'PLAYER');
  } catch { return false; }
}
