import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { dismissIronBloodMembers, findIronBloodMember, hasIronBloodRite } from './team.js';
import { ironBloodInside } from './life.js';

export const IRON_BLOOD_COMPANION_IDS = ['IB4-01', 'IB4-02'] as const;
export const IRON_BLOOD_ENCOUNTER_STORY = '成年原看守加里克（38岁，IB4-GARRICK）在原训练场独立空石院因通行分歧挡路，持自己的唯一普通短棍IB4-GARRICK-CLUB。双方可见，距离2米；原施火通道与身后普通出口净空，不进入追逐。先实际交谈，再选择和平离开、独自迎战，或花1行动请已加入的原队员01/02自愿到场。其余28人不在场。火焰、钢铁形态和战友联系均是有限动作，不免疫伤害、不制造同伴、不给予序列3的军团强化。场景、成本与数值为本作原创G。';
export type IronBloodEncounterCommand = { type: 'ENCOUNTER_TALK' | 'CALL_COMPANIONS' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface IronBloodEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST';
  approachWeek: number | null; attemptWeek: number | null; startHistoryIndex: number | null;
  companionIds: string[]; linkedMemberIds: string[]; sharePolicy: 'HOLD' | 'SHARE_FIRST';
  enemy: { id: 'IB4-GARRICK'; name: '加里克'; age: 38; source: 'ORIGINAL_YARD_KEEPER';
    health: number; mind: number; status: 'RESISTING' | 'SURRENDERED' | 'DEAD';
    weaponId: 'IB4-GARRICK-CLUB'; weaponLocation: 'HAND' | 'YARD' };
  weakness: { sourceRound: number | null; available: boolean; observations: number; uses: number };
}
export interface IronBloodEncounterAction {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: IronBloodEncounterCommand;
}
export interface IronBloodEncounterProjection {
  title: string; story: string; status: string; enemy: IronBloodEncounterState['enemy'];
  companions: { id: string; name: string; health: number; energy: number; present: boolean; eligible: boolean }[];
  linkedMemberIds: string[]; inside: boolean; actions: IronBloodEncounterAction[];
}
export function createIronBloodEncounterState(): IronBloodEncounterState {
  return { status: 'AVAILABLE', approachWeek: null, attemptWeek: null, startHistoryIndex: null,
    companionIds: [], linkedMemberIds: [], sharePolicy: 'HOLD',
    enemy: { id: 'IB4-GARRICK', name: '加里克', age: 38, source: 'ORIGINAL_YARD_KEEPER', health: 100,
      mind: 100, status: 'RESISTING', weaponId: 'IB4-GARRICK-CLUB', weaponLocation: 'HAND' },
    weakness: { sourceRound: null, available: false, observations: 0, uses: 0 } };
}
export function validateIronBloodEncounterCommand(v: unknown): v is IronBloodEncounterCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 &&
    ['ENCOUNTER_TALK', 'CALL_COMPANIONS', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes((v as { type: string }).type);
}
export function isInsideIronBloodEncounter(s: SliceState): boolean {
  return s.ironBloodKnight?.encounter.status === 'READY' || s.ironBloodKnight?.encounter.status === 'FIGHTING';
}
function hasOpenPractice(s: SliceState): boolean {
  return ironBloodInside(s) || hasIronBloodRite(s) || Object.values(s.ironBloodKnight.life.cases).some(c => c.status === 'PREPARED');
}
export function canCallIronBloodMember(s: SliceState, id: string): boolean {
  const m = findIronBloodMember(s, id);
  return !!m && (IRON_BLOOD_COMPANION_IDS as readonly string[]).includes(id) && m.joined && m.willing &&
    m.health >= 80 && m.energy >= 8 && !m.present && m.location === 'HOME';
}
export function blockIronBloodEncounter(s: SliceState, c: IronBloodEncounterCommand): string | null {
  const e = s.ironBloodKnight.encounter;
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (s.progression.pathwayId !== 'hunter' || s.progression.sequence !== 4) return '先成为铁血骑士。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要在贝克兰德原训练场空石院。';
  if (hasOpenPractice(s) || s.ironBloodKnight.team.members.some(m => m.present && !e.companionIds.includes(m.id)) ||
      Object.values(s.reaper.cases).some(r => r.contactOpen || r.status === 'PREPARED' || r.practice.windowOpen) ||
      Object.values(s.conspirator.cases).some(r => r.contactOpen || r.status === 'PREPARED')) return '先收束真实练习、仪式集结或旧接触。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' ? null : '只有实际到场交谈后才能沿原出口离开。';
  if (s.actionsRemaining < 1) return '本次选择需要1行动。';
  if ((c.type === 'ENCOUNTER_TALK' || c.type === 'CALL_COMPANIONS') && s.actionsRemaining < 2) return '本次花费1行动，须另留1行动给明确开战选择；交谈、邀请两人、开战完整需要3行动。';
  if (c.type === 'ENCOUNTER_TALK') return e.status === 'AVAILABLE' ? null : '本段原冲突已交谈或已有结果，不重新生成加里克。';
  if (e.status !== 'READY') return '先实际交谈并确认原人、原短棍和净空出口。';
  if (c.type === 'CALL_COMPANIONS') {
    if (e.companionIds.length) return '同一原01/02已经实际受邀，不能重复召来或重置状态。';
    if (!IRON_BLOOD_COMPANION_IDS.every(id => canCallIronBloodMember(s, id))) return '原01/02都须已加入、自愿、在家，健康至少80且精力至少8；也可独自迎战。';
  }
  return null;
}
export function applyIronBloodEncounterCommand(s: SliceState, c: IronBloodEncounterCommand, ctx: SeerContext): void {
  const reason = blockIronBloodEncounter(s, c); if (reason) throw new Error(reason);
  const e = s.ironBloodKnight.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') {
    dismissIronBloodMembers(s, e.companionIds); e.linkedMemberIds = []; e.status = 'RESOLVED';
    ctx.note('沿原出口和平离开', '你接受加里克仍不让路，沿原净空出口离开。已到场队员实际返家，原健康与精力保留；原人和自己的原棍留在石院，本段争议不重开。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'ENCOUNTER_TALK') {
    e.status = 'READY'; e.approachWeek = s.week;
    ctx.note('与加里克实际交谈', `${IRON_BLOOD_ENCOUNTER_STORY}本次交谈花费1行动，仅确认分歧，未替你选择战斗。`); return;
  }
  if (c.type === 'CALL_COMPANIONS') {
    e.companionIds = [...IRON_BLOOD_COMPANION_IDS];
    for (const id of e.companionIds) { const m = findIronBloodMember(s, id)!; m.present = true; m.location = 'YARD'; }
    ctx.note('两名原队员实际到场', `${e.companionIds.map(id => findIronBloodMember(s, id)!.name).join('、')}答应来原空石院协助，花费1行动。只有这两人实际到场；健康、精力和旧经历不重置，每轮默认不分担伤害。`); return;
  }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'IRON_BLOOD_DISPUTE', round: 1, enemyHealth: e.enemy.health, enemyMind: e.enemy.mind,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('承担原空石院真实冲突', `${e.companionIds.length ? '两名受邀原队员在场' : '你独自迎战'}。双方沿用自己的原身体与原物，每轮伤势、死亡和撤退按共用战盘结算。`);
}
export function hasIronBloodDisputeOpponent(s: SliceState): boolean {
  const e = s.ironBloodKnight?.encounter, c = s.combat;
  return s.progression.pathwayId === 'hunter' && s.progression.sequence === 4 && s.status === 'ACTIVE' &&
    s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && !hasOpenPractice(s) &&
    !!e && e.status === 'FIGHTING' && e.enemy.id === 'IB4-GARRICK' && e.enemy.source === 'ORIGINAL_YARD_KEEPER' &&
    e.enemy.status === 'RESISTING' && e.enemy.weaponId === 'IB4-GARRICK-CLUB' && e.enemy.weaponLocation === 'HAND' &&
    !!c && c.encounterId === 'IRON_BLOOD_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 &&
    e.enemy.health === c.enemyHealth && e.enemy.mind === c.enemyMind && e.attemptWeek === s.week &&
    Number.isSafeInteger(c.round) && c.round >= 1 && e.startHistoryIndex !== null && Number.isSafeInteger(e.startHistoryIndex) &&
    e.startHistoryIndex >= 0 && s.combatHistory.length - e.startHistoryIndex === c.round - 1 &&
    s.combatHistory.slice(e.startHistoryIndex).every((r, i) => r.round === i + 1 && r.retreat !== 'SUCCESS');
}
export function settleIronBloodEncounter(s: SliceState, outcome: string, ctx: SeerContext): void {
  const e = s.ironBloodKnight.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || !c || c.encounterId !== 'IRON_BLOOD_DISPUTE' ||
      !['CONTINUE', 'PLAYER_DEAD', 'ENEMY_DEAD', 'ENEMY_SURRENDERED', 'RETREATED'].includes(outcome)) throw new Error('没有对应的铁血骑士原空石院战斗结果。');
  if (outcome === 'CONTINUE') return;
  if (e.startHistoryIndex === null || !c.lastRound || s.combatHistory.length - e.startHistoryIndex !== c.lastRound.round ||
      s.combatHistory.at(-1)?.ironBloodOutcome?.enemyId !== 'IB4-GARRICK' ||
      (outcome === 'PLAYER_DEAD' && s.health !== 0) || (outcome === 'RETREATED' && c.lastRound.retreat !== 'SUCCESS') ||
      (outcome === 'ENEMY_DEAD' && (c.enemyHealth !== 0 || c.enemyStatus !== 'DEAD')) ||
      (outcome === 'ENEMY_SURRENDERED' && (c.enemyHealth <= 0 || c.enemyStatus !== 'SURRENDERED'))) throw new Error('原身体结果与当前回合不符。');
  e.enemy.health = c.enemyHealth; e.enemy.mind = c.enemyMind; e.enemy.status = c.enemyStatus;
  if (c.enemyStatus !== 'RESISTING') e.enemy.weaponLocation = 'YARD';
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED';
  e.linkedMemberIds = []; e.weakness.available = false; e.weakness.sourceRound = null;
  dismissIronBloodMembers(s, e.companionIds); s.combat = null;
  ctx.note('原空石院冲突收束', outcome === 'PLAYER_DEAD'
    ? '你已在真实战斗中死亡，战友联系没有替死。到场原队员解除联系并实际返家，各自已付健康和精力保留。'
    : `${outcome === 'RETREATED' ? '你沿原普通出口退出，没有追逐、瞬移或夺棍' : outcome === 'ENEMY_DEAD' ? '加里克真实死亡，原尸体与自己的原棍留在石院' : '加里克仍活着，自行停止抵抗并放下自己的原棍'}。原队员解除联系、沿原路返家，健康与精力保留，不治疗、不补灵性、不生成新成员或战斗奖励。`);
}
export function ironBloodEncounterActions(s: SliceState): IronBloodEncounterAction[] {
  return ([['ENCOUNTER_TALK', '前往原空石院交谈', '1行动，另留开战1行动'], ['CALL_COMPANIONS', '邀请原队员01/02实际到场', '1行动，另留开战1行动'],
    ['ENCOUNTER_FIGHT', '承担真实战斗', '1行动'], ['LEAVE_ENCOUNTER', '和平离开并送队员返家', '0行动']] as const).map(([type, label, cost]) => {
    const command = { type }, reason = blockIronBloodEncounter(s, command);
    return { id: `iron-blood-${type}`, label, cost, enabled: reason === null, reason, command };
  });
}
export function projectIronBloodEncounter(s: SliceState): IronBloodEncounterProjection {
  const e = s.ironBloodKnight.encounter;
  return { title: '原空石院的可选冲突', story: IRON_BLOOD_ENCOUNTER_STORY, status: e.status,
    enemy: { ...e.enemy }, linkedMemberIds: [...e.linkedMemberIds], inside: isInsideIronBloodEncounter(s),
    companions: IRON_BLOOD_COMPANION_IDS.map(id => { const m = findIronBloodMember(s, id)!;
      return { id, name: m.name, health: m.health, energy: m.energy, present: isInsideIronBloodEncounter(s) && e.companionIds.includes(id) && m.present && m.location === 'YARD', eligible: canCallIronBloodMember(s, id) }; }),
    actions: ironBloodEncounterActions(s) };
}
const integer = (n: unknown, max: number) => Number.isSafeInteger(n) && (n as number) >= 0 && (n as number) <= max;
export function validateIronBloodEncounter(s: SliceState): boolean {
  const e = s.ironBloodKnight.encounter; if (!e || !e.enemy || !e.weakness) return false;
  const enemy = e.enemy, w = e.weakness;
  const shape = (v: object, keys: string[]) => Object.keys(v).sort().join('|') === keys.sort().join('|');
  if (!shape(e, ['status', 'approachWeek', 'attemptWeek', 'startHistoryIndex', 'companionIds', 'linkedMemberIds', 'sharePolicy', 'enemy', 'weakness']) ||
      !shape(enemy, ['id', 'name', 'age', 'source', 'health', 'mind', 'status', 'weaponId', 'weaponLocation']) ||
      !shape(w, ['sourceRound', 'available', 'observations', 'uses'])) return false;
  const promotion = s.ironBloodKnight.promotionWeek;
  if (e.status !== 'AVAILABLE' && (promotion === null || s.progression.pathwayId !== 'hunter' || ![4,3,2].includes(s.progression.sequence??0) ||
      e.approachWeek === null || e.approachWeek < promotion || e.attemptWeek !== null && e.attemptWeek < promotion)) return false;
  if (!['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) ||
      enemy.id !== 'IB4-GARRICK' || enemy.name !== '加里克' || enemy.age !== 38 || enemy.source !== 'ORIGINAL_YARD_KEEPER' ||
      enemy.weaponId !== 'IB4-GARRICK-CLUB' || !['HAND', 'YARD'].includes(enemy.weaponLocation) ||
      !integer(enemy.health, 100) || !integer(enemy.mind, 100) || !['RESISTING', 'SURRENDERED', 'DEAD'].includes(enemy.status) ||
      ((enemy.status === 'DEAD') !== (enemy.health === 0)) ||
      !['HOLD', 'SHARE_FIRST'].includes(e.sharePolicy) ||
      !Array.isArray(e.companionIds) || !Array.isArray(e.linkedMemberIds) || new Set(e.companionIds).size !== e.companionIds.length ||
      new Set(e.linkedMemberIds).size !== e.linkedMemberIds.length || e.companionIds.some(id => !(IRON_BLOOD_COMPANION_IDS as readonly string[]).includes(id)) ||
      e.linkedMemberIds.some(id => !e.companionIds.includes(id) || !findIronBloodMember(s, id)?.present) ||
      !integer(w.observations, Number.MAX_SAFE_INTEGER) || !integer(w.uses, w.observations) || typeof w.available !== 'boolean' ||
      (w.available ? w.sourceRound === null || !integer(w.sourceRound, s.combat?.round ?? 0) || w.sourceRound < 1 || w.observations <= w.uses : w.sourceRound !== null) ||
      [e.approachWeek, e.attemptWeek].some(n => n !== null && !integer(n, s.week))) return false;
  if (e.status === 'FIGHTING') return hasIronBloodDisputeOpponent(s) && (!w.available || s.combat!.round <= w.sourceRound! + 1);
  if (s.combat?.encounterId === 'IRON_BLOOD_DISPUTE' || e.linkedMemberIds.length || w.available) return false;
  if (e.status === 'AVAILABLE') return e.approachWeek === null && e.attemptWeek === null && e.startHistoryIndex === null && !e.companionIds.length && enemy.health === 100 && enemy.mind === 100 && enemy.status === 'RESISTING';
  if (e.approachWeek === null) return false;
  if (e.status === 'READY') return e.startHistoryIndex === null && e.attemptWeek === null && enemy.health === 100 && enemy.status === 'RESISTING' &&
    e.companionIds.every(id => { const m = findIronBloodMember(s, id); return m?.joined && m.willing && m.present && m.location === 'YARD'; });
  if (e.startHistoryIndex === null) return e.status === 'RESOLVED' && e.attemptWeek === null && enemy.health === 100 && enemy.status === 'RESISTING';
  if (!integer(e.startHistoryIndex, s.combatHistory.length - 1) || e.attemptWeek === null) return false;
  const rounds = s.combatHistory.slice(e.startHistoryIndex), next = rounds.findIndex((r, i) => i > 0 && r.round === 1);
  const own = next < 0 ? rounds : rounds.slice(0, next), last = own.at(-1);
  if (!last?.ironBloodOutcome || !own.every((r, i) => r.round === i + 1 && r.ironBloodOutcome?.enemyId === 'IB4-GARRICK') ||
      last.ironBloodOutcome.enemyHealth !== enemy.health || last.ironBloodOutcome.enemyMind !== enemy.mind || last.ironBloodOutcome.enemyStatus !== enemy.status) return false;
  return e.status === 'RETREATED' ? last.retreat === 'SUCCESS' : e.status === 'LOST' ? s.status === 'DEAD' && last.winner === 'ENEMY'
    : e.status === 'RESOLVED' && last.winner === 'PLAYER' && enemy.status !== 'RESISTING';
}
