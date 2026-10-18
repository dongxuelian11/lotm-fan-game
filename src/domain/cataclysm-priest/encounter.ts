import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasCataclysmPriestLifeLock } from './life.js';

export const CATACLYSM_PRIEST_ENCOUNTER_STORY = '成年普通码头看守本尼迪克特·维尔（48岁，CP4-BENEDICT）持有自己的唯一普通短棍CP4-BENEDICT-CLUB，因原通路分歧挡路。他是原普通人，不获赠非凡能力。双方可见相隔2米，原石码头空场与普通干燥出口净空，原旁观者确实不在场，邻接一段真实空海水带。先1行动交谈，另留1行动决定是否开战，可0行动和平离开，无追逐。有限海水龙卷必须有当前真实海水，5灵性/知识16；继承控风4灵性/意志16；强雷6灵性/意志18；有限涌浪5灵性/意志16也须实际海水，失败照耗。风、水、雷不保证必中，不自动排除同伴或环境；本次净空只是具体场景。人物、物件、尺度与数值均为原创G。';
export type CataclysmPriestEncounterCommand = { type: 'ENCOUNTER_TALK' } | { type: 'ENCOUNTER_FIGHT' } | { type: 'LEAVE_ENCOUNTER' };
export interface CataclysmPriestEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
  waterSource: 'SEAWATER' | 'NONE'; approachWeek: number | null; attemptWeek: number | null; startHistoryIndex: number | null;
  enemy: { id: 'CP4-BENEDICT'; name: '本尼迪克特·维尔'; age: 48; source: 'ORIGINAL_QUAY_ADULT';
    health: number; mind: number; status: 'RESISTING' | 'SURRENDERED' | 'DEAD';
    weaponId: 'CP4-BENEDICT-CLUB'; weaponLocation: 'HAND' | 'QUAY' };
}
export interface CataclysmPriestEncounterAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: CataclysmPriestEncounterCommand }
export interface CataclysmPriestEncounterProjection { title: string; story: string; status: string; enemy: CataclysmPriestEncounterState['enemy']; waterSource: 'SEAWATER' | 'NONE'; inside: boolean; actions: CataclysmPriestEncounterAction[] }
export function createCataclysmPriestEncounterState(): CataclysmPriestEncounterState {
  return { status: 'AVAILABLE', waterSource: 'SEAWATER', approachWeek: null, attemptWeek: null, startHistoryIndex: null,
    enemy: { id: 'CP4-BENEDICT', name: '本尼迪克特·维尔', age: 48, source: 'ORIGINAL_QUAY_ADULT', health: 100, mind: 100, status: 'RESISTING', weaponId: 'CP4-BENEDICT-CLUB', weaponLocation: 'HAND' } };
}
export function validateCataclysmPriestEncounterCommand(v: unknown): v is CataclysmPriestEncounterCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes((v as { type: string }).type);
}
export const isCataclysmPriestEncounterCommand = validateCataclysmPriestEncounterCommand;
export const hasCataclysmPriestEncounterLock = (s: SliceState): boolean => ['READY', 'FIGHTING'].includes(s.cataclysmPriest.encounter.status);
export const isInsideCataclysmPriestEncounter = hasCataclysmPriestEncounterLock;
const openPractice = (s: SliceState) => hasCataclysmPriestLifeLock(s) || Object.values(s.cataclysmPriest.life.cases).some(r => r.status === 'PREPARED');
export function blockCataclysmPriestEncounter(s: SliceState, c: CataclysmPriestEncounterCommand): string | null {
  if (!validateCataclysmPriestEncounterCommand(c)) return '灾难主祭遭遇命令无效。';
  if (s.status !== 'ACTIVE' || s.progression.pathwayId !== 'tyrant' || s.progression.sequence !== 4) return '须仍活着并已经成为灾难主祭。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际来到贝克兰德原石码头空场。';
  if (openPractice(s) || oldOceanOpen(s) || s.cataclysmPriest.ritual.playerLocation === 'PLATFORM') return '先实际收束原实践湾、旧海洋歌者原现场并离开仪式平台。';
  const e = s.cataclysmPriest.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' ? null : '须先实际到场，才能沿原出口和平离开。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神；已有交谈仍可0行动和平退出。';
  if (s.actionsRemaining < (c.type === 'ENCOUNTER_TALK' ? 2 : 1)) return c.type === 'ENCOUNTER_TALK' ? '交谈需1行动，须另留1行动给明确开战选择。' : '开战需要1行动。';
  if (c.type === 'ENCOUNTER_TALK') return e.status === 'AVAILABLE' ? null : '本段原冲突已有进展或结果，不重新生成本尼迪克特·维尔。';
  return e.status === 'READY' ? null : '先实际交谈，确认原人、原棍和普通出口。';
}
export function applyCataclysmPriestEncounter(s: SliceState, c: CataclysmPriestEncounterCommand, ctx: SeerContext): void {
  const reason = blockCataclysmPriestEncounter(s, c); if (reason) throw new Error(reason);
  const e = s.cataclysmPriest.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') { e.status = 'RESOLVED'; ctx.note('沿原出口和平离开', '你接受本尼迪克特·维尔仍不让路，沿净空原出口离开；原人和自己的原短棍留在原石码头，争议结束，不强制战斗或发放战斗奖励。'); return; }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') { e.status = 'READY'; e.approachWeek = s.week; ctx.note('与原本尼迪克特·维尔实际交谈', CATACLYSM_PRIEST_ENCOUNTER_STORY + '本次只确认真实分歧，没有替你开战。'); return; }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'CATACLYSM_PRIEST_DISPUTE', round: 1, enemyHealth: e.enemy.health, enemyMind: e.enemy.mind,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('承担原石码头空场真实冲突', '你和原本尼迪克特·维尔在原2米通路交战。他持自己的CP4-BENEDICT-CLUB，原普通出口净空且没有追随者。风、水、雷只在抽中槽位且资源与真实来源足够时尝试，不保证获胜；真实伤势、投降、死亡和撤退由共同战盘结算。');
}
export const applyCataclysmPriestEncounterCommand = applyCataclysmPriestEncounter;
export function hasCataclysmPriestDisputeOpponent(s: SliceState): boolean {
  const e = s.cataclysmPriest?.encounter, c = s.combat;
  return s.progression.pathwayId === 'tyrant' && s.progression.sequence === 4 && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && !openPractice(s) && s.cataclysmPriest.ritual.playerLocation !== 'PLATFORM' && !oldOceanOpen(s) &&
    !!e && ['SEAWATER', 'NONE'].includes(e.waterSource) && e.status === 'FIGHTING' && e.enemy.id === 'CP4-BENEDICT' && e.enemy.source === 'ORIGINAL_QUAY_ADULT' && e.enemy.status === 'RESISTING' && e.enemy.weaponId === 'CP4-BENEDICT-CLUB' && e.enemy.weaponLocation === 'HAND' &&
    !!c && c.encounterId === 'CATACLYSM_PRIEST_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 && e.enemy.health === c.enemyHealth && e.enemy.mind === c.enemyMind && e.attemptWeek === s.week &&
    Number.isSafeInteger(c.round) && c.round >= 1 && e.startHistoryIndex !== null && Number.isSafeInteger(e.startHistoryIndex) && e.startHistoryIndex >= 0 && s.combatHistory.length - e.startHistoryIndex === c.round - 1 &&
    s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.retreat !== 'SUCCESS' && r.cataclysmPriestOutcome?.enemyId === 'CP4-BENEDICT' && validRound(r.cataclysmPriestOutcome, r.playerCount));
}
export function settleCataclysmPriestEncounter(s: SliceState, outcome: string, ctx: SeerContext): void {
  const e = s.cataclysmPriest.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || !c || c.encounterId !== 'CATACLYSM_PRIEST_DISPUTE' || !['CONTINUE', 'PLAYER_DEAD', 'ENEMY_DEAD', 'ENEMY_SURRENDERED', 'RETREATED'].includes(outcome)) throw new Error('没有对应的灾难主祭原码头战斗结果。');
  if (outcome === 'CONTINUE') return;
  if (e.startHistoryIndex === null || !c.lastRound || c.round !== c.lastRound.round + 1 || s.combatHistory.length - e.startHistoryIndex !== c.lastRound.round || s.combatHistory.at(-1)?.cataclysmPriestOutcome?.enemyId !== 'CP4-BENEDICT' ||
    (outcome === 'PLAYER_DEAD' && (s.health !== 0 || c.lastRound.winner !== 'ENEMY')) || (outcome === 'RETREATED' && (c.lastRound.retreat !== 'SUCCESS' || s.health <= 0)) ||
    (outcome === 'ENEMY_DEAD' && (c.enemyHealth !== 0 || c.enemyStatus !== 'DEAD' || c.lastRound.winner !== 'PLAYER')) || (outcome === 'ENEMY_SURRENDERED' && (c.enemyHealth <= 0 || c.enemyStatus !== 'SURRENDERED' || c.lastRound.winner !== 'PLAYER'))) throw new Error('真实原身体结果与当前已保存回合不符。');
  e.enemy.health = c.enemyHealth; e.enemy.mind = c.enemyMind; e.enemy.status = c.enemyStatus;
  if (c.enemyStatus !== 'RESISTING') e.enemy.weaponLocation = 'QUAY';
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  s.combat = null;
  ctx.note('原石码头空场冲突结束', (outcome === 'PLAYER_DEAD' ? '你真实死亡，原身体留在原石码头；有限风、水、雷不豁免死亡。' : outcome === 'RETREATED' ? '本人沿净空原普通出口实际离开，无追逐、瞬移或夺棍。' : outcome === 'ENEMY_DEAD' ? '原本尼迪克特·维尔真实死亡，原尸体与自己的原短棍留在原石码头。' : '原本尼迪克特·维尔仍活着，自行停止抵抗，把自己的原棍放在原石码头。') + '原健康与伤势、已付灵性与实际海水来源历史保留，不治疗、不复活、不生成新目标。');
}
export function cataclysmPriestEncounterActions(s: SliceState): CataclysmPriestEncounterAction[] {
  if (s.progression.pathwayId !== 'tyrant' || s.progression.sequence !== 4) return [];
  return ([['ENCOUNTER_TALK', '前往原石码头空场交谈', '1行动 · 另留开战1行动'], ['ENCOUNTER_FIGHT', '承担原本尼迪克特·维尔的真实冲突', '1行动 · 可真实受伤或死亡'], ['LEAVE_ENCOUNTER', '沿原出口和平离开', '0行动']] as const).map(([type, label, cost]) => { const command: CataclysmPriestEncounterCommand = { type }, reason = blockCataclysmPriestEncounter(s, command); return { id: `cataclysmPriest-${type}`, label, cost, enabled: reason === null, reason, command }; });
}
export function projectCataclysmPriestEncounter(s: SliceState): CataclysmPriestEncounterProjection {
  const e = s.cataclysmPriest.encounter; return { title: '原石码头空场的可选争议', story: CATACLYSM_PRIEST_ENCOUNTER_STORY, status: e.status, enemy: { ...e.enemy }, waterSource: e.waterSource, inside: hasCataclysmPriestEncounterLock(s), actions: cataclysmPriestEncounterActions(s) };
}
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
export function validateCataclysmPriestEncounter(s: SliceState): boolean {
  const e = s.cataclysmPriest?.encounter, initial = createCataclysmPriestEncounterState(); if (!e || !e.enemy || !shape(e, Object.keys(initial)) || !shape(e.enemy, Object.keys(initial.enemy))) return false;
  const enemy = e.enemy, p = s.cataclysmPriest.promotionWeek;
  if (!['SEAWATER', 'NONE'].includes(e.waterSource) || !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || enemy.id !== initial.enemy.id || enemy.name !== initial.enemy.name || enemy.age !== 48 || enemy.source !== initial.enemy.source || enemy.weaponId !== initial.enemy.weaponId || !['HAND', 'QUAY'].includes(enemy.weaponLocation) || !integer(enemy.health, 0, 100) || !integer(enemy.mind, 0, 100) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(enemy.status) || (enemy.status === 'DEAD') !== (enemy.health === 0) || [e.approachWeek, e.attemptWeek].some(w => w !== null && !integer(w, 1, s.week))) return false;
  if (e.status === 'AVAILABLE') return stableStringify(e) === stableStringify(initial) && s.combat?.encounterId !== 'CATACLYSM_PRIEST_DISPUTE';
  if (p === null || s.progression.pathwayId !== 'tyrant' || ![4,3,2].includes(s.progression.sequence??0) || e.approachWeek === null || e.approachWeek < p || e.attemptWeek !== null && e.attemptWeek < e.approachWeek) return false;
  if (e.status === 'FIGHTING') return hasCataclysmPriestDisputeOpponent(s);
  if (s.combat?.encounterId === 'CATACLYSM_PRIEST_DISPUTE') return false;
  if (e.status === 'READY') return e.attemptWeek === null && e.startHistoryIndex === null && stableStringify(enemy) === stableStringify(initial.enemy);
  if (e.startHistoryIndex === null) return e.status === 'RESOLVED' && e.attemptWeek === null && stableStringify(enemy) === stableStringify(initial.enemy);
  if (!integer(e.startHistoryIndex, 0, s.combatHistory.length - 1) || e.attemptWeek === null) return false;
  const rounds = s.combatHistory.slice(e.startHistoryIndex), next = rounds.findIndex((r, i) => i > 0 && r.round === 1), own = next < 0 ? rounds : rounds.slice(0, next), last = own.at(-1);
  if (!last?.cataclysmPriestOutcome || !own.every((r, i) => r.round === i + 1 && r.cataclysmPriestOutcome?.enemyId === 'CP4-BENEDICT' && validRound(r.cataclysmPriestOutcome, r.playerCount)) || last.cataclysmPriestOutcome.enemyHealth !== enemy.health || last.cataclysmPriestOutcome.enemyMind !== enemy.mind || last.cataclysmPriestOutcome.enemyStatus !== enemy.status) return false;
  return e.status === 'RETREATED' ? last.retreat === 'SUCCESS' : e.status === 'LOST' ? s.status === 'DEAD' && last.winner === 'ENEMY' : e.status === 'RESOLVED' && last.winner === 'PLAYER' && enemy.status !== 'RESISTING';
}

function oldOceanOpen(s: SliceState): boolean { return s.oceanSinger.ritual.location !== 'DOCK' || s.oceanSinger.practice.songOpen || s.oceanSinger.practice.allyAffected || s.oceanSinger.practice.allyPosition !== 'NEAR' || Object.values(s.oceanSinger.cases).some(r => r.contactOpen || r.status === 'PREPARED'); }
function validRound(v: NonNullable<SliceState['combatHistory'][number]['cataclysmPriestOutcome']>, playerCount: number): boolean { return !!v && v.enemyId === 'CP4-BENEDICT' && ['SEAWATER', 'NONE'].includes(v.waterSource) && [v.windUses, v.waveUses, v.lightningUses].every(n => integer(n, 0, 6)) && v.windUses + v.waveUses + v.lightningUses <= playerCount && (v.waterSource !== 'NONE' || v.waveUses === 0); }
