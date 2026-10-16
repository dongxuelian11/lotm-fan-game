import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasWitchKingLifeLock } from './life.js';

export const WITCH_KING_ENCOUNTER_STORY = '成年多里安（42岁，WK4-DORIAN）在原练习院因通路分歧挡路，手持自己的唯一普通短棍WK4-DORIAN-CLUB。他是普通人，不是假半神。双方可见、相隔2米，原地面和身后普通出口净空；没有随从或追逐。先花1行动实际交谈，再明确选择1行动承担真实战斗，或者0行动和平离开。只有战前明确准备的同一原月光纸才能被J槽使用，3灵性与原纸照耗；未准备或不足灵性时普通避让，没有自动补纸、免伤或复活。场景与数值为原创G。';
export type WitchKingEncounterCommand = { type: 'ENCOUNTER_TALK' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface WitchKingEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
  approachWeek: number | null; attemptWeek: number | null; startHistoryIndex: number | null;
  enemy: { id: 'WK4-DORIAN'; name: '多里安'; age: 42; source: 'ORIGINAL_PRACTICE_YARD_ADULT';
    health: number; mind: number; status: 'RESISTING' | 'SURRENDERED' | 'DEAD';
    weaponId: 'WK4-DORIAN-CLUB'; weaponLocation: 'HAND' | 'YARD' };
}
export interface WitchKingEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: WitchKingEncounterCommand }
export interface WitchKingEncounterProjection { title: string; story: string; status: string; enemy: WitchKingEncounterState['enemy']; inside: boolean; actions: WitchKingEncounterAction[] }
export function createWitchKingEncounterState(): WitchKingEncounterState {
  return { status: 'AVAILABLE', approachWeek: null, attemptWeek: null, startHistoryIndex: null,
    enemy: { id: 'WK4-DORIAN', name: '多里安', age: 42, source: 'ORIGINAL_PRACTICE_YARD_ADULT', health: 100, mind: 100, status: 'RESISTING', weaponId: 'WK4-DORIAN-CLUB', weaponLocation: 'HAND' } };
}
export function validateWitchKingEncounterCommand(v: unknown): v is WitchKingEncounterCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes((v as { type: string }).type);
}
export const isWitchKingEncounterCommand = validateWitchKingEncounterCommand;
export const hasWitchKingEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.witchKing.encounter.status);
export const isInsideWitchKingEncounter = hasWitchKingEncounterLock;
const openPractice = (s: SliceState) => hasWitchKingLifeLock(s) || Object.values(s.witchKing.life.cases).some(r => r.status === 'PREPARED');
export function blockWitchKingEncounter(s: SliceState, c: WitchKingEncounterCommand): string | null {
  if (!validateWitchKingEncounterCommand(c)) return '巫王遭遇命令无效。';
  if (s.status !== 'ACTIVE' || s.progression.pathwayId !== 'moon' || s.progression.sequence !== 4) return '须仍活着并已经成为巫王。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际来到贝克兰德原练习院。';
  if (openPractice(s) || Object.values(s.crimsonScholar.cases).some(r => r.contactOpen || r.status === 'PREPARED') || s.crimsonScholar.practice.location !== 'START' || s.crimsonScholar.practice.field !== 'NONE' || s.witchKing.ritual.playerLocation === 'HALL') return '先收束原练习院实践或旧深红学者准备与实际月光去回。';
  const e = s.witchKing.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' ? null : '须先实际到场，才能沿原出口和平离开。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神；已有交谈仍可0行动和平退出。';
  if (s.actionsRemaining < (c.type === 'ENCOUNTER_TALK' ? 2 : 1)) return c.type === 'ENCOUNTER_TALK' ? '交谈需1行动，须另留1行动给明确开战选择。' : '开战需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') return e.status === 'AVAILABLE' ? null : '本段原冲突已有进展或结果，不重新生成多里安。';
  return e.status === 'READY' ? null : '先实际交谈，确认原人、原棍和普通出口。';
}
export function applyWitchKingEncounter(s: SliceState, c: WitchKingEncounterCommand, ctx: SeerContext): void {
  const reason = blockWitchKingEncounter(s, c); if (reason) throw new Error(reason);
  const e = s.witchKing.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') { e.status = 'RESOLVED'; ctx.note('沿原出口和平离开', '你接受多里安仍不让路，沿净空原出口离开；原人和自己的原短棍留在院内，争议结束，不强制战斗或发放战斗奖励。'); return; }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') { e.status = 'READY'; e.approachWeek = s.week; ctx.note('与原多里安实际交谈', WITCH_KING_ENCOUNTER_STORY + '本次只确认真实分歧，没有替你开战。'); return; }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'WITCH_KING_DISPUTE', round: 1, enemyHealth: e.enemy.health, enemyMind: e.enemy.mind,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('承担原练习院真实冲突', '你和原多里安在原2米通路交战。他持自己的WK4-DORIAN-CLUB，原普通出口净空且没有追随者。已明确准备的原纸保留，未准备的HELD纸不会自动武装；真实伤势、投降、死亡和撤退由共同战盘结算。');
}
export const applyWitchKingEncounterCommand = applyWitchKingEncounter;
export function hasWitchKingDisputeOpponent(s: SliceState): boolean {
  const e = s.witchKing?.encounter, c = s.combat;
  return s.progression.pathwayId === 'moon' && s.progression.sequence === 4 && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && !openPractice(s) && s.witchKing.ritual.playerLocation === 'OUTSIDE' && s.crimsonScholar.practice.location === 'START' && s.crimsonScholar.practice.field === 'NONE' && !Object.values(s.crimsonScholar.cases).some(r => r.contactOpen || r.status === 'PREPARED') &&
    !!e && e.status === 'FIGHTING' && e.enemy.id === 'WK4-DORIAN' && e.enemy.source === 'ORIGINAL_PRACTICE_YARD_ADULT' && e.enemy.status === 'RESISTING' && e.enemy.weaponId === 'WK4-DORIAN-CLUB' && e.enemy.weaponLocation === 'HAND' &&
    !!c && c.encounterId === 'WITCH_KING_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 && e.enemy.health === c.enemyHealth && e.enemy.mind === c.enemyMind && e.attemptWeek === s.week &&
    Number.isSafeInteger(c.round) && c.round >= 1 && e.startHistoryIndex !== null && Number.isSafeInteger(e.startHistoryIndex) && e.startHistoryIndex >= 0 && s.combatHistory.length - e.startHistoryIndex === c.round - 1 &&
    s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.retreat !== 'SUCCESS' && r.witchKingOutcome?.enemyId === 'WK4-DORIAN');
}
export function settleWitchKingEncounter(s: SliceState, outcome: string, ctx: SeerContext): void {
  const e = s.witchKing.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || !c || c.encounterId !== 'WITCH_KING_DISPUTE' || !['CONTINUE', 'PLAYER_DEAD', 'ENEMY_DEAD', 'ENEMY_SURRENDERED', 'RETREATED'].includes(outcome)) throw new Error('没有对应的巫王原院战斗结果。');
  if (outcome === 'CONTINUE') return;
  if (e.startHistoryIndex === null || !c.lastRound || c.round !== c.lastRound.round + 1 || s.combatHistory.length - e.startHistoryIndex !== c.lastRound.round || s.combatHistory.at(-1)?.witchKingOutcome?.enemyId !== 'WK4-DORIAN' ||
    (outcome === 'PLAYER_DEAD' && (s.health !== 0 || c.lastRound.winner !== 'ENEMY')) || (outcome === 'RETREATED' && (c.lastRound.retreat !== 'SUCCESS' || s.health <= 0)) ||
    (outcome === 'ENEMY_DEAD' && (c.enemyHealth !== 0 || c.enemyStatus !== 'DEAD' || c.lastRound.winner !== 'PLAYER')) || (outcome === 'ENEMY_SURRENDERED' && (c.enemyHealth <= 0 || c.enemyStatus !== 'SURRENDERED' || c.lastRound.winner !== 'PLAYER'))) throw new Error('真实原身体结果与当前已保存回合不符。');
  e.enemy.health = c.enemyHealth; e.enemy.mind = c.enemyMind; e.enemy.status = c.enemyStatus;
  if (c.enemyStatus !== 'RESISTING') e.enemy.weaponLocation = 'YARD';
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  s.combat = null;
  ctx.note('原练习院冲突结束', (outcome === 'PLAYER_DEAD' ? '你真实死亡，原身体留在院内；原纸不是自动复活或死亡豁免。' : outcome === 'RETREATED' ? '本人沿净空原普通出口实际离开，无追逐、瞬移或夺棍。' : outcome === 'ENEMY_DEAD' ? '原多里安真实死亡，原尸体与自己的原短棍留在院内。' : '原多里安仍活着，自行停止抵抗，把自己的原棍放在院内。') + '原健康与伤势、已付灵性和已耗原纸保留，不治疗、不返纸、不生成新目标。');
}
export function witchKingEncounterActions(s: SliceState): WitchKingEncounterAction[] {
  if (s.progression.pathwayId !== 'moon' || s.progression.sequence !== 4) return [];
  return ([['ENCOUNTER_TALK', '前往原练习院交谈', '1行动 · 另留开战1行动'], ['ENCOUNTER_FIGHT', '承担原多里安的真实冲突', '1行动 · 可真实受伤或死亡'], ['LEAVE_ENCOUNTER', '沿原出口和平离开', '0行动']] as const).map(([type, label, cost]) => { const command = { type }, reason = blockWitchKingEncounter(s, command); return { id: `witchKing-${type}`, label, cost, enabled: reason === null, reason, command }; });
}
export function projectWitchKingEncounter(s: SliceState): WitchKingEncounterProjection {
  const e = s.witchKing.encounter; return { title: '原练习院的可选争议', story: WITCH_KING_ENCOUNTER_STORY, status: e.status, enemy: { ...e.enemy }, inside: hasWitchKingEncounterLock(s), actions: witchKingEncounterActions(s) };
}
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
export function validateWitchKingEncounter(s: SliceState): boolean {
  const e = s.witchKing?.encounter, initial = createWitchKingEncounterState(); if (!e || !e.enemy || !shape(e, Object.keys(initial)) || !shape(e.enemy, Object.keys(initial.enemy))) return false;
  const enemy = e.enemy, p = s.witchKing.promotionWeek;
  if (!['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || enemy.id !== initial.enemy.id || enemy.name !== initial.enemy.name || enemy.age !== 42 || enemy.source !== initial.enemy.source || enemy.weaponId !== initial.enemy.weaponId || !['HAND', 'YARD'].includes(enemy.weaponLocation) || !integer(enemy.health, 0, 100) || !integer(enemy.mind, 0, 100) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(enemy.status) || (enemy.status === 'DEAD') !== (enemy.health === 0) || [e.approachWeek, e.attemptWeek].some(w => w !== null && !integer(w, 1, s.week))) return false;
  if (e.status === 'AVAILABLE') return stableStringify(e) === stableStringify(initial) && s.combat?.encounterId !== 'WITCH_KING_DISPUTE';
  if (p === null || s.progression.pathwayId !== 'moon' || ![4,3,2].includes(s.progression.sequence??0) || e.approachWeek === null || e.approachWeek < p || e.attemptWeek !== null && e.attemptWeek < e.approachWeek) return false;
  if (s.progression.sequence === 2 && ['READY', 'FIGHTING'].includes(e.status)) return false;
  if (e.status === 'FIGHTING') return hasWitchKingDisputeOpponent(s);
  if (s.combat?.encounterId === 'WITCH_KING_DISPUTE') return false;
  if (e.status === 'READY') return e.attemptWeek === null && e.startHistoryIndex === null && stableStringify(enemy) === stableStringify(initial.enemy);
  if (e.startHistoryIndex === null) return e.status === 'RESOLVED' && e.attemptWeek === null && stableStringify(enemy) === stableStringify(initial.enemy);
  if (!integer(e.startHistoryIndex, 0, s.combatHistory.length - 1) || e.attemptWeek === null) return false;
  const rounds = s.combatHistory.slice(e.startHistoryIndex), next = rounds.findIndex((r, i) => i > 0 && r.round === 1), own = next < 0 ? rounds : rounds.slice(0, next), last = own.at(-1);
  if (!last?.witchKingOutcome || !own.every((r, i) => r.round === i + 1 && r.witchKingOutcome?.enemyId === 'WK4-DORIAN') || last.witchKingOutcome.enemyHealth !== enemy.health || last.witchKingOutcome.enemyMind !== enemy.mind || last.witchKingOutcome.enemyStatus !== enemy.status) return false;
  return e.status === 'RETREATED' ? last.retreat === 'SUCCESS' : e.status === 'LOST' ? s.status === 'DEAD' && last.winner === 'ENEMY' : e.status === 'RESOLVED' && last.winner === 'PLAYER' && enemy.status !== 'RESISTING';
}
