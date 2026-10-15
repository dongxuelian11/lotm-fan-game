import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasProphetLifeLock } from './life.js';

export const PROPHET_ENCOUNTER_STORY = '成年普通档案馆值守哈罗德·布伦特（46岁，PF4-HAROLD）因原通路分歧挡路，持有自己的唯一普通短棍PF4-HAROLD-CLUB。他是原普通人，不是半神替身。双方可见相隔2米，原档案馆空院地面与普通出口净空，没有追逐或旁观者。先1行动真实交谈，另留1行动决定是否开战，也可0行动和平离开。有限预警4灵性/意志16可失败，只减本槽优势22G，不预读隐藏盘或改写随机结果；弱闪光只来自早先真正学会的FLASH与已用原材料制作的MM5-FLASH-N。原人、场景、数值均为原创G。';
export type ProphetEncounterCommand = { type: 'ENCOUNTER_TALK' } | { type: 'ENCOUNTER_FIGHT' } | { type: 'LEAVE_ENCOUNTER' };
export interface ProphetEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
  approachWeek: number | null; attemptWeek: number | null; startHistoryIndex: number | null;
  enemy: { id: 'PF4-HAROLD'; name: '哈罗德·布伦特'; age: 46; source: 'ORIGINAL_ARCHIVE_YARD_ADULT';
    health: number; mind: number; status: 'RESISTING' | 'SURRENDERED' | 'DEAD';
    weaponId: 'PF4-HAROLD-CLUB'; weaponLocation: 'HAND' | 'YARD' };
}
export interface ProphetEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ProphetEncounterCommand }
export interface ProphetEncounterProjection { title: string; story: string; status: string; enemy: ProphetEncounterState['enemy']; inside: boolean; actions: ProphetEncounterAction[] }
export function createProphetEncounterState(): ProphetEncounterState {
  return { status: 'AVAILABLE', approachWeek: null, attemptWeek: null, startHistoryIndex: null,
    enemy: { id: 'PF4-HAROLD', name: '哈罗德·布伦特', age: 46, source: 'ORIGINAL_ARCHIVE_YARD_ADULT', health: 100, mind: 100, status: 'RESISTING', weaponId: 'PF4-HAROLD-CLUB', weaponLocation: 'HAND' } };
}
export function validateProphetEncounterCommand(v: unknown): v is ProphetEncounterCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes((v as { type: string }).type);
}
export const isProphetEncounterCommand = validateProphetEncounterCommand;
export const hasProphetEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.prophet.encounter.status);
export const isInsideProphetEncounter = hasProphetEncounterLock;
const openPractice = (s: SliceState) => hasProphetLifeLock(s) || Object.values(s.prophet.life.cases).some(r => r.status === 'PREPARED');
export function blockProphetEncounter(s: SliceState, c: ProphetEncounterCommand): string | null {
  if (!validateProphetEncounterCommand(c)) return '预言家遭遇命令无效。';
  if (s.status !== 'ACTIVE' || s.progression.pathwayId !== 'white-tower' || s.progression.sequence !== 4) return '须仍活着并已经成为预言家。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际来到贝克兰德原档案馆空院。';
  if (openPractice(s) || Object.values(s.mysticismMagister.cases).some(r => r.contactOpen || r.status === 'PREPARED') || s.mysticismMagister.practice.token !== 'OWNER' || s.mysticismMagister.practice.dreamOpen || s.prophet.ritual.playerLocation === 'HALL') return '先实际收束预言家原现场、旧秘术导师接触与原衣角。';
  const e = s.prophet.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' ? null : '须先实际到场，才能沿原出口和平离开。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神；已有交谈仍可0行动和平退出。';
  if (s.actionsRemaining < (c.type === 'ENCOUNTER_TALK' ? 2 : 1)) return c.type === 'ENCOUNTER_TALK' ? '交谈需1行动，须另留1行动给明确开战选择。' : '开战需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') return e.status === 'AVAILABLE' ? null : '本段原冲突已有进展或结果，不重新生成哈罗德·布伦特。';
  return e.status === 'READY' ? null : '先实际交谈，确认原人、原棍和普通出口。';
}
export function applyProphetEncounter(s: SliceState, c: ProphetEncounterCommand, ctx: SeerContext): void {
  const reason = blockProphetEncounter(s, c); if (reason) throw new Error(reason);
  const e = s.prophet.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') { e.status = 'RESOLVED'; ctx.note('沿原出口和平离开', '你接受哈罗德·布伦特仍不让路，沿净空原出口离开；原人和自己的原短棍留在院内，争议结束，不强制战斗或发放战斗奖励。'); return; }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') { e.status = 'READY'; e.approachWeek = s.week; ctx.note('与原哈罗德·布伦特实际交谈', PROPHET_ENCOUNTER_STORY + '本次只确认真实分歧，没有替你开战。'); return; }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'PROPHET_DISPUTE', round: 1, enemyHealth: e.enemy.health, enemyMind: e.enemy.mind,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('承担原档案馆空院真实冲突', '你和原哈罗德·布伦特在原2米通路交战。他持自己的PF4-HAROLD-CLUB，原普通出口净空且没有追随者。片段预警不保证获胜，已制原微光只有R实际抽中才会耗用；真实伤势、投降、死亡和撤退由共同战盘结算。');
}
export const applyProphetEncounterCommand = applyProphetEncounter;
export function hasProphetDisputeOpponent(s: SliceState): boolean {
  const e = s.prophet?.encounter, c = s.combat;
  return s.progression.pathwayId === 'white-tower' && s.progression.sequence === 4 && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && !openPractice(s) && s.prophet.ritual.playerLocation === 'OUTSIDE' && s.mysticismMagister.practice.token === 'OWNER' && !s.mysticismMagister.practice.dreamOpen && !Object.values(s.mysticismMagister.cases).some(r => r.contactOpen || r.status === 'PREPARED') &&
    !!e && e.status === 'FIGHTING' && e.enemy.id === 'PF4-HAROLD' && e.enemy.source === 'ORIGINAL_ARCHIVE_YARD_ADULT' && e.enemy.status === 'RESISTING' && e.enemy.weaponId === 'PF4-HAROLD-CLUB' && e.enemy.weaponLocation === 'HAND' &&
    !!c && c.encounterId === 'PROPHET_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 && e.enemy.health === c.enemyHealth && e.enemy.mind === c.enemyMind && e.attemptWeek === s.week &&
    Number.isSafeInteger(c.round) && c.round >= 1 && e.startHistoryIndex !== null && Number.isSafeInteger(e.startHistoryIndex) && e.startHistoryIndex >= 0 && s.combatHistory.length - e.startHistoryIndex === c.round - 1 &&
    s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.retreat !== 'SUCCESS' && r.prophetOutcome?.enemyId === 'PF4-HAROLD' && validOriginalConsumption(s, r.prophetOutcome.consumedCraftIds, e.attemptWeek!));
}
export function settleProphetEncounter(s: SliceState, outcome: string, ctx: SeerContext): void {
  const e = s.prophet.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || !c || c.encounterId !== 'PROPHET_DISPUTE' || !['CONTINUE', 'PLAYER_DEAD', 'ENEMY_DEAD', 'ENEMY_SURRENDERED', 'RETREATED'].includes(outcome)) throw new Error('没有对应的预言家原院战斗结果。');
  if (outcome === 'CONTINUE') return;
  if (e.startHistoryIndex === null || !c.lastRound || c.round !== c.lastRound.round + 1 || s.combatHistory.length - e.startHistoryIndex !== c.lastRound.round || s.combatHistory.at(-1)?.prophetOutcome?.enemyId !== 'PF4-HAROLD' ||
    (outcome === 'PLAYER_DEAD' && (s.health !== 0 || c.lastRound.winner !== 'ENEMY')) || (outcome === 'RETREATED' && (c.lastRound.retreat !== 'SUCCESS' || s.health <= 0)) ||
    (outcome === 'ENEMY_DEAD' && (c.enemyHealth !== 0 || c.enemyStatus !== 'DEAD' || c.lastRound.winner !== 'PLAYER')) || (outcome === 'ENEMY_SURRENDERED' && (c.enemyHealth <= 0 || c.enemyStatus !== 'SURRENDERED' || c.lastRound.winner !== 'PLAYER'))) throw new Error('真实原身体结果与当前已保存回合不符。');
  e.enemy.health = c.enemyHealth; e.enemy.mind = c.enemyMind; e.enemy.status = c.enemyStatus;
  if (c.enemyStatus !== 'RESISTING') e.enemy.weaponLocation = 'YARD';
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  s.combat = null;
  ctx.note('原档案馆空院冲突结束', (outcome === 'PLAYER_DEAD' ? '你真实死亡，原身体留在院内；有限预警与弱闪光不豁免死亡。' : outcome === 'RETREATED' ? '本人沿净空原普通出口实际离开，无追逐、瞬移或夺棍。' : outcome === 'ENEMY_DEAD' ? '原哈罗德·布伦特真实死亡，原尸体与自己的原短棍留在院内。' : '原哈罗德·布伦特仍活着，自行停止抵抗，把自己的原棍放在院内。') + '原健康与伤势、已付灵性及已耗原微光片历史保留，不治疗、不复活、不生成新目标。');
}
export function prophetEncounterActions(s: SliceState): ProphetEncounterAction[] {
  if (s.progression.pathwayId !== 'white-tower' || s.progression.sequence !== 4) return [];
  return ([['ENCOUNTER_TALK', '前往原档案馆空院交谈', '1行动 · 另留开战1行动'], ['ENCOUNTER_FIGHT', '承担原哈罗德·布伦特的真实冲突', '1行动 · 可真实受伤或死亡'], ['LEAVE_ENCOUNTER', '沿原出口和平离开', '0行动']] as const).map(([type, label, cost]) => { const command: ProphetEncounterCommand = { type }, reason = blockProphetEncounter(s, command); return { id: `prophet-${type}`, label, cost, enabled: reason === null, reason, command }; });
}
export function projectProphetEncounter(s: SliceState): ProphetEncounterProjection {
  const e = s.prophet.encounter; return { title: '原档案馆空院的可选争议', story: PROPHET_ENCOUNTER_STORY, status: e.status, enemy: { ...e.enemy }, inside: hasProphetEncounterLock(s), actions: prophetEncounterActions(s) };
}
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
export function validateProphetEncounter(s: SliceState): boolean {
  const e = s.prophet?.encounter, initial = createProphetEncounterState(); if (!e || !e.enemy || !shape(e, Object.keys(initial)) || !shape(e.enemy, Object.keys(initial.enemy))) return false;
  const enemy = e.enemy, p = s.prophet.promotionWeek;
  if (!['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || enemy.id !== initial.enemy.id || enemy.name !== initial.enemy.name || enemy.age !== 46 || enemy.source !== initial.enemy.source || enemy.weaponId !== initial.enemy.weaponId || !['HAND', 'YARD'].includes(enemy.weaponLocation) || !integer(enemy.health, 0, 100) || !integer(enemy.mind, 0, 100) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(enemy.status) || (enemy.status === 'DEAD') !== (enemy.health === 0) || [e.approachWeek, e.attemptWeek].some(w => w !== null && !integer(w, 1, s.week))) return false;
  if (e.status === 'AVAILABLE') return stableStringify(e) === stableStringify(initial) && s.combat?.encounterId !== 'PROPHET_DISPUTE';
  if (p === null || s.progression.pathwayId !== 'white-tower' || ![4,3,2].includes(s.progression.sequence??0) || e.approachWeek === null || e.approachWeek < p || e.attemptWeek !== null && e.attemptWeek < e.approachWeek) return false;
  if (s.progression.sequence === 2 && ['READY', 'FIGHTING'].includes(e.status)) return false;
  if (e.status === 'FIGHTING') return hasProphetDisputeOpponent(s);
  if (s.combat?.encounterId === 'PROPHET_DISPUTE') return false;
  if (e.status === 'READY') return e.attemptWeek === null && e.startHistoryIndex === null && stableStringify(enemy) === stableStringify(initial.enemy);
  if (e.startHistoryIndex === null) return e.status === 'RESOLVED' && e.attemptWeek === null && stableStringify(enemy) === stableStringify(initial.enemy);
  if (!integer(e.startHistoryIndex, 0, s.combatHistory.length - 1) || e.attemptWeek === null) return false;
  const rounds = s.combatHistory.slice(e.startHistoryIndex), next = rounds.findIndex((r, i) => i > 0 && r.round === 1), own = next < 0 ? rounds : rounds.slice(0, next), last = own.at(-1);
  if (!last?.prophetOutcome || !own.every((r, i) => r.round === i + 1 && r.prophetOutcome?.enemyId === 'PF4-HAROLD' && validOriginalConsumption(s, r.prophetOutcome.consumedCraftIds, e.attemptWeek!)) || new Set(own.flatMap(r => r.prophetOutcome!.consumedCraftIds)).size !== own.flatMap(r => r.prophetOutcome!.consumedCraftIds).length || last.prophetOutcome.enemyHealth !== enemy.health || last.prophetOutcome.enemyMind !== enemy.mind || last.prophetOutcome.enemyStatus !== enemy.status) return false;
  return e.status === 'RETREATED' ? last.retreat === 'SUCCESS' : e.status === 'LOST' ? s.status === 'DEAD' && last.winner === 'ENEMY' : e.status === 'RESOLVED' && last.winner === 'PLAYER' && enemy.status !== 'RESISTING';
}

function validOriginalConsumption(s: SliceState, ids: string[], week: number): boolean {
  return Array.isArray(ids) && new Set(ids).size === ids.length && ids.every(id => { const c = s.mysticismMagister.crafts.find(c => c.id === id); return /^MM5-FLASH-[1-9]\d*$/.test(id) && !!c && c.sourceKitId === id.replace('FLASH', 'KIT') && c.status === 'CONSUMED' && c.usedWeek === week && c.createdWeek <= week; });
}
