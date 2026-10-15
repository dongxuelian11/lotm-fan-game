import { stableStringify } from '../canonical.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceInjury, SliceState } from '../slice/types.js';
import { findIronBloodMember, hasIronBloodRite } from '../iron-blood-knight/team.js';
import { ironBloodInside } from '../iron-blood-knight/life.js';
import { WEATHER_WARLOCK_MEMBER_IDS, arriveWeatherWarlockMembers, dismissWeatherWarlockMembers, blockWeatherWarlockTeamInvite, hasWeatherWarlockLifeLock } from './life.js';
import { validateWeatherWarlockRoundOutcome, validWeatherWarlockWeakness, validWeatherWarlockTerrain, type WeatherWarlockPolicy, type WeatherWarlockRoundOutcome } from './combat.js';
import type { WeatherWarlockAction } from './types.js';

export const WEATHER_WARLOCK_TARGET_ID = 'WW2-ORREN-VOSS' as const;
export const WEATHER_WARLOCK_POWER_IDS = ['LIGHTNING', 'WIND_SCREEN', 'COMPOSE'] as const;
export type WeatherWarlockPowerId = typeof WEATHER_WARLOCK_POWER_IDS[number];
export type WeatherWarlockEnemyIntent = WeatherWarlockPowerId | 'BODY_STRIKE' | 'ACCIDENT';
export const WEATHER_WARLOCK_POWERS = [
  { id: 'LIGHTNING', label: '原有限雷击（G）', cost: 8, selfGain: 95, enemyReduction: 0 },
  { id: 'WIND_SCREEN', label: '原有限风幕（G）', cost: 6, selfGain: 0, enemyReduction: 55 },
  { id: 'COMPOSE', label: '普通整理原棍姿势（G）', cost: 0, selfGain: 0, enemyReduction: 0 },
] as const;
export interface WeatherWarlockWeakness { sourceRound: number | null; available: boolean; observations: number; uses: number }
export interface WeatherWarlockEncounterTerminal {
  outcome: 'PLAYER_DEAD' | 'RETREATED' | 'ENEMY_DEAD' | 'ENEMY_SURRENDERED'; round: number; historyIndex: number;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
}
export interface WeatherWarlockEncounterState {
  status: 'AVAILABLE' | 'READY' | 'FIGHTING' | 'RESOLVED' | 'RETREATED' | 'LOST'; targetId: typeof WEATHER_WARLOCK_TARGET_ID;
  approachWeek: number | null; invitedWeek: number | null; attemptWeek: number | null; startHistoryIndex: number | null;
  companionIds: string[]; linkedMemberIds: string[]; policy: WeatherWarlockPolicy;
  enemyHealth: number; enemyMind: number; enemySpirituality: number; enemyStatus: 'RESISTING' | 'SURRENDERED' | 'DEAD';
  weaponLocation: 'HAND' | 'YARD'; enemyInjuries: SliceInjury[]; enemyRisk: number; powerUses: Record<WeatherWarlockPowerId, number>;
  terrain: { waterLitres: number; wet: boolean; fixtureDamage: number; weatherUses: { FOG: number; FROST: number; STORM: number } };
  weakness: WeatherWarlockWeakness; terminal: WeatherWarlockEncounterTerminal | null;
}
export type WeatherWarlockEncounterCommand = { type: 'ENCOUNTER_TALK' | 'CALL_COMPANIONS' | 'ENCOUNTER_FIGHT' | 'LEAVE_ENCOUNTER' };
export interface WeatherWarlockEncounterProjection {
  title: string; story: string; status: WeatherWarlockEncounterState['status'];
  enemy: { id: typeof WEATHER_WARLOCK_TARGET_ID; name: string; age: 49; sequence: 2; health: number; mind: number; spirituality: number;
    status: WeatherWarlockEncounterState['enemyStatus']; weaponId: 'WW2-ORREN-CLUB'; weaponLocation: 'HAND' | 'YARD'; powerUses: Record<WeatherWarlockPowerId, number> };
  companions: { id: string; name: string; health: number; energy: number; present: boolean; eligible: boolean; willing: boolean }[];
  linkedMemberIds: string[]; policy: WeatherWarlockPolicy; inside: boolean; actions: WeatherWarlockAction[]; facts: string[];
}
export const WEATHER_WARLOCK_ENCOUNTER_STORY = '原创成年非凡者奥伦·沃斯（49岁，WW2-ORREN-VOSS，有限G2等效对手）在原训练场另一独立蓄水石院因通行争议挡路，持自己的唯一普通短棍WW2-ORREN-CLUB。本人和原对手相距2米，原五位队友若本次受邀才实际在6米内，未邀请时仍在家；空院无其他旁人，原施火通道与普通出口净空、无追逐。先真实交谈，可和平退出或承担实际战斗。原奥伦有独立H100/M100/S120，自己的有限雷击实耗8S贡献95G、风幕实耗6S减势55G；灵性不足只用自己的原棍20×身体G，不自动补充。这些为原创有限G术式与预算，并非已核原著初晋天气术士2模板；不把普通看守说成施法者、不复活旧加里克或塞德里克。双方保既有六槽、1250/底125/灵性120有限基础，原伤势、投降和死亡照常。';
export function createWeatherWarlockEncounterState(): WeatherWarlockEncounterState {
  return { status: 'AVAILABLE', targetId: WEATHER_WARLOCK_TARGET_ID, approachWeek: null, invitedWeek: null, attemptWeek: null, startHistoryIndex: null,
    companionIds: [], linkedMemberIds: [], policy: 'HOLD', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, enemyStatus: 'RESISTING',
    weaponLocation: 'HAND', enemyInjuries: [], enemyRisk: 0, powerUses: { LIGHTNING: 0, WIND_SCREEN: 0, COMPOSE: 0 },
    terrain: { waterLitres: 40, wet: false, fixtureDamage: 0, weatherUses: {FOG:0,FROST:0,STORM:0} },
    weakness: { sourceRound: null, available: false, observations: 0, uses: 0 }, terminal: null };
}
const stage = (s: SliceState) => s.progression.pathwayId === 'hunter' && s.progression.sequence === 2;
export function validateWeatherWarlockEncounterCommand(v: unknown): v is WeatherWarlockEncounterCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 &&
    ['ENCOUNTER_TALK', 'CALL_COMPANIONS', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(String((v as { type?: unknown }).type));
}
export function isInsideWeatherWarlockEncounter(s: SliceState): boolean { return ['READY', 'FIGHTING'].includes(s.weatherWarlock.encounter.status); }
export const hasWeatherWarlockEncounterLock = isInsideWeatherWarlockEncounter;
function otherSceneOpen(s: SliceState): boolean {
  return s.weatherWarlock.preparedWeek !== null || hasWeatherWarlockLifeLock(s) || ironBloodInside(s) || hasIronBloodRite(s) ||
    Object.values(s.ironBloodKnight.life.cases).some(c => c.contactOpen || c.status === 'PREPARED') ||
    ['READY', 'FIGHTING'].includes(s.ironBloodKnight.encounter.status) ||
    Object.values(s.reaper.cases).some(c => c.contactOpen || c.status === 'PREPARED' || c.practice.windowOpen) ||
    Object.values(s.conspirator.cases).some(c => c.contactOpen || c.status === 'PREPARED');
}
export function canCallWeatherWarlockMember(s: SliceState, id: string): boolean {
  const m = findIronBloodMember(s, id);
  return !!m && (WEATHER_WARLOCK_MEMBER_IDS as readonly string[]).includes(id) && m.joined && m.willing && m.health >= 50 && m.energy >= 6 && !m.present && m.location === 'HOME';
}
export function blockWeatherWarlockEncounter(s: SliceState, c: WeatherWarlockEncounterCommand): string | null {
  if (!validateWeatherWarlockEncounterCommand(c)) return '天气术士遭遇命令无效。';
  const e = s.weatherWarlock.encounter;
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0 || !stage(s)) return '须本人仍活着并已成为天气术士2。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德原训练场独立石院。';
  if (otherSceneOpen(s) || s.ironBloodKnight.team.members.some(m => m.present && !e.companionIds.includes(m.id))) return '先收束原物、真实练习、晋升准备或其他人员集结。';
  if (c.type === 'LEAVE_ENCOUNTER') return e.status === 'READY' ? null : '先实际到原院交谈，才能沿原普通出口离开。';
  if (s.actionsRemaining < 1) return '需要1行动。';
  if ((c.type === 'ENCOUNTER_TALK' || c.type === 'CALL_COMPANIONS') && s.actionsRemaining < 2) return '本次1行动，须另留1行动给明确开战；也可和平离开。';
  if (c.type === 'ENCOUNTER_TALK') return e.status === 'AVAILABLE' ? null : '同一原争议已有交谈或结局，不重开、不复制原人。';
  if (e.status !== 'READY') return '先实际交谈，确认同一原人、原棍、有限术式与普通出口。';
  if (c.type === 'CALL_COMPANIONS') {
    if (e.invitedWeek !== null || e.companionIds.length) return '原五人已实际受邀，不能重复邀请或重置健康、精力。';
    const reason = blockWeatherWarlockTeamInvite(s); if (reason) return reason;
    if (!WEATHER_WARLOCK_MEMBER_IDS.every(id => canCallWeatherWarlockMember(s, id))) return '原01～05须全部已加入、当前自愿、在家，健康至少50且精力至少6；也可独自迎战或和平离开。';
    if (s.cash < 40) return '本次实际邀请需40便士，不凭旧邀请记录让成员在场。';
  }
  return null;
}
export const weatherWarlockEncounterReason = blockWeatherWarlockEncounter;
export function applyWeatherWarlockEncounterCommand(s: SliceState, c: WeatherWarlockEncounterCommand, ctx: SeerContext): void {
  const reason = blockWeatherWarlockEncounter(s, c); if (reason) throw new Error(reason);
  const e = s.weatherWarlock.encounter;
  if (c.type === 'LEAVE_ENCOUNTER') {
    if (e.companionIds.length) dismissWeatherWarlockMembers(s); e.status = 'RESOLVED'; e.linkedMemberIds = [];
    ctx.note('沿原普通出口和平离开', '你接受奥伦仍不让路，沿本场原净空出口离开；没有追逐、战斗或奖励。实际受邀原队友沿原路返家，原H/E不恢复，旧加里克与原棍结局不变。'); return;
  }
  s.actionsRemaining--;
  if (c.type === 'ENCOUNTER_TALK') { e.status = 'READY'; e.approachWeek = s.week; ctx.note('与同一原奥伦实际交谈', `${WEATHER_WARLOCK_ENCOUNTER_STORY}本次实付1行动，仅确认分歧，没有替你选择开战。`); return; }
  if (c.type === 'CALL_COMPANIONS') {
    s.cash -= 40; arriveWeatherWarlockMembers(s); e.companionIds = [...WEATHER_WARLOCK_MEMBER_IDS]; e.invitedWeek = s.week;
    ctx.note('原第一组五位同伴本次实际到场', '实付1行动、40便士；原艾达、本尼特、克拉拉、德里克、艾琳自愿从各自原家来到本场石院YARD。原H/E、旧共同经历与既有身份完整保留，其余25人仍在家；默认未联结，不授予新职业或法术。'); return;
  }
  e.status = 'FIGHTING'; e.attemptWeek = s.week; e.startHistoryIndex = s.combatHistory.length;
  s.combat = { encounterId: 'WEATHER_WARLOCK_DISPUTE', round: 1, enemyHealth: e.enemyHealth, enemyMind: e.enemyMind,
    enemyInjuries: structuredClone(e.enemyInjuries), enemyRisk: e.enemyRisk, enemyStatus: 'RESISTING', lastRound: null };
  ctx.note('承担同一新原人的真实冲突', `${e.companionIds.length ? '本次实际受邀的原五人仍在6米内' : '没有重新邀请原队，你独自迎战'}；玩家和奥伦各用自己的原身体、原物和独立灵性。普通退路仍开放，真实伤势、投降和死亡由共用战盘结算。`);
}
export const applyWeatherWarlockEncounter = applyWeatherWarlockEncounterCommand;
export function hasWeatherWarlockDisputeOpponent(s: SliceState): boolean {
  const e = s.weatherWarlock?.encounter, c = s.combat;
  return stage(s) && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0 && !s.activeEvent && s.world.city === 'BACKLUND' && !otherSceneOpen(s) &&
    !!e && e.status === 'FIGHTING' && e.targetId === WEATHER_WARLOCK_TARGET_ID && e.terminal === null && e.enemyStatus === 'RESISTING' && e.weaponLocation === 'HAND' && e.approachWeek !== null && e.attemptWeek === s.week &&
    c?.encounterId === 'WEATHER_WARLOCK_DISPUTE' && c.enemyStatus === 'RESISTING' && c.enemyHealth > 0 && c.enemyMind > 0 && e.enemyHealth === c.enemyHealth && e.enemyMind === c.enemyMind &&
    stableStringify(e.enemyInjuries) === stableStringify(c.enemyInjuries) && e.enemyRisk === c.enemyRisk &&
    Number.isSafeInteger(e.enemySpirituality) && e.enemySpirituality >= 0 && e.enemySpirituality === 120 - WEATHER_WARLOCK_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) &&
    Number.isSafeInteger(c.round) && c.round >= 1 && e.startHistoryIndex !== null && s.combatHistory.length - e.startHistoryIndex === c.round - 1 &&
    (e.companionIds.length === 0 || e.invitedWeek === s.week && e.companionIds.every(id => { const m = findIronBloodMember(s, id); return m?.joined && m.present && m.location === 'YARD'; }));
}
export function settleWeatherWarlockEncounter(s: SliceState, outcome: string, ctx: SeerContext, _award?: (source: string, amount: 5 | 8 | 25) => void): void {
  const e = s.weatherWarlock.encounter, c = s.combat;
  if (e.status !== 'FIGHTING' || c?.encounterId !== 'WEATHER_WARLOCK_DISPUTE') throw new Error('没有同一原奥伦的真实战斗。');
  if (outcome === 'CONTINUE') return;
  if (!['PLAYER_DEAD', 'RETREATED', 'ENEMY_DEAD', 'ENEMY_SURRENDERED'].includes(outcome)) throw new Error('未知原石院战斗结果。');
  const last = c.lastRound, o = last?.weatherWarlockOutcome;
  if (e.terminal || e.startHistoryIndex === null || !last || !validateWeatherWarlockRoundOutcome(o) || o.continuing || c.round !== last.round + 1 ||
      s.combatHistory.length - e.startHistoryIndex !== last.round || stableStringify(s.combatHistory.at(-1)) !== stableStringify(last) ||
      o.enemyHealth !== c.enemyHealth || o.enemyMind !== c.enemyMind || o.enemySpirituality !== e.enemySpirituality ||
      outcome === 'PLAYER_DEAD' && (s.health !== 0 || last.winner !== 'ENEMY' || last.retreat === 'SUCCESS') ||
      outcome === 'RETREATED' && (s.health <= 0 || last.retreat !== 'SUCCESS' || last.winner !== 'ENEMY') ||
      outcome === 'ENEMY_DEAD' && (c.enemyHealth !== 0 || c.enemyStatus !== 'DEAD' || last.winner !== 'PLAYER') ||
      outcome === 'ENEMY_SURRENDERED' && (c.enemyHealth <= 0 || c.enemyStatus !== 'SURRENDERED' || last.winner !== 'PLAYER')) throw new Error('同一原人、回合与真实资源结果不一致。');
  e.terminal = { outcome: outcome as WeatherWarlockEncounterTerminal['outcome'], round: last.round, historyIndex: s.combatHistory.length - 1,
    enemyHealth: c.enemyHealth, enemyMind: c.enemyMind, enemySpirituality: e.enemySpirituality, enemyStatus: c.enemyStatus };
  e.status = outcome === 'PLAYER_DEAD' ? 'LOST' : outcome === 'RETREATED' ? 'RETREATED' : 'RESOLVED'; e.linkedMemberIds = [];
  e.weakness.available = false; e.weakness.sourceRound = null;
  if (e.companionIds.length) dismissWeatherWarlockMembers(s); s.combat = null;
  ctx.note('同一原石院冲突实际结束', `${outcome === 'PLAYER_DEAD' ? '本人在真实伤势盘死亡，编队不能替死或复活。' : outcome === 'ENEMY_DEAD' ? '原奥伦真实死亡，原尸体与他自己的原棍留在石院。' : outcome === 'RETREATED' ? '本人沿开放普通出口实际退出，没有追逐、瞬移或夺棍。' : '原奥伦仍活着，因真实伤势自行投降并放下自己的原棍，没有强制心控。'}联系已解除，实际到场原五人沿原路返家，H/E消耗和原经历保留，不补满、不生成战利品；原40升蓄水、湿滑地面和木挡板损坏保留，不免费添水或修复。旧加里克与塞德里克原结局不变。`);
}
export function weatherWarlockEncounterActions(s: SliceState): WeatherWarlockAction[] {
  if (!stage(s)) return [];
  return ([['ENCOUNTER_TALK', '前往新原石院实际交谈', '1行动，另留开战1行动'], ['CALL_COMPANIONS', '邀请原第一组五人本次到场', '1行动 · 40便士，另留开战1行动'],
    ['ENCOUNTER_FIGHT', '承担同一新原人的真实战斗', '1行动 · 正常伤势/死亡风险'], ['LEAVE_ENCOUNTER', '沿原出口和平离开并散场', '0行动 · 已付成本不退']] as const).map(([type, label, cost]) => {
    const command: WeatherWarlockEncounterCommand = { type }, reason = blockWeatherWarlockEncounter(s, command);
    return { id: `WW2-ENCOUNTER:${type}`, label, cost, command, enabled: reason === null, reason };
  });
}
export function projectWeatherWarlockEncounter(s: SliceState): WeatherWarlockEncounterProjection {
  const e = s.weatherWarlock.encounter;
  return { title: '真实原五人与可选新冲突', story: WEATHER_WARLOCK_ENCOUNTER_STORY, status: e.status, inside: isInsideWeatherWarlockEncounter(s),
    enemy: { id: e.targetId, name: '奥伦·沃斯', age: 49, sequence: 2, health: e.enemyHealth, mind: e.enemyMind, spirituality: e.enemySpirituality,
      status: e.enemyStatus, weaponId: 'WW2-ORREN-CLUB', weaponLocation: e.weaponLocation, powerUses: { ...e.powerUses } },
    companions: WEATHER_WARLOCK_MEMBER_IDS.map(id => { const m = findIronBloodMember(s, id)!; return { id, name: m.name, health: m.health, energy: m.energy,
      present: isInsideWeatherWarlockEncounter(s) && e.companionIds.includes(id) && m.present && m.location === 'YARD', eligible: canCallWeatherWarlockMember(s, id), willing: m.willing }; }),
    linkedMemberIds: [...e.linkedMemberIds], policy: e.policy, actions: weatherWarlockEncounterActions(s),
    facts: ['只有本次实付1行动与40便士重新受邀的原01～05能够到场，旧邀请不是当前在场证明；原01/02旧伤、全队旧经历不改。',
      '每轮默认保留联系。明确选本轮联结，且五人仍自愿、安全、有2精力与本人有5灵性才实际扣费；否则0消耗。60秒/6米、团队共用贡献20均G，不共享法术或额外五套轮盘。',
      '原成员仍会拒绝、疲劳或受伤，健康低于50不参与分担。真实H伤至多20%、每人2/合计10；不转精神或死亡分支，原伤势与累计风险保留。',
      `新原奥伦独立灵性${e.enemySpirituality}/120，实际雷击8S/95G、风幕6S/55G；本人的武器仍在${s.town.clubLocation === 'HAND' ? '自己手中' : '原存放处，不自动到手'}，没有免费纸、灯、陷阱或兵库。`,
      '结束实际散场回原家，已付H/E与灵性不恢复；新原人和旧加里克身份、原棍、结局各自独立。'] };
}
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
export function validateWeatherWarlockEncounter(s: SliceState): boolean {
  try {
    const e = s.weatherWarlock.encounter;
    if (!e || !validWeatherWarlockTerrain(e.terrain) || e.targetId !== WEATHER_WARLOCK_TARGET_ID || !['AVAILABLE', 'READY', 'FIGHTING', 'RESOLVED', 'RETREATED', 'LOST'].includes(e.status) || !integer(e.enemyHealth, 0, 100) || !integer(e.enemyMind, 1, 100) || !integer(e.enemySpirituality, 0, 120) || !integer(e.enemyRisk) ||
        !['RESISTING', 'SURRENDERED', 'DEAD'].includes(e.enemyStatus) || (e.enemyStatus === 'DEAD') !== (e.enemyHealth === 0) || !['HAND', 'YARD'].includes(e.weaponLocation) || (e.enemyStatus !== 'RESISTING') !== (e.weaponLocation === 'YARD') ||
        !Array.isArray(e.enemyInjuries) || e.enemyInjuries.some(i => !i || typeof i.id !== 'string' || !['LIGHT', 'HEAVY'].includes(i.severity) || !integer(i.acquiredRevision) || i.treatedRevision !== null && !integer(i.treatedRevision, i.acquiredRevision)) ||
        !e.powerUses || Object.keys(e.powerUses).length !== 3 || WEATHER_WARLOCK_POWER_IDS.some(id => !integer(e.powerUses[id])) || e.enemySpirituality !== 120 - WEATHER_WARLOCK_POWERS.reduce((n, p) => n + e.powerUses[p.id] * p.cost, 0) ||
        !['HOLD', 'LINK_IF_READY'].includes(e.policy) || !Array.isArray(e.companionIds) || !(e.companionIds.length === 0 || same(e.companionIds, WEATHER_WARLOCK_MEMBER_IDS)) || !Array.isArray(e.linkedMemberIds) || e.linkedMemberIds.length !== 0 ||
        [e.approachWeek, e.invitedWeek, e.attemptWeek].some(n => n !== null && !integer(n, s.weatherWarlock.promotionWeek ?? 0, s.week)) || e.startHistoryIndex !== null && !integer(e.startHistoryIndex, 0, s.combatHistory.length)) return false;
    if (e.companionIds.length ? e.invitedWeek === null : e.invitedWeek !== null) return false;
    if (s.weatherWarlock.promotionWeek === null) return same(e, createWeatherWarlockEncounterState()) && s.combat?.encounterId !== 'WEATHER_WARLOCK_DISPUTE';
    if (!stage(s)) return false;
    if (e.startHistoryIndex === null) {
      if (!same(e.terrain,createWeatherWarlockEncounterState().terrain) || !['AVAILABLE', 'READY', 'RESOLVED'].includes(e.status) || e.terminal !== null || e.attemptWeek !== null || e.enemyHealth !== 100 || e.enemyMind !== 100 || e.enemySpirituality !== 120 || e.enemyStatus !== 'RESISTING' || e.enemyInjuries.length || e.enemyRisk || Object.values(e.powerUses).some(n => n !== 0) || !same(e.weakness, createWeatherWarlockEncounterState().weakness) || e.policy !== 'HOLD' || s.combat?.encounterId === 'WEATHER_WARLOCK_DISPUTE') return false;
      if (e.status === 'AVAILABLE') return e.approachWeek === null && e.companionIds.length === 0;
      if (e.approachWeek === null || e.invitedWeek !== null && e.invitedWeek < e.approachWeek) return false;
      return e.status !== 'READY' || e.companionIds.every(id => { const m = findIronBloodMember(s, id); return m?.joined && m.willing && m.present && m.location === 'YARD'; });
    }
    if (e.approachWeek === null || e.attemptWeek === null || e.attemptWeek < e.approachWeek || e.invitedWeek !== null && e.invitedWeek !== e.attemptWeek) return false;
    const end = e.terminal ? e.terminal.historyIndex + 1 : s.combatHistory.length, rounds = s.combatHistory.slice(e.startHistoryIndex, end);
    let previous: WeatherWarlockRoundOutcome | undefined;
    for (const [i, round] of rounds.entries()) {
      const o = round.weatherWarlockOutcome;
      if (!validateWeatherWarlockRoundOutcome(o) || round.round !== i + 1 || o.round !== round.round || o.stance !== round.stance || round.winner === null || o.source.runId !== s.runId || o.source.week !== e.attemptWeek || o.source.startHistoryIndex !== e.startHistoryIndex ||
          !same(o.source.members.map(m => m.id), e.companionIds) || o.source.members.some(m => m.name !== findIronBloodMember(s, m.id)?.name) || i < rounds.length - 1 && (!o.continuing || round.retreat === 'SUCCESS')) return false;
      if (previous ? o.source.enemyHealth !== previous.enemyHealth || o.source.enemyMind !== previous.enemyMind || o.source.playerHealth !== previous.playerHealthAfter || o.source.playerMind !== previous.playerMindAfter ||
          o.playerSpiritualityBefore !== Math.min(120, previous.playerSpiritualityAfter + 12) || o.enemySpiritualityBefore !== previous.enemySpirituality || !same(o.source.members, previous.membersAfter) || !same(o.source.powerUses, previous.powerUses) || !same(o.source.weakness, previous.weaknessAfter) || !same(o.source.terrain, previous.terrainAfter)
        : !same(o.source.terrain,createWeatherWarlockEncounterState().terrain) || o.source.enemyHealth !== 100 || o.source.enemyMind !== 100 || o.enemySpiritualityBefore !== 120 || Object.values(o.source.powerUses).some(n => n !== 0)) return false;
      const moves = [...o.playerActions.map(a => ({ ...a, actor: 'PLAYER' as const })), ...o.enemyActions.map(a => ({ ...a, actor: 'ENEMY' as const }))].sort((a, b) => a.order - b.order).map(a => ({ actor: a.actor, label: a.label, selfGain: a.selfGain, enemyReduction: a.enemyReduction }));
      if (!same(moves, round.moves) || o.playerActions.length > round.playerCount || o.enemyActions.length > round.enemyCount) return false;
      previous = o;
    }
    if (!validWeatherWarlockWeakness(e.weakness, s.combat?.round ?? (previous?.round ?? 1) + 1)) return false;
    if (previous && (!same(previous.terrainAfter,e.terrain) || previous.enemyHealth !== e.enemyHealth || previous.enemyMind !== e.enemyMind || previous.enemySpirituality !== e.enemySpirituality || previous.enemyStatus !== e.enemyStatus || !same(previous.powerUses, e.powerUses) || !same(previous.weaknessAfter, e.weakness) || previous.policy !== e.policy)) return false;
    if (e.status === 'FIGHTING') return e.terminal === null && hasWeatherWarlockDisputeOpponent(s) && (!previous || previous.continuing && previous.membersAfter.every(m => { const now = findIronBloodMember(s, m.id)!; return now.health === m.health && now.energy === m.energy; }));
    const t = e.terminal, last = rounds.at(-1);
    return !!t && !!previous && !!last && !previous.continuing && t.round === last.round && t.historyIndex === end - 1 && t.enemyHealth === e.enemyHealth && t.enemyMind === e.enemyMind && t.enemySpirituality === e.enemySpirituality && t.enemyStatus === e.enemyStatus && s.combat?.encounterId !== 'WEATHER_WARLOCK_DISPUTE' &&
      (t.outcome === 'PLAYER_DEAD' ? e.status === 'LOST' && s.health === 0 && last.winner === 'ENEMY' : t.outcome === 'RETREATED' ? e.status === 'RETREATED' && last.retreat === 'SUCCESS' : t.outcome === 'ENEMY_DEAD' ? e.status === 'RESOLVED' && e.enemyStatus === 'DEAD' && last.winner === 'PLAYER' : e.status === 'RESOLVED' && e.enemyStatus === 'SURRENDERED' && last.winner === 'PLAYER');
  } catch { return false; }
}
