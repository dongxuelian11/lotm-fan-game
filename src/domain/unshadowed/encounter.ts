import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasPriestOfLightOpenPractice } from '../priest-of-light/encounter.js';
import { hasUnshadowedLifeLock } from './life.js';
import { hasUnshadowedRitualLock } from './ritual.js';

export const UNSHADOWED_ENCOUNTER_STORY = '原47岁普通档案院值守埃德蒙·塔尔（UD4-EDMUND）持自己唯一原普通短棍UD4-EDMUND-CLUB，因原通路争议挡路。双方相距2米可见，独立原石院8米G标线内只有两人，原导师、奥尔登与其他人确实留在界外的练习厅，并未因友好关系免疫。原普通出口开放且无追逐；无暗领域没有物理墙。先1行动交谈并另留1行动供明确开战选择，可0行动和平离开。光矛、净化光对该普通活人只作普通攻击，不自动贴邪恶标签；耀斑会在同一原地面留下焦痕，不保证胜利或免伤。人物、场地、距离、成本与结果均为原创G。';
export type UnshadowedEncounterCommand = { type: 'ENCOUNTER_TALK' } | { type: 'ENCOUNTER_FIGHT' } | { type: 'LEAVE_ENCOUNTER' };
export interface UnshadowedEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
  groundId: 'UD4-COURTYARD-GROUND'; groundScorchMarks: number; othersOutside: boolean;
  approachWeek: number | null; attemptWeek: number | null; startHistoryIndex: number | null;
  enemy: { id: 'UD4-EDMUND'; name: '埃德蒙·塔尔'; age: 47; source: 'ORIGINAL_ARCHIVE_ADULT'; health: number; mind: number; status: 'RESISTING' | 'SURRENDERED' | 'DEAD'; weaponId: 'UD4-EDMUND-CLUB'; weaponLocation: 'HAND' | 'COURTYARD' };
}
export interface UnshadowedEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: UnshadowedEncounterCommand }
export interface UnshadowedEncounterProjection { title: string; story: string; status: string; enemy: UnshadowedEncounterState['enemy']; groundScorchMarks: number; inside: boolean; actions: UnshadowedEncounterAction[] }
export function createUnshadowedEncounterState(): UnshadowedEncounterState { return { status: 'AVAILABLE', groundId: 'UD4-COURTYARD-GROUND', groundScorchMarks: 0, othersOutside: true, approachWeek: null, attemptWeek: null, startHistoryIndex: null, enemy: { id: 'UD4-EDMUND', name: '埃德蒙·塔尔', age: 47, source: 'ORIGINAL_ARCHIVE_ADULT', health: 100, mind: 100, status: 'RESISTING', weaponId: 'UD4-EDMUND-CLUB', weaponLocation: 'HAND' } }; }
export function validateUnshadowedEncounterCommand(v: unknown): v is UnshadowedEncounterCommand { return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes((v as { type: string }).type); }
export const isUnshadowedEncounterCommand = validateUnshadowedEncounterCommand;
export const hasUnshadowedEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.unshadowed.encounter.status);
export const isInsideUnshadowedEncounter = hasUnshadowedEncounterLock;
const openPractice = (s: SliceState) => hasUnshadowedLifeLock(s) || Object.values(s.unshadowed.life.cases).some(r => r.status === 'PREPARED') || hasPriestOfLightOpenPractice(s) || Object.values(s.priestOfLight.cases).some(r => r.status === 'PREPARED');
export function blockUnshadowedEncounter(s: SliceState, c: UnshadowedEncounterCommand): string | null {
  if (!validateUnshadowedEncounterCommand(c)) return '无暗者遭遇命令无效。';
  if (s.status !== 'ACTIVE' || s.progression.pathwayId !== 'sun' || s.progression.sequence !== 4) return '须仍活着且已实际成为无暗者。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际来到贝克兰德原档案院石庭。';
  if (openPractice(s) || hasUnshadowedRitualLock(s)) return '先真实返回情感、结束仪式并收束原实践、旧冰、灯笼与灵体。';
  const e = s.unshadowed.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' ? null : '须先实际到场，才能沿原普通出口和平离开。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神；已经交谈仍可0行动和平离开。';
  if (!e.othersOutside || e.groundId !== 'UD4-COURTYARD-GROUND') return '其余原身体须当前确实在原8米标线外，不能凭友好身份豁免耀斑。';
  if (s.actionsRemaining < (c.type === 'ENCOUNTER_TALK' ? 2 : 1)) return c.type === 'ENCOUNTER_TALK' ? '交谈需1行动，并须另留1行动给明确开战选择。' : '开战需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') return e.status === 'AVAILABLE' ? null : '本段原争议已有进展或结果，不重新生成埃德蒙。';
  return e.status === 'READY' ? null : '先实际交谈，确认原人、原棍、范围外其他人和普通出口。';
}
export function applyUnshadowedEncounter(s: SliceState, c: UnshadowedEncounterCommand, ctx: SeerContext): void {
  const reason = blockUnshadowedEncounter(s, c); if (reason) throw new Error(reason); const e = s.unshadowed.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') { e.status = 'RESOLVED'; ctx.note('沿原普通出口和平离开', '你接受埃德蒙仍不让路，沿开放普通出口实际离开；原人和自己原棍留在石院，没有领域封路、强迫战斗、夺棍或战斗奖励。'); return; }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') { e.status = 'READY'; e.approachWeek = s.week; ctx.note('与原埃德蒙当面交谈', UNSHADOWED_ENCOUNTER_STORY + '本次只确认分歧，没有替玩家开战。'); return; }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'UNSHADOWED_DISPUTE', round: 1, enemyHealth: e.enemy.health, enemyMind: e.enemy.mind, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('承担原石院真实冲突', '原47岁埃德蒙持自己的UD4-EDMUND-CLUB，其他原身体确实留在8米标线之外，原普通出口开放且无追逐。只有抽中且实付灵性的有限能力才尝试，不保证获胜；原身体伤势、投降、死亡与撤退由共同战盘决定。');
}
export const applyUnshadowedEncounterCommand = applyUnshadowedEncounter;
export function hasUnshadowedDisputeOpponent(s: SliceState): boolean {
  const e = s.unshadowed?.encounter, c = s.combat;
  if (!(s.progression.pathwayId === 'sun' && s.progression.sequence === 4 && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && !openPractice(s) && !hasUnshadowedRitualLock(s) && !!e && e.othersOutside && e.groundId === 'UD4-COURTYARD-GROUND' && e.status === 'FIGHTING' && e.enemy.id === 'UD4-EDMUND' && e.enemy.source === 'ORIGINAL_ARCHIVE_ADULT' && e.enemy.status === 'RESISTING' && e.enemy.weaponId === 'UD4-EDMUND-CLUB' && e.enemy.weaponLocation === 'HAND' && !!c && c.encounterId === 'UNSHADOWED_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 && e.enemy.health === c.enemyHealth && e.enemy.mind === c.enemyMind && e.attemptWeek === s.week && Number.isSafeInteger(c.round) && c.round >= 1 && e.startHistoryIndex !== null && Number.isSafeInteger(e.startHistoryIndex) && e.startHistoryIndex >= 0 && s.combatHistory.length - e.startHistoryIndex === c.round - 1)) return false;
  const rounds = s.combatHistory.slice(e.startHistoryIndex!); let marks = 0;
  return rounds.every((r, i) => { const o = r.unshadowedOutcome; if (!o || r.round !== i + 1 || r.winner === null || r.retreat === 'SUCCESS' || !validRound(o, r.playerCount)) return false; marks += o.sunflareUses; return o.groundScorchMarks === marks; }) && e.groundScorchMarks === marks;
}
export function settleUnshadowedEncounter(s: SliceState, outcome: string, ctx: SeerContext): void {
  const e = s.unshadowed.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || !c || c.encounterId !== 'UNSHADOWED_DISPUTE' || !['CONTINUE', 'PLAYER_DEAD', 'ENEMY_DEAD', 'ENEMY_SURRENDERED', 'RETREATED'].includes(outcome)) throw new Error('没有对应的无暗者原石院战斗结果。');
  if (outcome === 'CONTINUE') return;
  if (e.startHistoryIndex === null || !c.lastRound || c.round !== c.lastRound.round + 1 || s.combatHistory.length - e.startHistoryIndex !== c.lastRound.round || stableStringify(s.combatHistory.at(-1)) !== stableStringify(c.lastRound) || c.lastRound.unshadowedOutcome?.enemyId !== 'UD4-EDMUND' ||
    (outcome === 'PLAYER_DEAD' && (s.health !== 0 || c.lastRound.winner !== 'ENEMY' || c.lastRound.retreat === 'SUCCESS')) || (outcome === 'RETREATED' && (c.lastRound.retreat !== 'SUCCESS' || c.lastRound.winner !== 'ENEMY' || s.health <= 0)) ||
    (outcome === 'ENEMY_DEAD' && (c.enemyHealth !== 0 || c.enemyStatus !== 'DEAD' || c.lastRound.winner !== 'PLAYER' || c.lastRound.retreat !== 'NONE')) || (outcome === 'ENEMY_SURRENDERED' && (c.enemyHealth <= 0 || c.enemyStatus !== 'SURRENDERED' || c.lastRound.winner !== 'PLAYER' || c.lastRound.retreat !== 'NONE'))) throw new Error('真实原身体结果与已保存回合不符。');
  e.enemy.health = c.enemyHealth; e.enemy.mind = c.enemyMind; e.enemy.status = c.enemyStatus;
  if (c.enemyStatus !== 'RESISTING') e.enemy.weaponLocation = 'COURTYARD';
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; s.combat = null;
  ctx.note('原石院冲突结束', (outcome === 'PLAYER_DEAD' ? '你在原石院真实死亡，原身体留在现场；无暗者能力不免死或复活。' : outcome === 'RETREATED' ? '本人沿开放原普通出口实际退出，没有领域封锁、追逐、瞬移或夺棍。' : outcome === 'ENEMY_DEAD' ? '同一原埃德蒙真实死亡，原尸体与自己的原棍留在原石院。' : '原埃德蒙仍活着，自行停止抵抗并放下自己的原棍，所有权不变。') + '同一原地面的焦痕、真实伤势与实付灵性保留，不免费抽取特性、不创造新魔药或新敌人。');
}
export function unshadowedEncounterActions(s: SliceState): UnshadowedEncounterAction[] { if (s.progression.pathwayId !== 'sun' || s.progression.sequence !== 4) return []; return ([['ENCOUNTER_TALK', '前往原档案院石庭交谈', '1行动 · 另留开战1行动'], ['ENCOUNTER_FIGHT', '承担原埃德蒙的真实冲突', '1行动 · 可受伤或死亡'], ['LEAVE_ENCOUNTER', '沿原普通出口和平离开', '0行动']] as const).map(([type, label, cost]) => { const command: UnshadowedEncounterCommand = { type }, reason = blockUnshadowedEncounter(s, command); return { id: `unshadowed-${type}`, label, cost, enabled: reason === null, reason, command }; }); }
export function projectUnshadowedEncounter(s: SliceState): UnshadowedEncounterProjection { const e = s.unshadowed.encounter; return { title: '原档案院石庭的可选争议', story: UNSHADOWED_ENCOUNTER_STORY, status: e.status, enemy: { ...e.enemy }, groundScorchMarks: e.groundScorchMarks, inside: hasUnshadowedEncounterLock(s), actions: unshadowedEncounterActions(s) }; }
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
export function validateUnshadowedEncounter(s: SliceState): boolean {
  const e = s.unshadowed?.encounter, initial = createUnshadowedEncounterState(); if (!e || !e.enemy || !shape(e, Object.keys(initial)) || !shape(e.enemy, Object.keys(initial.enemy))) return false;
  const enemy = e.enemy, p = s.unshadowed.promotionWeek;
  if (e.groundId !== 'UD4-COURTYARD-GROUND' || !integer(e.groundScorchMarks) || typeof e.othersOutside !== 'boolean' || !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || enemy.id !== initial.enemy.id || enemy.name !== initial.enemy.name || enemy.age !== 47 || enemy.source !== initial.enemy.source || enemy.weaponId !== initial.enemy.weaponId || !['HAND', 'COURTYARD'].includes(enemy.weaponLocation) || !integer(enemy.health, 0, 100) || !integer(enemy.mind, 0, 100) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(enemy.status) || (enemy.status === 'DEAD') !== (enemy.health === 0) || [e.approachWeek, e.attemptWeek].some(w => w !== null && !integer(w, 1, s.week))) return false;
  if (e.status === 'AVAILABLE') return stableStringify(e) === stableStringify(initial) && s.combat?.encounterId !== 'UNSHADOWED_DISPUTE';
  if (p === null || s.progression.pathwayId !== 'sun' || ![4,3,2].includes(s.progression.sequence??0) || e.approachWeek === null || e.approachWeek < p || e.attemptWeek !== null && e.attemptWeek < e.approachWeek || !e.othersOutside) return false;
  if (e.status === 'FIGHTING') return hasUnshadowedDisputeOpponent(s);
  if (s.combat?.encounterId === 'UNSHADOWED_DISPUTE') return false;
  if (e.status === 'READY') return e.attemptWeek === null && e.startHistoryIndex === null && e.groundScorchMarks === 0 && !openPractice(s) && !hasUnshadowedRitualLock(s) && stableStringify(enemy) === stableStringify(initial.enemy);
  if (e.startHistoryIndex === null) return e.status === 'RESOLVED' && e.attemptWeek === null && e.groundScorchMarks === 0 && stableStringify(enemy) === stableStringify(initial.enemy);
  if (!integer(e.startHistoryIndex, 0, s.combatHistory.length - 1) || e.attemptWeek === null) return false;
  const rounds = s.combatHistory.slice(e.startHistoryIndex), next = rounds.findIndex((r, i) => i > 0 && r.round === 1), own = next < 0 ? rounds : rounds.slice(0, next), last = own.at(-1); let marks = 0;
  if (!last?.unshadowedOutcome || !own.every((r, i) => { const o = r.unshadowedOutcome; if (!o || r.round !== i + 1 || r.winner === null || i < own.length - 1 && r.retreat === 'SUCCESS' || !validRound(o, r.playerCount)) return false; marks += o.sunflareUses; return o.groundScorchMarks === marks; }) || e.groundScorchMarks !== marks || last.unshadowedOutcome.enemyHealth !== enemy.health || last.unshadowedOutcome.enemyMind !== enemy.mind || last.unshadowedOutcome.enemyStatus !== enemy.status || enemy.weaponLocation !== (enemy.status === 'RESISTING' ? 'HAND' : 'COURTYARD')) return false;
  return e.status === 'RETREATED' ? last.retreat === 'SUCCESS' && last.winner === 'ENEMY' : e.status === 'LOST' ? s.status === 'DEAD' && last.winner === 'ENEMY' && last.retreat !== 'SUCCESS' : e.status === 'RESOLVED' && last.winner === 'PLAYER' && last.retreat === 'NONE' && enemy.status !== 'RESISTING';
}
function validRound(v: NonNullable<SliceState['combatHistory'][number]['unshadowedOutcome']>, playerCount: number): boolean { return !!v && v.enemyId === 'UD4-EDMUND' && integer(v.enemyHealth, 0, 100) && integer(v.enemyMind, 0, 100) && ['RESISTING', 'SURRENDERED', 'DEAD'].includes(v.enemyStatus) && (v.enemyStatus === 'DEAD') === (v.enemyHealth === 0) && [v.domainUses, v.purificationUses, v.sunflareUses].every(n => integer(n, 0, 6)) && v.domainUses + v.purificationUses + v.sunflareUses <= playerCount && integer(v.groundScorchMarks, v.sunflareUses); }
