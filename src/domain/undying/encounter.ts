import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasUndyingLifeLock, hasUndyingOldPractice } from './life.js';

export const UNDYING_ENCOUNTER_STORY = '成年普通档案室值守欧文·戴尔（46岁，UDY4-OWEN）因原通路分歧挡路，持自己的唯一普通短棍UDY4-OWEN-CLUB。他是本次原普通人，未借用或复活旧看守。双方可见相隔2米，原净空石院与普通出口都可实际通行；其他人已在院外，无追逐。先1行动交谈并另留1行动明确决定开战，也可0行动和平离开。死者之语沿用实际旧掌握；借力封印只限制本轮短攻击窗口，普通人可以抵抗。灵性、伤势与死亡真实保留，六十年周期登记不能作为普通死亡复活。原人、场景与数值均为原创G。';
export type UndyingEncounterCommand = { type: 'ENCOUNTER_TALK' } | { type: 'ENCOUNTER_FIGHT' } | { type: 'LEAVE_ENCOUNTER' };
export interface UndyingEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
  approachWeek: number | null; attemptWeek: number | null; startHistoryIndex: number | null;
  enemy: { id: 'UDY4-OWEN'; name: '欧文·戴尔'; age: 46; source: 'ORIGINAL_ARCHIVE_YARD_ADULT';
    health: number; mind: number; status: 'RESISTING' | 'SURRENDERED' | 'DEAD';
    weaponId: 'UDY4-OWEN-CLUB'; weaponLocation: 'HAND' | 'YARD' };
}
export interface UndyingEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: UndyingEncounterCommand }
export interface UndyingEncounterProjection { title: string; story: string; status: string; enemy: UndyingEncounterState['enemy']; inside: boolean; actions: UndyingEncounterAction[] }
export function createUndyingEncounterState(): UndyingEncounterState {
  return { status: 'AVAILABLE', approachWeek: null, attemptWeek: null, startHistoryIndex: null,
    enemy: { id: 'UDY4-OWEN', name: '欧文·戴尔', age: 46, source: 'ORIGINAL_ARCHIVE_YARD_ADULT', health: 100, mind: 100, status: 'RESISTING', weaponId: 'UDY4-OWEN-CLUB', weaponLocation: 'HAND' } };
}
export function validateUndyingEncounterCommand(v: unknown): v is UndyingEncounterCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes((v as { type: string }).type);
}
export const isUndyingEncounterCommand = validateUndyingEncounterCommand;
export const hasUndyingEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.undying.encounter.status);
export const isInsideUndyingEncounter = hasUndyingEncounterLock;
const openPractice = (s: SliceState) => hasUndyingLifeLock(s) || Object.values(s.undying.life.cases).some(r => r.status === 'PREPARED');
export function blockUndyingEncounter(s: SliceState, c: UndyingEncounterCommand): string | null {
  if (!validateUndyingEncounterCommand(c)) return '不死者遭遇命令无效。';
  if (s.status !== 'ACTIVE' || s.progression.pathwayId !== 'death' || s.progression.sequence !== 4) return '须仍活着并已经成为不死者。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际来到贝克兰德原档案馆空院。';
  if (openPractice(s) || hasUndyingOldPractice(s) || s.undying.ritual.playerLocation === 'HALL') return '先实际拿回原簿、停止有限封印，并收束原仪式与旧看门人实践。';
  const e = s.undying.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' ? null : '须先实际到场，才能沿原出口和平离开。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神；已有交谈仍可0行动和平退出。';
  if (s.actionsRemaining < (c.type === 'ENCOUNTER_TALK' ? 2 : 1)) return c.type === 'ENCOUNTER_TALK' ? '交谈需1行动，须另留1行动给明确开战选择。' : '开战需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') return e.status === 'AVAILABLE' ? null : '本段原冲突已有进展或结果，不重新生成欧文·戴尔。';
  return e.status === 'READY' ? null : '先实际交谈，确认原人、原棍和普通出口。';
}
export function applyUndyingEncounter(s: SliceState, c: UndyingEncounterCommand, ctx: SeerContext): void {
  const reason = blockUndyingEncounter(s, c); if (reason) throw new Error(reason);
  const e = s.undying.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') { e.status = 'RESOLVED'; ctx.note('沿原出口和平离开', '你接受欧文·戴尔仍不让路，沿净空原出口离开；原人和自己的原短棍留在院内，争议结束，不强制战斗或发放战斗奖励。'); return; }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') { e.status = 'READY'; e.approachWeek = s.week; ctx.note('与原欧文·戴尔实际交谈', UNDYING_ENCOUNTER_STORY + '本次只确认真实分歧，没有替你开战。'); return; }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'UNDYING_DISPUTE', round: 1, enemyHealth: e.enemy.health, enemyMind: e.enemy.mind,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('承担原档案馆空院真实冲突', '你和原欧文·戴尔在原2米通路交战。他持自己的UDY4-OWEN-CLUB，原普通出口净空且没有追随者。死者之语与有限封印不保证获胜，原灰羽保持原位置与历史；真实伤势、投降、死亡和撤退由共同战盘结算。');
}
export const applyUndyingEncounterCommand = applyUndyingEncounter;
export function hasUndyingDisputeOpponent(s: SliceState): boolean {
  const e = s.undying?.encounter, c = s.combat;
  return s.progression.pathwayId === 'death' && s.progression.sequence === 4 && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && !openPractice(s) && s.undying.ritual.playerLocation === 'OUTSIDE' && !hasUndyingOldPractice(s) &&
    !!e && e.status === 'FIGHTING' && e.enemy.id === 'UDY4-OWEN' && e.enemy.source === 'ORIGINAL_ARCHIVE_YARD_ADULT' && e.enemy.status === 'RESISTING' && e.enemy.weaponId === 'UDY4-OWEN-CLUB' && e.enemy.weaponLocation === 'HAND' &&
    !!c && c.encounterId === 'UNDYING_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 && e.enemy.health === c.enemyHealth && e.enemy.mind === c.enemyMind && e.attemptWeek === s.week &&
    Number.isSafeInteger(c.round) && c.round >= 1 && e.startHistoryIndex !== null && Number.isSafeInteger(e.startHistoryIndex) && e.startHistoryIndex >= 0 && s.combatHistory.length - e.startHistoryIndex === c.round - 1 &&
    s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.retreat !== 'SUCCESS' && r.undyingOutcome?.enemyId === 'UDY4-OWEN' && validRoundUses(r.undyingOutcome, r.playerCount));
}
export function settleUndyingEncounter(s: SliceState, outcome: string, ctx: SeerContext): void {
  const e = s.undying.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || !c || c.encounterId !== 'UNDYING_DISPUTE' || !['CONTINUE', 'PLAYER_DEAD', 'ENEMY_DEAD', 'ENEMY_SURRENDERED', 'RETREATED'].includes(outcome)) throw new Error('没有对应的不死者原院战斗结果。');
  if (outcome === 'CONTINUE') return;
  if (e.startHistoryIndex === null || !c.lastRound || c.round !== c.lastRound.round + 1 || s.combatHistory.length - e.startHistoryIndex !== c.lastRound.round || s.combatHistory.at(-1)?.undyingOutcome?.enemyId !== 'UDY4-OWEN' ||
    (outcome === 'PLAYER_DEAD' && (s.health !== 0 || c.lastRound.winner !== 'ENEMY')) || (outcome === 'RETREATED' && (c.lastRound.retreat !== 'SUCCESS' || s.health <= 0)) ||
    (outcome === 'ENEMY_DEAD' && (c.enemyHealth !== 0 || c.enemyStatus !== 'DEAD' || c.lastRound.winner !== 'PLAYER')) || (outcome === 'ENEMY_SURRENDERED' && (c.enemyHealth <= 0 || c.enemyStatus !== 'SURRENDERED' || c.lastRound.winner !== 'PLAYER'))) throw new Error('真实原身体结果与当前已保存回合不符。');
  e.enemy.health = c.enemyHealth; e.enemy.mind = c.enemyMind; e.enemy.status = c.enemyStatus;
  if (c.enemyStatus !== 'RESISTING') e.enemy.weaponLocation = 'YARD';
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  s.combat = null;
  ctx.note('原档案馆空院冲突结束', (outcome === 'PLAYER_DEAD' ? '你真实死亡，原身体留在院内；六十年周期尚未经历，不豁免本次普通死亡，也不自动复活。' : outcome === 'RETREATED' ? '本人沿净空原普通出口实际离开，无追逐、瞬移或夺棍。' : outcome === 'ENEMY_DEAD' ? '原欧文·戴尔真实死亡，原尸体与自己的原短棍留在院内。' : '原欧文·戴尔仍活着，自行停止抵抗，把自己的原棍放在院内。') + '原健康与伤势、已付灵性及原灰羽历史保留，不治疗、不复活、不生成新目标。');
}
export function undyingEncounterActions(s: SliceState): UndyingEncounterAction[] {
  if (s.progression.pathwayId !== 'death' || s.progression.sequence !== 4) return [];
  return ([['ENCOUNTER_TALK', '前往原档案馆空院交谈', '1行动 · 另留开战1行动'], ['ENCOUNTER_FIGHT', '承担原欧文·戴尔的真实冲突', '1行动 · 可真实受伤或死亡'], ['LEAVE_ENCOUNTER', '沿原出口和平离开', '0行动']] as const).map(([type, label, cost]) => { const command: UndyingEncounterCommand = { type }, reason = blockUndyingEncounter(s, command); return { id: `undying-${type}`, label, cost, enabled: reason === null, reason, command }; });
}
export function projectUndyingEncounter(s: SliceState): UndyingEncounterProjection {
  const e = s.undying.encounter; return { title: '原档案馆空院的可选争议', story: UNDYING_ENCOUNTER_STORY, status: e.status, enemy: { ...e.enemy }, inside: hasUndyingEncounterLock(s), actions: undyingEncounterActions(s) };
}
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
export function validateUndyingEncounter(s: SliceState): boolean {
  const e = s.undying?.encounter, initial = createUndyingEncounterState(); if (!e || !e.enemy || !shape(e, Object.keys(initial)) || !shape(e.enemy, Object.keys(initial.enemy))) return false;
  const enemy = e.enemy, p = s.undying.promotionWeek;
  if (!['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || enemy.id !== initial.enemy.id || enemy.name !== initial.enemy.name || enemy.age !== 46 || enemy.source !== initial.enemy.source || enemy.weaponId !== initial.enemy.weaponId || !['HAND', 'YARD'].includes(enemy.weaponLocation) || !integer(enemy.health, 0, 100) || !integer(enemy.mind, 0, 100) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(enemy.status) || (enemy.status === 'DEAD') !== (enemy.health === 0) || [e.approachWeek, e.attemptWeek].some(w => w !== null && !integer(w, 1, s.week))) return false;
  if (e.status === 'AVAILABLE') return stableStringify(e) === stableStringify(initial) && s.combat?.encounterId !== 'UNDYING_DISPUTE';
  if (p === null || s.progression.pathwayId !== 'death' || ![4,3,2,1].includes(s.progression.sequence??0) || e.approachWeek === null || e.approachWeek < p || e.attemptWeek !== null && e.attemptWeek < e.approachWeek) return false;
  if (e.status === 'FIGHTING') return hasUndyingDisputeOpponent(s);
  if (s.combat?.encounterId === 'UNDYING_DISPUTE') return false;
  if (e.status === 'READY') return e.attemptWeek === null && e.startHistoryIndex === null && stableStringify(enemy) === stableStringify(initial.enemy);
  if (e.startHistoryIndex === null) return e.status === 'RESOLVED' && e.attemptWeek === null && stableStringify(enemy) === stableStringify(initial.enemy);
  if (!integer(e.startHistoryIndex, 0, s.combatHistory.length - 1) || e.attemptWeek === null) return false;
  const rounds = s.combatHistory.slice(e.startHistoryIndex), next = rounds.findIndex((r, i) => i > 0 && r.round === 1), own = next < 0 ? rounds : rounds.slice(0, next), last = own.at(-1);
  if (!last?.undyingOutcome || !own.every((r, i) => r.round === i + 1 && r.undyingOutcome?.enemyId === 'UDY4-OWEN' && validRoundUses(r.undyingOutcome, r.playerCount)) || last.undyingOutcome.enemyHealth !== enemy.health || last.undyingOutcome.enemyMind !== enemy.mind || last.undyingOutcome.enemyStatus !== enemy.status) return false;
  return e.status === 'RETREATED' ? last.retreat === 'SUCCESS' : e.status === 'LOST' ? s.status === 'DEAD' && last.winner === 'ENEMY' : e.status === 'RESOLVED' && last.winner === 'PLAYER' && enemy.status !== 'RESISTING';
}

function validRoundUses(outcome: { sealUses: number; deadWordUses: number }, count: number): boolean {
  return integer(outcome.sealUses, 0, count) && integer(outcome.deadWordUses, 0, count) && outcome.sealUses + outcome.deadWordUses <= count;
}
