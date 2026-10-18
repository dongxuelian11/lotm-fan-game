import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { hasManipulatorOpenPractice } from '../manipulator/encounter.js';
import { hasDreamWeaverLifeLock } from './life.js';
import { validateDreamWeaverRoundOutcome, type DreamWeaverRoundOutcome } from './combat.js';

export const DREAM_WEAVER_TARGET_ID = 'DWV3-OSMOND' as const;
export const DREAM_WEAVER_POWER_IDS = ['ARC_BOLT', 'WARD', 'COMPOSE'] as const;
export type DreamWeaverPowerId = typeof DREAM_WEAVER_POWER_IDS[number];
export type DreamWeaverEnemyIntent = DreamWeaverPowerId | 'BODY_STRIKE' | 'OBSERVE' | 'ACCIDENT';
export const DREAM_WEAVER_POWERS = [
  { id: 'ARC_BOLT', label: '有限弧光术', cost: 5, selfGain: 75, enemyReduction: 0 },
  { id: 'WARD', label: '有限护术', cost: 4, selfGain: 0, enemyReduction: 45 },
  { id: 'COMPOSE', label: '辨认梦像的精神抵抗', cost: 3, selfGain: 0, enemyReduction: 0 },
] as const;
export interface DreamWeaverEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface DreamWeaverEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof DREAM_WEAVER_TARGET_ID;
  approachWeek: number | null; attemptWeek: number | null; startHistoryIndex: number | null;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  weaponLocation: 'HAND' | 'YARD'; enemyInjuries: SliceInjury[]; enemyRisk: number; powerUses: Record<DreamWeaverPowerId, number>;
  mentalPlague: number; plagueApplications: number; infectedRound: number | null; lastPlagueRound: number | null;
  personaGuards: number; identityUses: number; wovenImageUses: number; totalOwnerMindSpent: number;
  helpHistory: { week: number; before: number; after: number; fee: 40 }[]; terminal: DreamWeaverEncounterTerminal | null;
}
export type DreamWeaverEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' | 'AID_ENEMY' };
export interface DreamWeaverEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: DreamWeaverEncounterCommand }
export interface DreamWeaverEncounterProjection {
  title: string; story: string; status: DreamWeaverEncounterState['status']; inside: boolean;
  enemy: null | { id: typeof DREAM_WEAVER_TARGET_ID; name: '奥斯蒙德'; age: 45; sequence: 3; health: number; mind: number; spirituality: number;
    status: DreamWeaverEncounterState['enemyStatus']; weaponId: 'DWV3-OSMOND-CLUB'; weaponLocation: 'HAND' | 'YARD'; powerUses: Record<DreamWeaverPowerId, number> };
  mentalPlague: number; helpHistory: DreamWeaverEncounterState['helpHistory']; actions: DreamWeaverEncounterAction[]; facts: string[];
}
export const DREAM_WEAVER_ENCOUNTER_STORY = '原创成年非凡者奥斯蒙德（45岁，DWV3-OSMOND，有限G3等效对手）因另一处独立净空石院的通行争议持自己的唯一原棍DWV3-OSMOND-CLUB挡路。他不是旧鲁兰。双方原身体相距2米、清晰可见，普通出口开放，无追逐、无旁人。先实际交谈，再选择迎战或和平离开。原奥斯蒙德有独立H100/M100/S120，弧光术5S/贡献75、护术4S/减势45、精神整理3S/本轮一次梦像抵抗30%提高到70%（均原创有限G，不冒充已核原著途径3）。资源不足回退原棍20×身体；不会自动补S。外部身份只能有限牵制，梦像须对方信以为真才产生有限精神后果，识破与抵抗均有效。精神归零停止抵抗、不是物理死亡；真实伤势、死亡和瘟疫仍保留。';
export function createDreamWeaverEncounterState(): DreamWeaverEncounterState {
  return { status: 'AVAILABLE', targetId: DREAM_WEAVER_TARGET_ID, approachWeek: null, attemptWeek: null, startHistoryIndex: null,
    enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING', weaponLocation: 'HAND', enemyInjuries: [], enemyRisk: 0,
    powerUses: { ARC_BOLT: 0, WARD: 0, COMPOSE: 0 }, mentalPlague: 0, plagueApplications: 0, infectedRound: null, lastPlagueRound: null,
    personaGuards: 0, identityUses: 0, wovenImageUses: 0, totalOwnerMindSpent: 0, helpHistory: [], terminal: null };
}
const stage = (s: SliceState) => s.progression.pathwayId === 'audience' && s.progression.sequence === 3;
export function validateDreamWeaverEncounterCommand(v: unknown): v is DreamWeaverEncounterCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 &&
    ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER', 'AID_ENEMY'].includes(String((v as { type?: unknown }).type));
}
export function isInsideDreamWeaverEncounter(s: SliceState): boolean { return ['READY', 'FIGHTING'].includes(s.dreamWeaver.encounter.status); }
export const hasDreamWeaverEncounterLock = isInsideDreamWeaverEncounter;
function otherSceneOpen(s: SliceState): boolean {
  return s.dreamWeaver.preparedWeek !== null || hasDreamWeaverLifeLock(s) || hasManipulatorOpenPractice(s) ||
    ['READY', 'FIGHTING'].includes(s.manipulator.encounter.status);
}
export function blockDreamWeaverEncounter(s: SliceState, c: DreamWeaverEncounterCommand): string | null {
  if (!validateDreamWeaverEncounterCommand(c)) return '织梦人遭遇命令无效。';
  const e = s.dreamWeaver.encounter;
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0 || !stage(s)) return '须本人仍活着且有精神，并已成为织梦人3。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德本场独立净空石院。';
  if (otherSceneOpen(s)) return '先实际收束生活实践、外部身份、原物或晋升准备。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' ? null : '须已到场交谈且尚未开战。';
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'AID_ENEMY') return !['RESOLVED', 'RETREATED'].includes(e.status) || e.enemyHealth <= 0 || e.enemyStatus === 'DEAD' || e.mentalPlague < 1
    ? '须是生还且保有实际精神瘟疫的同一原奥斯蒙德。' : e.helpHistory.at(-1)?.week === s.week
      ? '本真实周已接受一次自愿专业稳定，须下一周。' : s.cash < 40 ? '本次专业稳定需40便士。' : null;
  if (c.type === 'ENCOUNTER_TALK') return e.status !== 'AVAILABLE' ? '同一原人已交谈或收束，不重开、不复位。' : s.actionsRemaining < 2 ? '交谈1行动，另留1行动供明确开战；仍可和平离开。' : null;
  return e.status === 'READY' ? null : '先实际交谈，确认同一原人、自己的原棍与普通出口。';
}
export const dreamWeaverEncounterReason = blockDreamWeaverEncounter;
export function applyDreamWeaverEncounterCommand(s: SliceState, c: DreamWeaverEncounterCommand, ctx: SeerContext): void {
  const reason = blockDreamWeaverEncounter(s, c); if (reason) throw new Error(reason);
  const e = s.dreamWeaver.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') { e.status = 'RESOLVED'; ctx.note('沿新石院原出口和平离开', '接受奥斯蒙德仍不让路，沿开放普通出口离开；没有施法、追逐、奖励或原人复位。旧鲁兰与旧原棍结局不变。'); return; }
  s.actionsRemaining--;
  if (c.type === 'AID_ENEMY') {
    s.cash -= 40; const before = e.mentalPlague; e.mentalPlague--; e.helpHistory.push({ week: s.week, before, after: e.mentalPlague, fee: 40 });
    ctx.note('同一原奥斯蒙德自愿接受实际专业稳定', `本人另花1行动与40便士，生还的原奥斯蒙德本次明确同意专业人员稳定，病势${before}→${e.mentalPlague}（G）。健康${e.enemyHealth}、精神${e.enemyMind}与实耗灵性不恢复，没有复活、撤销战斗或改动旧鲁兰。`); return;
  }
  if (c.type === 'ENCOUNTER_TALK') { e.status = 'READY'; e.approachWeek = s.week; ctx.note('与原奥斯蒙德实际交谈', `${DREAM_WEAVER_ENCOUNTER_STORY}本次仅交谈，尚未代选开战。`); return; }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'DREAM_WEAVER_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('承担独立原石院的真实冲突', '双方以同一原身体、自有原棍和各自实际灵性交战。只有双方原次数盘，没有外部身份的第二轮盘、复制装备或旁人；普通出口仍开放。');
}
export const applyDreamWeaverEncounter = applyDreamWeaverEncounterCommand;
export function hasDreamWeaverDisputeOpponent(s: SliceState): boolean {
  const e = s.dreamWeaver?.encounter, c = s.combat;
  return stage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && !otherSceneOpen(s) &&
    !!e && e.status === 'FIGHTING' && e.targetId === DREAM_WEAVER_TARGET_ID && e.terminal === null && e.enemyStatus === 'RESISTING' && e.weaponLocation === 'HAND' &&
    e.approachWeek !== null && e.attemptWeek === s.week && c?.encounterId === 'DREAM_WEAVER_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 &&
    e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind && stableStringify(e.enemyInjuries) === stableStringify(c.enemyInjuries) && e.enemyRisk === c.enemyRisk &&
    Number.isSafeInteger(e.enemySpirituality) && e.enemySpirituality >= 0 && e.enemySpirituality === 120 - DREAM_WEAVER_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) &&
    Number.isSafeInteger(c.round) && c.round >= 1 && e.startHistoryIndex !== null && s.combatHistory.length - e.startHistoryIndex === c.round - 1;
}
export function settleDreamWeaverEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.dreamWeaver.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'DREAM_WEAVER_DISPUTE') throw new Error('没有同一原奥斯蒙德的真实战斗。');
  if (outcome === 'CONTINUE') return;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知原石院战斗结果。');
  const last = c.lastRound, o = last?.dreamWeaverOutcome;
  if (e.terminal || e.startHistoryIndex === null || !last || !validateDreamWeaverRoundOutcome(o) || o.continuing || c.round !== last.round + 1 ||
      s.combatHistory.length - e.startHistoryIndex !== last.round || stableStringify(s.combatHistory.at(-1)) !== stableStringify(last) ||
      o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || o.enemySpirituality !== e.enemySpirituality ||
      outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS') ||
      outcome === 'RETREATED' && (s.health <= 0 || last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY') ||
      outcome === 'ENEMY_DEAD' && (c.enemyHealth !== 0 || c.enemyStatus !== 'DEAD' || last.winner !== 'PLAYER') ||
      outcome === 'ENEMY_SURRENDERED' && (c.enemyHealth <= 0 || c.enemyStatus !== 'SURRENDERED' || last.winner !== 'PLAYER')) throw new Error('原人、真实回合与资源结果不一致。');
  e.terminal = { outcome: outcome as DreamWeaverEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('独立原石院冲突实际结束', `${outcome === 'PLAYER_DEAD' ? '本人真实死亡，外部身份不能替死或复活。' : outcome === 'ENEMY_DEAD' ? '同一原奥斯蒙德真实死亡，尸体与原棍留在本场原院。' : outcome === 'RETREATED' ? '本人沿原开放出口实际离开，没有追逐、瞬移或夺棍。' : '同一原奥斯蒙德仍活着，因真实精神耗竭或伤势自行停止抵抗并放下自己的原棍，不是永久受控者。'}本动作外部身份与梦像均已结束；本人实付精神和灵性不退，对方病势${e.mentalPlague}保留，生还者可另行自愿付费稳定。旧鲁兰结局完全不变。`);
}
export function dreamWeaverEncounterActions(s: SliceState): DreamWeaverEncounterAction[] {
  if (!stage(s)) return [];
  return ([['ENCOUNTER_TALK', '前往独立石院实际交谈', '1行动，另留开战1行动'], ['ENCOUNTER_FIGHT', '明确承担同一原人的真实冲突', '1行动 · 正常伤势/死亡风险'],
    ['LEAVE_ENCOUNTER', '沿原普通出口和平离开', '0行动'], ['AID_ENEMY', '奥斯蒙德自愿接受专业稳定', '1行动 · 40便士 · 每真实周1次']] as const).map(([type, label, cost]) => {
    const command: DreamWeaverEncounterCommand = { type }, reason = blockDreamWeaverEncounter(s, command);
    return { id: `DWV3-ENCOUNTER:${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectDreamWeaverEncounter(s: SliceState): DreamWeaverEncounterProjection {
  const e = s.dreamWeaver.encounter;
  if (!stage(s) && !(s.progression.pathwayId==='audience'&&(s.progression.sequence===2||s.progression.sequence===1))) return { title: '尚未开放的织梦人实践', story: '', status: 'AVAILABLE', inside: false, enemy: null, mentalPlague: 0, helpHistory: [], actions: [], facts: [] };
  return { title: '奥斯蒙德的独立原石院', story: DREAM_WEAVER_ENCOUNTER_STORY, status: e.status, inside: isInsideDreamWeaverEncounter(s),
    enemy: { id: e.targetId, name: '奥斯蒙德', age: 45, sequence: 3, health: e.enemyHealth, mind: e.enemyMind, spirituality: e.enemySpirituality,
      status: e.enemyStatus, weaponId: 'DWV3-OSMOND-CLUB', weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses } },
    mentalPlague: e.mentalPlague, helpHistory: e.helpHistory.map(h => ({ ...h })), actions: dreamWeaverEncounterActions(s),
    facts: ['双方1–6次权重15/20/25/20/15/5；本人核心体30/感25/意30/知15，1250/底125、上限120，仅继续轮恢复12（均G）。',
      '一具外部身份5S+2M、意志16、至多60秒/6米；有限牵制26，动作后归并，不有第二份SP、装备或次数。',
      '近真梦像6S、意志18，须施术成功且目标未识破/抵抗、实际信以为真才−6M与有限优势38×掌握；不实体召神。',
      '奥斯蒙德整理精神实际3S，本轮下一次梦像抵抗30%→70%；识破和失败不退本人已付成本，抵抗不会清除已有瘟疫。',
      '精神0为生还停战投降，不把精神伤当死亡；离场保留病勢，每真实周可另付1行动40便士自愿稳定1级而不恢复精神。旧鲁兰、病史、原棍全保留。'] };
}
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
export function validateDreamWeaverEncounter(s: SliceState): boolean {
  try {
    const e = s.dreamWeaver.encounter;
    if (!e || !same(Object.keys(e).sort(), Object.keys(createDreamWeaverEncounterState()).sort()) || e.targetId !== DREAM_WEAVER_TARGET_ID ||
        !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 0, 100) || !integer(e.enemySpirituality, 0, 120) || !integer(e.enemyRisk) ||
        !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) || e.enemyMind === 0 && e.enemyStatus === 'RESISTING' ||
        !['HAND', 'YARD'].includes(e.weaponLocation) || (e.enemyStatus !== 'RESISTING') !== (e.weaponLocation === 'YARD') ||
        !Array.isArray(e.enemyInjuries) || e.enemyInjuries.some(i => !i || typeof i.id !== 'string' || !['LIGHT', 'HEAVY'].includes(i.severity) || !integer(i.acquiredRevision) || i.treatedRevision !== null && !integer(i.treatedRevision, i.acquiredRevision)) ||
        !e.powerUses || Object.keys(e.powerUses).length !== 3 || DREAM_WEAVER_POWER_IDS.some(id => !integer(e.powerUses[id])) || e.enemySpirituality !== 120 - DREAM_WEAVER_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) ||
        !integer(e.mentalPlague, 0, 3) || !integer(e.plagueApplications, 0, 1) || ![e.personaGuards, e.identityUses, e.wovenImageUses].every(n => integer(n)) || e.totalOwnerMindSpent !== e.personaGuards + 2 * e.identityUses ||
        !Array.isArray(e.helpHistory) || [e.approachWeek, e.attemptWeek].some(n => n !== null && !integer(n, s.dreamWeaver.promotionWeek ?? 0, s.week)) || e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length)) return false;
    if (e.plagueApplications === 0 ? e.mentalPlague !== 0 || e.infectedRound !== null || e.lastPlagueRound !== null || e.helpHistory.length > 0 : !integer(e.infectedRound, 1) || !integer(e.lastPlagueRound, e.infectedRound)) return false;
    if (e.helpHistory.some((h, i) => !h || !same(Object.keys(h).sort(), ['after', 'before', 'fee', 'week']) || !integer(h.week, e.attemptWeek ?? 0, s.week) || i > 0 && h.week <= e.helpHistory[i - 1]!.week || !integer(h.before, 1, 3) || h.after !== h.before - 1 || h.fee !== 40 || i > 0 && h.before !== e.helpHistory[i - 1]!.after) ||
        e.helpHistory.length > 0 && (e.enemyStatus === 'DEAD' || !['RESOLVED', 'RETREATED'].includes(e.status) || e.helpHistory.at(-1)!.after !== e.mentalPlague)) return false;
    if (s.dreamWeaver.promotionWeek === null) return same(e, createDreamWeaverEncounterState()) && s.combat?.encounterId !== 'DREAM_WEAVER_DISPUTE';
    if (!stage(s) && !(s.progression.pathwayId==='audience'&&(s.progression.sequence===2||s.progression.sequence===1))) return false;
    if (e.startHistoryIndex === null) {
      const initial = createDreamWeaverEncounterState();
      return ['AVAILABLE', 'READY', 'RESOLVED'].includes(e.status) && e.terminal === null && e.attemptWeek === null && s.combat?.encounterId !== 'DREAM_WEAVER_DISPUTE' &&
        (e.status === 'AVAILABLE' ? e.approachWeek === null : e.approachWeek !== null) && same({ ...e, status: initial.status, approachWeek: null }, initial);
    }
    if (e.approachWeek === null || e.attemptWeek === null || e.attemptWeek < e.approachWeek) return false;
    const end = e.terminal ? e.terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
    let previous: DreamWeaverRoundOutcome | undefined;
    for (const [i, round] of rounds.entries()) {
      const o = round.dreamWeaverOutcome;
      if (!validateDreamWeaverRoundOutcome(o) || round.round !== i + 1 || o.round !== round.round || o.stance !== round.stance || round.winner === null || o.source.runId !== s.runId || o.source.week !== e.attemptWeek || o.source.startHistoryIndex !== e.startHistoryIndex ||
          i < rounds.length - 1 && (!o.continuing || round.retreat === 'SUCCESS')) return false;
      if (previous ? o.source.enemyHealth !== previous.enemyHealth || o.source.enemyMind !== previous.enemyMind || o.source.playerHealth !== previous.playerHealthAfter || o.source.playerMind !== previous.playerMindAfter ||
          o.playerSpiritualityBefore !== Math.min(120, previous.playerSpiritualityAfter + 12) || o.enemySpiritualityBefore !== previous.enemySpirituality || !same(o.source.powerUses, previous.powerUses) ||
          o.source.mentalPlague !== previous.enemyMentalPlague || o.source.plagueApplications !== previous.plagueApplications || o.source.personaGuards !== previous.personaGuards || o.source.identityUses !== previous.identityUses || o.source.wovenImageUses !== previous.wovenImageUses ||
          o.source.infectedRound !== previous.infectedRound || o.source.lastPlagueRound !== previous.lastPlagueRound
        : o.source.enemyHealth !== 100 || o.source.enemyMind !== 100 || o.enemySpiritualityBefore !== 120 || Object.values(o.source.powerUses).some(n => n !== 0) || o.source.plagueApplications !== 0 || o.source.personaGuards !== 0 || o.source.identityUses !== 0 || o.source.wovenImageUses !== 0) return false;
      const moves = [...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))].sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
      if (!same(moves, round.moves) || o.playerActions.length > round.playerCount || o.enemyActions.length > round.enemyCount) return false;
      previous = o;
    }
    if (previous && (previous.enemyHealth !== e.enemyHealth || previous.enemyMind !== e.enemyMind || previous.enemySpirituality !== e.enemySpirituality || previous.enemyStatus !== e.enemyStatus || !same(previous.powerUses, e.powerUses) ||
        previous.enemyMentalPlague !== e.mentalPlague + e.helpHistory.length || previous.plagueApplications !== e.plagueApplications || previous.personaGuards !== e.personaGuards || previous.identityUses !== e.identityUses || previous.wovenImageUses !== e.wovenImageUses ||
        previous.infectedRound !== e.infectedRound || previous.lastPlagueRound !== e.lastPlagueRound || e.helpHistory.length > 0 && e.helpHistory[0]!.before !== previous.enemyMentalPlague)) return false;
    if (e.status === 'FIGHTING') return e.terminal === null && e.helpHistory.length === 0 && hasDreamWeaverDisputeOpponent(s) && (!previous || previous.continuing);
    const t = e.terminal, last = rounds.at(-1);
    return !!t && !!previous && !!last && !previous.continuing && t.round === last.round && t.historyIndex === end - 1 && t.enemyHealth === e.enemyHealth && t.enemyMind === e.enemyMind && t.enemySpirituality === e.enemySpirituality && t.enemyStatus === e.enemyStatus && s.combat?.encounterId !== 'DREAM_WEAVER_DISPUTE' &&
      (t.outcome === 'PLAYER_DEAD' ? e.status === 'LOST' && s.health === 0 && last.winner === 'ENEMY' : t.outcome === 'RETREATED' ? e.status === 'RETREATED' && last.retreat === 'SUCCESS' : t.outcome === 'ENEMY_DEAD' ? e.status === 'RESOLVED' && e.enemyStatus === 'DEAD' && last.winner === 'PLAYER' : t.outcome === 'ENEMY_SURRENDERED' && e.status === 'RESOLVED' && e.enemyStatus === 'SURRENDERED' && last.winner === 'PLAYER');
  } catch { return false; }
}
