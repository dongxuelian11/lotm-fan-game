import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { findAlchemistFrame, hasAlchemistLifeLock } from './life.js';

export const ALCHEMIST_ENCOUNTER_STORY = '成年奥斯里克（44岁，AL4-OSRIC）在原工坊空院因通路分歧挡路，手持自己的唯一普通短棍AL4-OSRIC-CLUB。他是普通人，不是假半神。双方可见、相隔2米，原地面和身后普通出口净空；没有随从或追逐。先花1行动实际交谈，再明确选择1行动承担真实战斗，或者0行动和平离开。本人亲手制造且实际携带的同一护架可有限参与，储能和耐久照实消耗；没有自动复制或补充。场景与数值为原创G。';
export type AlchemistEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface AlchemistEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
  approachWeek: number | null; attemptWeek: number | null; startHistoryIndex: number | null;
  enemy: { id: 'AL4-OSRIC'; name: '奥斯里克'; age: 44; source: 'ORIGINAL_WORKSHOP_YARD_ADULT';
    health: number; mind: number; status: 'RESISTING' | 'SURRENDERED' | 'DEAD';
    weaponId: 'AL4-OSRIC-CLUB'; weaponLocation: 'HAND' | 'YARD' };
}
export interface AlchemistEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: AlchemistEncounterCommand }
export interface AlchemistEncounterProjection { title: string; story: string; status: string; enemy: AlchemistEncounterState['enemy']; inside: boolean; actions: AlchemistEncounterAction[] }
export function createAlchemistEncounterState(): AlchemistEncounterState {
  return { status: 'AVAILABLE', approachWeek: null, attemptWeek: null, startHistoryIndex: null,
    enemy: { id: 'AL4-OSRIC', name: '奥斯里克', age: 44, source: 'ORIGINAL_WORKSHOP_YARD_ADULT', health: 100, mind: 100, status: 'RESISTING', weaponId: 'AL4-OSRIC-CLUB', weaponLocation: 'HAND' } };
}
export function validateAlchemistEncounterCommand(v: unknown): v is AlchemistEncounterCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes((v as { type: string }).type);
}
export const isAlchemistEncounterCommand = validateAlchemistEncounterCommand;
export const hasAlchemistEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.alchemist.encounter.status);
export const isInsideAlchemistEncounter = hasAlchemistEncounterLock;
const openPractice = (s: SliceState) => hasAlchemistLifeLock(s) || Object.values(s.alchemist.life.cases).some(r => r.status === 'PREPARED');
export function blockAlchemistEncounter(s: SliceState, c: AlchemistEncounterCommand): string | null {
  if (!validateAlchemistEncounterCommand(c)) return '炼金术士遭遇命令无效。';
  if (s.status !== 'ACTIVE' || s.progression.pathwayId !== 'paragon' || s.progression.sequence !== 4) return '须仍活着并已经成为炼金术士。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际来到贝克兰德原工坊空院。';
  if (openPractice(s) || Object.values(s.astronomer.cases).some(r => r.contactOpen || r.status === 'PREPARED')) return '先收束原工坊实践或旧天文学家准备。';
  const e = s.alchemist.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' ? null : '须先实际到场，才能沿原出口和平离开。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神；已有交谈仍可0行动和平退出。';
  if (s.actionsRemaining < (c.type === 'ENCOUNTER_TALK' ? 2 : 1)) return c.type === 'ENCOUNTER_TALK' ? '交谈需1行动，须另留1行动给明确开战选择。' : '开战需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') return e.status === 'AVAILABLE' ? null : '本段原冲突已有进展或结果，不重新生成奥斯里克。';
  return e.status === 'READY' ? null : '先实际交谈，确认原人、原棍和普通出口。';
}
export function applyAlchemistEncounter(s: SliceState, c: AlchemistEncounterCommand, ctx: SeerContext): void {
  const reason = blockAlchemistEncounter(s, c); if (reason) throw new Error(reason);
  const e = s.alchemist.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') { e.status = 'RESOLVED'; ctx.note('沿原出口和平离开', '你接受奥斯里克仍不让路，沿净空原出口离开；原人和自己的原短棍留在院内，争议结束，不强制战斗或发放战斗奖励。'); return; }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') { e.status = 'READY'; e.approachWeek = s.week; ctx.note('与原奥斯里克实际交谈', ALCHEMIST_ENCOUNTER_STORY + '本次只确认真实分歧，没有替你开战。'); return; }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  const frame = findAlchemistFrame(s);
  if (frame && frame.madeBy === s.runId && frame.owner === 'PLAYER' && frame.custodian === 'PLAYER' && frame.location === 'PLAYER' && frame.durability > 0 && !frame.active) frame.location = 'YARD';
  s.combat = { encounterId: 'ALCHEMIST_DISPUTE', round: 1, enemyHealth: e.enemy.health, enemyMind: e.enemy.mind,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('承担原工坊空院真实冲突', `你和原奥斯里克在原2米通路交战。${frame?.location === 'YARD' ? `携带的同一AL4-FRAME-1已放在本人身前，储能${frame.charge}/3、耐久${frame.durability}/100，没有自动赋灵或充能。` : '没有可用的本人原护架；依靠本人普通动作，造物槽不会凭空提供帮手。'}真实伤势、投降、死亡和撤退继续由共同战盘结算。`);
}
export const applyAlchemistEncounterCommand = applyAlchemistEncounter;
export function hasAlchemistDisputeOpponent(s: SliceState): boolean {
  const e = s.alchemist?.encounter, c = s.combat;
  return s.progression.pathwayId === 'paragon' && s.progression.sequence === 4 && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && !openPractice(s) &&
    !!e && e.status === 'FIGHTING' && e.enemy.id === 'AL4-OSRIC' && e.enemy.source === 'ORIGINAL_WORKSHOP_YARD_ADULT' && e.enemy.status === 'RESISTING' && e.enemy.weaponId === 'AL4-OSRIC-CLUB' && e.enemy.weaponLocation === 'HAND' &&
    !!c && c.encounterId === 'ALCHEMIST_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 && e.enemy.health === c.enemyHealth && e.enemy.mind === c.enemyMind && e.attemptWeek === s.week &&
    Number.isSafeInteger(c.round) && c.round >= 1 && e.startHistoryIndex !== null && Number.isSafeInteger(e.startHistoryIndex) && e.startHistoryIndex >= 0 && s.combatHistory.length - e.startHistoryIndex === c.round - 1 &&
    s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.retreat !== 'SUCCESS');
}
export function settleAlchemistEncounter(s: SliceState, outcome: string, ctx: SeerContext): void {
  const e = s.alchemist.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || !c || c.encounterId !== 'ALCHEMIST_DISPUTE' || !['CONTINUE', 'PLAYER_DEAD', 'ENEMY_DEAD', 'ENEMY_SURRENDERED', 'RETREATED'].includes(outcome)) throw new Error('没有对应的炼金术士原院战斗结果。');
  if (outcome === 'CONTINUE') return;
  if (e.startHistoryIndex === null || !c.lastRound || c.round !== c.lastRound.round + 1 || s.combatHistory.length - e.startHistoryIndex !== c.lastRound.round || s.combatHistory.at(-1)?.alchemistOutcome?.enemyId !== 'AL4-OSRIC' ||
    (outcome === 'PLAYER_DEAD' && (s.health !== 0 || c.lastRound.winner !== 'ENEMY')) || (outcome === 'RETREATED' && (c.lastRound.retreat !== 'SUCCESS' || s.health <= 0)) ||
    (outcome === 'ENEMY_DEAD' && (c.enemyHealth !== 0 || c.enemyStatus !== 'DEAD' || c.lastRound.winner !== 'PLAYER')) || (outcome === 'ENEMY_SURRENDERED' && (c.enemyHealth <= 0 || c.enemyStatus !== 'SURRENDERED' || c.lastRound.winner !== 'PLAYER'))) throw new Error('真实原身体结果与当前已保存回合不符。');
  e.enemy.health = c.enemyHealth; e.enemy.mind = c.enemyMind; e.enemy.status = c.enemyStatus;
  if (c.enemyStatus !== 'RESISTING') e.enemy.weaponLocation = 'YARD';
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  const frame = findAlchemistFrame(s); if (frame?.location === 'YARD') { frame.active = false; if (outcome !== 'PLAYER_DEAD') frame.location = 'PLAYER'; }
  s.combat = null;
  ctx.note('原工坊空院冲突结束', (outcome === 'PLAYER_DEAD' ? '你真实死亡，原护架停止并留在院内，没有替死或复活。' : outcome === 'RETREATED' ? '你停止并亲手带走同一原护架，沿普通原出口退出，无追逐、瞬移或夺取原棍。' : outcome === 'ENEMY_DEAD' ? '奥斯里克真实死亡，原尸体与自己的原棍留在院内；你停止并亲手收回同一原护架。' : '奥斯里克仍活着，自行停止抵抗，把自己的原棍放在院内；你停止并亲手收回同一原护架。') + '原伤势、已付灵性、原护架储能和耐久保留，不治疗、不充能、不生成新原件。');
}
export function alchemistEncounterActions(s: SliceState): AlchemistEncounterAction[] {
  if (s.progression.pathwayId !== 'paragon' || s.progression.sequence !== 4) return [];
  return ([['ENCOUNTER_TALK', '前往原工坊空院交谈', '1行动 · 另留开战1行动'], ['ENCOUNTER_FIGHT', '承担原奥斯里克的真实冲突', '1行动 · 可真实受伤或死亡'], ['LEAVE_ENCOUNTER', '沿原出口和平离开', '0行动']] as const).map(([type, label, cost]) => { const command = { type }, reason = blockAlchemistEncounter(s, command); return { id: `alchemist-${type}`, label, cost, enabled: reason === null, reason, command }; });
}
export function projectAlchemistEncounter(s: SliceState): AlchemistEncounterProjection {
  const e = s.alchemist.encounter; return { title: '原工坊空院的可选争议', story: ALCHEMIST_ENCOUNTER_STORY, status: e.status, enemy: { ...e.enemy }, inside: hasAlchemistEncounterLock(s), actions: alchemistEncounterActions(s) };
}
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
export function validateAlchemistEncounter(s: SliceState): boolean {
  const e = s.alchemist?.encounter, initial = createAlchemistEncounterState(); if (!e || !e.enemy || !shape(e, Object.keys(initial)) || !shape(e.enemy, Object.keys(initial.enemy))) return false;
  const enemy = e.enemy, p = s.alchemist.promotionWeek;
  if (!['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || enemy.id !== initial.enemy.id || enemy.name !== initial.enemy.name || enemy.age !== 44 || enemy.source !== initial.enemy.source || enemy.weaponId !== initial.enemy.weaponId || !['HAND', 'YARD'].includes(enemy.weaponLocation) || !integer(enemy.health, 0, 100) || !integer(enemy.mind, 0, 100) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(enemy.status) || (enemy.status === 'DEAD') !== (enemy.health === 0) || [e.approachWeek, e.attemptWeek].some(w => w !== null && !integer(w, 1, s.week))) return false;
  if (e.status === 'AVAILABLE') return stableStringify(e) === stableStringify(initial) && s.combat?.encounterId !== 'ALCHEMIST_DISPUTE';
  if (p === null || s.progression.pathwayId !== 'paragon' || ![4,3,2].includes(s.progression.sequence!) || e.approachWeek === null || e.approachWeek < p || e.attemptWeek !== null && e.attemptWeek < e.approachWeek) return false;
  if (e.status === 'FIGHTING') return hasAlchemistDisputeOpponent(s);
  if (s.combat?.encounterId === 'ALCHEMIST_DISPUTE') return false;
  if (e.status === 'READY') return e.attemptWeek === null && e.startHistoryIndex === null && stableStringify(enemy) === stableStringify(initial.enemy);
  if (e.startHistoryIndex === null) return e.status === 'RESOLVED' && e.attemptWeek === null && stableStringify(enemy) === stableStringify(initial.enemy);
  if (!integer(e.startHistoryIndex, 0, s.combatHistory.length - 1) || e.attemptWeek === null) return false;
  const rounds = s.combatHistory.slice(e.startHistoryIndex), next = rounds.findIndex((r, i) => i > 0 && r.round === 1), own = next < 0 ? rounds : rounds.slice(0, next), last = own.at(-1);
  if (!last?.alchemistOutcome || !own.every((r, i) => r.round === i + 1 && r.alchemistOutcome?.enemyId === 'AL4-OSRIC') || last.alchemistOutcome.enemyHealth !== enemy.health || last.alchemistOutcome.enemyMind !== enemy.mind || last.alchemistOutcome.enemyStatus !== enemy.status) return false;
  return e.status === 'RETREATED' ? last.retreat === 'SUCCESS' : e.status === 'LOST' ? s.status === 'DEAD' && last.winner === 'ENEMY' : e.status === 'RESOLVED' && last.winner === 'PLAYER' && enemy.status !== 'RESISTING';
}
