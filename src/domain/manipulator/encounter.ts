import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { manipulatorInside } from './life.js';
import { hasManipulatorRitualLock } from './ritual.js';

export const MANIPULATOR_ENCOUNTER_STORY = '原创成年仓库看守鲁兰（40岁，MP4-RULAN）因原仓库通行争议持自己的唯一普通短棍MP4-RULAN-CLUB挡路。双方原身体在2米外清楚可见，原地面与普通出口净空，没有同伴、旁人或追逐。先真实交谈，再明确选择迎战或和平离开。他仍有自己的心灵与抵抗，并非半神；心灵能力可失败，不保证控制。精神瘟疫为超自然虚构，已形成病况在离场后仍保留，没有友军自动免疫保证。生还者可另行自愿接受实际专业稳定，每一真实周最多降低1强度，不立刻恢复精神。场景、成本与数值为原创G。';
export type ManipulatorEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' | 'AID_ENEMY' };
export interface ManipulatorEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
  approachWeek: number | null; attemptWeek: number | null; startHistoryIndex: number | null;
  enemy: { id: 'MP4-RULAN'; name: '鲁兰'; age: 40; source: 'ORIGINAL_WAREHOUSE_WATCHER'; health: number; mind: number; status: 'RESISTING' | 'SURRENDERED' | 'DEAD'; weaponId: 'MP4-RULAN-CLUB'; weaponLocation: 'HAND' | 'YARD' };
  mentalPlague: number; plagueApplications: number; infectedRound: number | null; lastPlagueRound: number | null;
  personaGuards: number; totalOwnerMindSpent: number;
  helpHistory: { week: number; before: number; after: number; fee: 40 }[];
}
export interface ManipulatorEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ManipulatorEncounterCommand }
export interface ManipulatorEncounterProjection { title: string; story: string; status: string; enemy: ManipulatorEncounterState['enemy']; inside: boolean; mentalPlague: number; helpHistory: ManipulatorEncounterState['helpHistory']; actions: ManipulatorEncounterAction[] }
export function createManipulatorEncounterState(): ManipulatorEncounterState { return { status: 'AVAILABLE', approachWeek: null, attemptWeek: null, startHistoryIndex: null, enemy: { id: 'MP4-RULAN', name: '鲁兰', age: 40, source: 'ORIGINAL_WAREHOUSE_WATCHER', health: 100, mind: 100, status: 'RESISTING', weaponId: 'MP4-RULAN-CLUB', weaponLocation: 'HAND' }, mentalPlague: 0, plagueApplications: 0, infectedRound: null, lastPlagueRound: null, personaGuards: 0, totalOwnerMindSpent: 0, helpHistory: [] }; }
export function validateManipulatorEncounterCommand(v: unknown): v is ManipulatorEncounterCommand { return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER', 'AID_ENEMY'].includes((v as { type: string }).type); }
export function isInsideManipulatorEncounter(s: SliceState): boolean { return ['READY', 'FIGHTING'].includes(s.manipulator.encounter.status); }
export function hasManipulatorOpenPractice(s: SliceState): boolean { return manipulatorInside(s) || hasManipulatorRitualLock(s) || Object.values(s.manipulator.life.cases).some(c => c.status === 'PREPARED') || Object.values(s.dreamwalker.cases).some(c => c.contactOpen || c.status === 'PREPARED'); }
export function blockManipulatorEncounter(s: SliceState, c: ManipulatorEncounterCommand): string | null {
  const e = s.manipulator.encounter;
  if (!validateManipulatorEncounterCommand(c)) return '原仓库遭遇命令无效。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.progression.pathwayId !== 'audience' || s.progression.sequence !== 4) return '先成为操纵师。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须在贝克兰德原仓库净空外院。';
  if (hasManipulatorOpenPractice(s)) return '先实际收束生活实践、原物与集会。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' ? null : '须已实际到场交谈且尚未开战。';
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'AID_ENEMY') return !['RESOLVED', 'RETREATED'].includes(e.status) || e.enemy.health <= 0 || e.enemy.status === 'DEAD' || e.mentalPlague < 1 ? '须是仍生还且有实际精神瘟疫的同一原鲁兰。' : e.helpHistory.at(-1)?.week === s.week ? '本真实周已接受一次专业稳定，下周再来。' : s.cash < 40 ? '本次实际专业稳定需要40便士。' : null;
  if (c.type === 'ENCOUNTER_TALK') return e.status !== 'AVAILABLE' ? '同一原争议已经交谈或收束，不重新生成敌人。' : s.actionsRemaining < 2 ? '交谈花费1行动，另留1行动给明确开战选择。' : null;
  return e.status === 'READY' ? null : '先实际交谈并确认原人、自己的原棍与普通出口。';
}
export function applyManipulatorEncounterCommand(s: SliceState, c: ManipulatorEncounterCommand, ctx: SeerContext): void {
  const reason = blockManipulatorEncounter(s, c); if (reason) throw new Error(reason);
  const e = s.manipulator.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') { e.status = 'RESOLVED'; ctx.note('沿原普通出口和平离开', '你接受鲁兰仍不让路，沿已确认原出口离开。同一原人和自己的原棍留在仓库；没有交战、施病、控制或奖励。'); return; }
  s.actionsRemaining--;
  if (c.type === 'AID_ENEMY') { s.cash -= 40; const before = e.mentalPlague; e.mentalPlague--; e.helpHistory.push({ week: s.week, before, after: e.mentalPlague, fee: 40 }); ctx.note('原鲁兰自愿接受一次实际专业稳定', `同一生还的鲁兰明确同意，原指导室专业人员本次到场稳定，已花1行动与40便士。强度${before}→${e.mentalPlague}（G），原精神${e.enemy.mind}与健康${e.enemy.health}不瞬间恢复；下次须下一真实周，没有复活或撤销原战斗。`); return; }
  if (c.type === 'ENCOUNTER_TALK') { e.status = 'READY'; e.approachWeek = s.week; ctx.note('与原鲁兰实际交谈', MANIPULATOR_ENCOUNTER_STORY + '本次只交谈，尚未替你选择开战。'); return; }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'MANIPULATOR_DISPUTE', round: 1, enemyHealth: e.enemy.health, enemyMind: e.enemy.mind, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('承担原仓库真实冲突', '玩家与同一原鲁兰以自己的原身体交战；敌方独立普通行动，原健康、精神、病况与死亡按实际结算，不克隆旁人或生成武器。');
}
export function hasManipulatorDisputeOpponent(s: SliceState): boolean {
  const e = s.manipulator?.encounter, c = s.combat;
  return s.progression.pathwayId === 'audience' && s.progression.sequence === 4 && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && !hasManipulatorOpenPractice(s) && !!e && e.status === 'FIGHTING' && e.enemy.id === 'MP4-RULAN' && e.enemy.source === 'ORIGINAL_WAREHOUSE_WATCHER' && e.enemy.status === 'RESISTING' && e.enemy.weaponId === 'MP4-RULAN-CLUB' && e.enemy.weaponLocation === 'HAND' && !!c && c.encounterId === 'MANIPULATOR_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 && e.enemy.health === c.enemyHealth && e.enemy.mind === c.enemyMind && e.attemptWeek === s.week && Number.isSafeInteger(c.round) && c.round >= 1 && e.startHistoryIndex !== null && Number.isSafeInteger(e.startHistoryIndex) && e.startHistoryIndex >= 0 && s.combatHistory.length - e.startHistoryIndex === c.round - 1 && s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.retreat !== 'SUCCESS' && r.manipulatorOutcome?.enemyId === 'MP4-RULAN');
}
export function settleManipulatorEncounter(s: SliceState, outcome: string, ctx: SeerContext): void {
  const e = s.manipulator.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || !c || c.encounterId !== 'MANIPULATOR_DISPUTE' || !['CONTINUE', 'PLAYER_DEAD', 'ENEMY_DEAD', 'ENEMY_SURRENDERED', 'RETREATED'].includes(outcome)) throw new Error('没有对应的原鲁兰战斗结果。');
  if (outcome === 'CONTINUE') return;
  const last = s.combatHistory.at(-1)?.manipulatorOutcome;
  if (e.startHistoryIndex === null || !c.lastRound || s.combatHistory.length - e.startHistoryIndex !== c.lastRound.round || last?.enemyId !== 'MP4-RULAN' || last.enemyHealth !== c.enemyHealth || last.enemyMind !== c.enemyMind || last.enemyMentalPlague !== e.mentalPlague || (outcome === 'PLAYER_DEAD' && s.health !== 0) || (outcome === 'RETREATED' && c.lastRound.retreat !== 'SUCCESS') || (outcome === 'ENEMY_DEAD' && (c.enemyHealth !== 0 || c.enemyStatus !== 'DEAD')) || (outcome === 'ENEMY_SURRENDERED' && (c.enemyHealth <= 0 || c.enemyStatus !== 'SURRENDERED'))) throw new Error('原鲁兰身体、精神与病况不符合当前结果。');
  e.enemy.health = c.enemyHealth; e.enemy.mind = c.enemyMind; e.enemy.status = c.enemyStatus;
  if (c.enemyStatus !== 'RESISTING') e.enemy.weaponLocation = 'YARD';
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('同一原仓库冲突收束', `${outcome === 'PLAYER_DEAD' ? '玩家真实死亡，没有人格替死。' : outcome === 'ENEMY_DEAD' ? '原鲁兰真实死亡，尸体与自己的原棍留在原地。' : outcome === 'RETREATED' ? '玩家沿原普通出口实际退出，同一鲁兰仍留原仓库。' : '鲁兰仍活着，自行停止抵抗并放下原棍，不是被永久控制。'}原健康、精神与实际精神瘟疫强度${e.mentalPlague}保留，离场没有治愈；生还者可明确选择另付时间与费用取得自愿专业稳定。`);
}
export function manipulatorEncounterActions(s: SliceState): ManipulatorEncounterAction[] { return ([['ENCOUNTER_TALK', '到原仓库实际交谈', '1行动，另留开战1行动'], ['ENCOUNTER_FIGHT', '明确承担真实冲突', '1行动'], ['LEAVE_ENCOUNTER', '沿原出口和平离开', '0行动'], ['AID_ENEMY', '原鲁兰自愿接受专业稳定', '1行动＋40便士 · 每真实周1次']] as const).map(([type, label, cost]) => { const command = { type }, reason = blockManipulatorEncounter(s, command); return { id: `manipulator-${type}`, label, cost, enabled: reason === null, reason, command }; }); }
export function projectManipulatorEncounter(s: SliceState): ManipulatorEncounterProjection { const e = s.manipulator.encounter; return { title: '原鲁兰的可选仓库冲突', story: MANIPULATOR_ENCOUNTER_STORY, status: e.status, enemy: { ...e.enemy }, inside: isInsideManipulatorEncounter(s), mentalPlague: e.mentalPlague, helpHistory: e.helpHistory.map(h => ({ ...h })), actions: manipulatorEncounterActions(s) }; }
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
export function validateManipulatorEncounter(s: SliceState): boolean {
  const e = s.manipulator.encounter; if (!e || !e.enemy) return false;
  const shape = (v: object, keys: string[]) => Object.keys(v).sort().join('|') === keys.sort().join('|');
  if (!shape(e, Object.keys(createManipulatorEncounterState())) || !shape(e.enemy, Object.keys(createManipulatorEncounterState().enemy))) return false;
  const enemy = e.enemy, promotion = s.manipulator.promotionWeek;
  if (!['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || enemy.id !== 'MP4-RULAN' || enemy.name !== '鲁兰' || enemy.age !== 40 || enemy.source !== 'ORIGINAL_WAREHOUSE_WATCHER' || enemy.weaponId !== 'MP4-RULAN-CLUB' || !['HAND', 'YARD'].includes(enemy.weaponLocation) || !integer(enemy.health, 0, 100) || !integer(enemy.mind, 0, 100) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(enemy.status) || (enemy.status === 'DEAD') !== (enemy.health === 0) || !integer(e.mentalPlague, 0, 3) || !integer(e.plagueApplications, 0, 1) || !integer(e.personaGuards) || e.totalOwnerMindSpent !== e.personaGuards || !Array.isArray(e.helpHistory) || [e.approachWeek, e.attemptWeek].some(w => w !== null && !integer(w, promotion ?? 0, s.week))) return false;
  if (e.status !== 'AVAILABLE' && (promotion === null || e.approachWeek === null || s.progression.pathwayId !== 'audience' || ![4,3,2].includes(s.progression.sequence??0))) return false;
  if (e.plagueApplications === 0 ? e.mentalPlague !== 0 || e.infectedRound !== null || e.lastPlagueRound !== null || e.helpHistory.length > 0 : !integer(e.infectedRound, 1) || !integer(e.lastPlagueRound, e.infectedRound)) return false;
  if (e.helpHistory.some((h, i) => !h || !shape(h, ['week', 'before', 'after', 'fee']) || !integer(h.week, e.attemptWeek ?? 0, s.week) || i > 0 && h.week <= e.helpHistory[i - 1]!.week || !integer(h.before, 1, 3) || h.after !== h.before - 1 || h.fee !== 40 || i > 0 && h.before !== e.helpHistory[i - 1]!.after) || e.helpHistory.length > 0 && (enemy.status === 'DEAD' || !['RESOLVED', 'RETREATED'].includes(e.status) || e.helpHistory.at(-1)!.after !== e.mentalPlague)) return false;
  if (e.status === 'FIGHTING') {
    if (!hasManipulatorDisputeOpponent(s) || e.helpHistory.length > 0 || e.lastPlagueRound !== null && e.lastPlagueRound >= s.combat!.round) return false;
    const last = s.combatHistory.at(-1)?.manipulatorOutcome;
    return s.combat!.round === 1 ? e.plagueApplications === 0 && e.personaGuards === 0 && enemy.health === 100 && enemy.mind === 100 : !!last && last.enemyHealth === enemy.health && last.enemyMind === enemy.mind && last.enemyStatus === enemy.status && last.enemyMentalPlague === e.mentalPlague && last.plagueApplications === e.plagueApplications && last.personaGuards === e.personaGuards;
  }
  if (s.combat?.encounterId === 'MANIPULATOR_DISPUTE') return false;
  if (e.status === 'AVAILABLE') return e.approachWeek === null && e.attemptWeek === null && e.startHistoryIndex === null && enemy.health === 100 && enemy.mind === 100 && enemy.status === 'RESISTING' && enemy.weaponLocation === 'HAND' && e.plagueApplications === 0 && e.personaGuards === 0;
  if (e.status === 'READY' || e.startHistoryIndex === null) return (e.status === 'READY' || e.status === 'RESOLVED') && e.approachWeek !== null && e.attemptWeek === null && enemy.health === 100 && enemy.mind === 100 && enemy.status === 'RESISTING' && enemy.weaponLocation === 'HAND' && e.plagueApplications === 0 && e.personaGuards === 0;
  if (!integer(e.startHistoryIndex, 0, s.combatHistory.length - 1) || e.attemptWeek === null) return false;
  const rounds = s.combatHistory.slice(e.startHistoryIndex), next = rounds.findIndex((r, i) => i > 0 && r.round === 1), own = next < 0 ? rounds : rounds.slice(0, next), last = own.at(-1), o = last?.manipulatorOutcome;
  if (!o || !own.every((r, i) => r.round === i + 1 && r.manipulatorOutcome?.enemyId === 'MP4-RULAN') || o.enemyHealth !== enemy.health || o.enemyMind !== enemy.mind || o.enemyStatus !== enemy.status || o.enemyMentalPlague !== e.mentalPlague + e.helpHistory.length || o.plagueApplications !== e.plagueApplications || o.personaGuards !== e.personaGuards || e.helpHistory.length > 0 && e.helpHistory[0]!.before !== o.enemyMentalPlague || e.lastPlagueRound !== null && e.lastPlagueRound > last!.round) return false;
  return e.status === 'RETREATED' ? last!.retreat === 'SUCCESS' : e.status === 'LOST' ? s.status === 'DEAD' && last!.winner === 'ENEMY' : e.status === 'RESOLVED' && last!.winner === 'PLAYER' && enemy.status !== 'RESISTING';
}
