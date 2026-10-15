import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import type { IronBloodKnightAction } from './types.js';

export const IRON_BLOOD_COHORT_IDS = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'] as const;
export type IronBloodCohortId = typeof IRON_BLOOD_COHORT_IDS[number];
export const IRON_BLOOD_TEAM_ACTIVITIES = ['RESCUE', 'WATCH', 'SIGNALS'] as const;
export type IronBloodTeamActivity = typeof IRON_BLOOD_TEAM_ACTIVITIES[number];
const NAMES = ['艾达', '本尼特', '克拉拉', '德里克', '艾琳', '费利克斯', '格蕾丝', '休伯特', '伊莎', '乔纳', '凯拉', '莱昂', '米娜', '诺埃尔', '奥黛', '帕维尔', '奎因', '罗莎', '塞缪尔', '泰丝', '尤里', '薇拉', '沃伦', '希拉', '伊文', '泽拉', '阿莫斯', '贝丝', '科林', '黛拉'];
export const IRON_BLOOD_ROSTER = Object.freeze(NAMES.map((name, i) => Object.freeze({
  id: `IB4-${String(i + 1).padStart(2, '0')}`, name, age: 24 + i % 19,
  cohortId: IRON_BLOOD_COHORT_IDS[Math.floor(i / 5)]!, source: `原创G：贝克兰德旧石院第${Math.floor(i / 5) + 1}组成年互助成员，原登记${i + 1}号`,
})));
export interface IronBloodMember {
  id: string; name: string; age: number; source: string; cohortId: IronBloodCohortId;
  health: number; energy: number; location: 'YARD' | 'HOME'; present: boolean; willing: boolean;
  joined: boolean; joinedWeek: number | null; experience: number;
  cohortActivities: { activity: IronBloodTeamActivity; week: number }[]; exerciseWeeks: number[];
}
export interface IronBloodTeamAttempt { activity: IronBloodTeamActivity; week: number; outcome: PublicResolutionTier; participantIds: string[] }
export interface IronBloodRite { id: string; participantIds: string[]; arrivedWeek: number }
export interface IronBloodRiteHistory extends IronBloodRite { closedWeek: number; consumedBottleId: string | null }
export interface IronBloodTeamState {
  members: IronBloodMember[];
  cohorts: { id: IronBloodCohortId; attempts: IronBloodTeamAttempt[] }[];
  exercises: { week: number; outcome: PublicResolutionTier; participantIds: string[] }[];
  firstJoinedWeek: number | null; restRequestedWeek: number | null;
  rite: IronBloodRite | null; riteHistory: IronBloodRiteHistory[];
}
export type IronBloodTeamCommand =
  | { type: 'JOIN_COHORT'; cohortId: IronBloodCohortId }
  | { type: 'TEAM_ACTIVITY'; cohortId: IronBloodCohortId; activity: IronBloodTeamActivity }
  | { type: 'FULL_EXERCISE' | 'REST_TEAM' | 'RECOVER_TEAM' | 'PREPARE_RITE' | 'LEAVE_RITE' };
export interface IronBloodTeamProjection {
  title: string; source: string; environment: string; firstJoinedWeek: number | null; elapsedWeeks: number;
  qualified: boolean; qualification: string; restRequestedWeek: number | null;
  cohorts: { id: IronBloodCohortId; title: string; joined: boolean; members: IronBloodMember[]; successfulActivities: string[]; activityWeeks: number[]; lastAttemptWeek: number | null }[];
  exerciseWeeks: number[]; rite: IronBloodRite | null; riteHistory: IronBloodRiteHistory[];
}
export const IRON_BLOOD_TEAM_ENVIRONMENT = '原著要求至少30位成员在共同成长中建立深厚战友情、近乎一体地协作。这里30位原成年成员、六组、三种实践、两次全队演练、至少六真实周、费用与健康阈值均为原创G解释；名单、付款或一次课堂不能代替经历。失败、伤势和已完成的共同经历分别保留；休整须真实跨周且有恢复上限。';
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (v: PublicResolutionTier) => v === 'SUCCESS' || v === 'GREAT_SUCCESS';
const sameIds = (actual: unknown, expected: readonly string[]): actual is string[] => Array.isArray(actual) && actual.length === expected.length && actual.every((id, i) => id === expected[i]);
const healthy = (m: IronBloodMember) => m.joined && m.willing && m.health >= 80 && m.energy >= 8;
const membersOf = (s: SliceState, id: IronBloodCohortId) => s.ironBloodKnight.team.members.filter(m => m.cohortId === id);
const completedCohorts = (s: SliceState) => s.ironBloodKnight.team.members.every(m => m.joined && m.cohortActivities.length === 3 && new Set(m.cohortActivities.map(a => a.week)).size === 3);
const exerciseWeeks = (s: SliceState) => s.ironBloodKnight.team.exercises.filter(a => success(a.outcome)).map(a => a.week);
export function createIronBloodTeamState(): IronBloodTeamState {
  return { members: IRON_BLOOD_ROSTER.map(m => ({ ...m, health: 100, energy: 20, location: 'HOME', present: false, willing: true, joined: false, joinedWeek: null, experience: 0, cohortActivities: [], exerciseWeeks: [] })),
    cohorts: IRON_BLOOD_COHORT_IDS.map(id => ({ id, attempts: [] })), exercises: [], firstJoinedWeek: null, restRequestedWeek: null, rite: null, riteHistory: [] };
}
export const findIronBloodMember = (s: SliceState, id: string): IronBloodMember | undefined => s.ironBloodKnight.team.members.find(m => m.id === id);
export function dismissIronBloodMembers(s: SliceState, ids: readonly string[]): void {
  for (const m of s.ironBloodKnight.team.members) if (ids.includes(m.id)) { m.present = false; m.location = 'HOME'; }
}
export const hasIronBloodRite = (s: SliceState): boolean => s.ironBloodKnight.team.rite !== null;
export const hasIronBloodRitualLock = hasIronBloodRite;
export function ironBloodTeamQualified(s: SliceState): boolean {
  const t = s.ironBloodKnight.team;
  return t.firstJoinedWeek !== null && s.week - t.firstJoinedWeek >= 6 && completedCohorts(s) && exerciseWeeks(s).length === 2 && t.members.every(m => m.exerciseWeeks.length === 2);
}
export function canConsumeIronBloodRite(s: SliceState): boolean {
  const t = s.ironBloodKnight.team, r = t.rite;
  return !!r && r.arrivedWeek === s.week && ironBloodTeamQualified(s) && sameIds(r.participantIds, IRON_BLOOD_ROSTER.map(m => m.id)) && t.members.every(m => healthy(m) && m.present && m.location === 'YARD');
}
export function closeIronBloodRite(s: SliceState, consumedBottleId?: string): void {
  const t = s.ironBloodKnight.team;
  if (!t.rite) return;
  t.riteHistory.push({ ...structuredClone(t.rite), closedWeek: s.week, consumedBottleId: consumedBottleId ?? null });
  dismissIronBloodMembers(s, t.rite.participantIds); t.rite = null;
}
export function validateIronBloodTeamCommand(v: unknown): v is IronBloodTeamCommand {
  if (!record(v)) return false;
  if (v.type === 'JOIN_COHORT') return shape(v, ['type', 'cohortId']) && IRON_BLOOD_COHORT_IDS.includes(v.cohortId as IronBloodCohortId);
  if (v.type === 'TEAM_ACTIVITY') return shape(v, ['type', 'cohortId', 'activity']) && IRON_BLOOD_COHORT_IDS.includes(v.cohortId as IronBloodCohortId) && IRON_BLOOD_TEAM_ACTIVITIES.includes(v.activity as IronBloodTeamActivity);
  return ['FULL_EXERCISE', 'REST_TEAM', 'RECOVER_TEAM', 'PREPARE_RITE', 'LEAVE_RITE'].includes(String(v.type)) && shape(v, ['type']);
}
export const isIronBloodTeamCommand = validateIronBloodTeamCommand;
export function blockIronBloodTeamCommand(s: SliceState, c: IronBloodTeamCommand): string | null {
  if (!validateIronBloodTeamCommand(c)) return '实际队伍命令无效。';
  if (s.progression.sequence === 1 && !['REST_TEAM', 'RECOVER_TEAM'].includes(c.type)) return '征服者阶段原共同成长与仪式只保留历史。';
  if (s.status !== 'ACTIVE' || s.progression.pathwayId !== 'hunter' || ![5, 4, 3, 2, 1].includes(s.progression.sequence ?? 0)) return '须仍活着并在收割者或铁血骑士阶段。';
  if (s.activeEvent || s.combat || s.world.city !== 'BACKLUND') return '先处理事件和战斗，并实际回到贝克兰德原石院。';
  const t = s.ironBloodKnight.team;
  if (c.type === 'LEAVE_RITE') return t.rite ? null : '没有尚在原院的仪式集合。';
  if (t.rite) return '先服用当前原瓶，或0行动让30位原成员实际回家。';
  if (Object.values(s.reaper.cases).some(r => r.contactOpen || r.status === 'PREPARED' || r.practice.windowOpen) || Object.values(s.conspirator.cases).some(r => r.contactOpen || r.status === 'PREPARED')) return '先结束旧收割者或阴谋家的实际接触与准备。';
  if (Object.values(s.ironBloodKnight.life.cases).some(r => r.contactOpen || r.status === 'PREPARED') || ['READY', 'FIGHTING'].includes(s.ironBloodKnight.encounter.status) || t.members.some(m => m.present)) return '先收束原生活现场或让实际到场的同伴离开。';
  if (c.type === 'RECOVER_TEAM') return t.restRequestedWeek === null ? '先实际支付队伍休整。' : s.week <= t.restRequestedWeek ? '休整必须经过下一真实周。' : null;
  if (c.type === 'REST_TEAM') return t.restRequestedWeek !== null ? '这次休整已经付费，等下一真实周。' : !t.members.some(m => m.joined && (m.health < 100 || m.energy < 20)) ? '已加入成员无需恢复，不重复收费。' : s.cash < 40 ? '队伍休整需要40便士。' : null;
  if (s.progression.sequence !== 5 || !s.ironBloodKnight.guidanceKnown) return '先取得铁血骑士指导；共同经历在收割者阶段真实建立。';
  if (s.health <= 20 || s.mind <= 40) return '本人须健康高于20、精神高于40，才能承担本次协作。';
  if (t.restRequestedWeek !== null) return '先让已支付休整经过真实周并完成有限恢复。';
  if (s.actionsRemaining < 1) return '本次需要1行动。';
  if (c.type === 'JOIN_COHORT') {
    const group = membersOf(s, c.cohortId);
    return group.some(m => m.joined) ? '这五位原成员已经实际加入，不补出新成员。' : group.some(m => !m.willing || m.health < 80 || m.energy < 8) ? '须五位原成年成员当前愿意且状态足以到场。' : null;
  }
  if (c.type === 'TEAM_ACTIVITY') {
    const group = membersOf(s, c.cohortId), attempts = t.cohorts.find(g => g.id === c.cohortId)!.attempts;
    return !group.every(healthy) ? '须这五位原成员已加入、当前愿意且健康≥80、精力≥8。' : attempts.some(a => a.week === s.week) ? '每组每真实周只有一次共同实践，失败也须下周再尝试。' : group.every(m => m.cohortActivities.some(a => a.activity === c.activity)) ? '这一共同经历已完成，不能重复记成长。' : s.cash < 20 ? '原物资需要20便士。' : null;
  }
  if (c.type === 'FULL_EXERCISE') return !completedCohorts(s) ? '先让六组各自跨至少三真实周完成救援、守望和无声信号。' : exerciseWeeks(s).length >= 2 ? '两次原全队成功演练已经保留。' : t.exercises.some(a => a.week === s.week) ? '全队演练每真实周一次，失败须下周再试。' : !t.members.every(healthy) ? '本次需全部30位原成员当前愿意、健康≥80、精力≥8。' : s.cash < 60 ? '全队实际演练需要60便士。' : null;
  if (c.type === 'PREPARE_RITE') return !ironBloodTeamQualified(s) ? '须30人各三种跨周成功实践、两次不同周成功全队演练，且距首次加入至少六真实周。' : !t.members.every(healthy) ? '历史经历仍在；当前30人须再次愿意且健康≥80、精力≥8。' : !s.ironBloodKnight.bottles.some(b => b.status === 'PLAYER') ? '先持有一瓶来源明确的原铁血骑士成品药。' : s.cash < 120 ? '本次重新集合与仪式准备需要120便士。' : null;
  return '未知实际队伍行动。';
}
const ACTIVITY_LABELS = { RESCUE: '积水中的原救援车', WATCH: '熟悉巷口的共同夜哨', SIGNALS: '原石院的无声撤退信号' };
const ACTIVITY_STORIES = {
  RESCUE: '本人随五位原成员把同一救援车移出浅积水。前两人主张直接拉车，后三人发现歪轮并扶正；你们听取不同判断，相互接手负载后才完成。',
  WATCH: '本人和五人实际沿已知巷口轮换夜哨。有人先听脚步，有人核对原灯的位置，交班时逐一复述看见的情况，共同弥补盲区。',
  SIGNALS: '本人随同五人练习原院净空路线：第一人以目光示意障碍，后排用抬手确认，另一人纠正过早前进；所有人互相照应完成无声退回。',
};
export function applyIronBloodTeamCommand(s: SliceState, c: IronBloodTeamCommand, ctx: SeerContext): void {
  const reason = blockIronBloodTeamCommand(s, c); if (reason) throw new Error(reason);
  const t = s.ironBloodKnight.team;
  if (c.type === 'LEAVE_RITE') { closeIronBloodRite(s); ctx.note('30位原成员实际离院', '本次仪式集合关闭，成员沿原路回家；准备费用不返还，已经取得的共同经历不抹去。下瓶必须重新集合。'); return; }
  if (c.type === 'REST_TEAM') { s.cash -= 40; t.restRequestedWeek = s.week; ctx.note('实际安排原队伍休整', '40便士已付，成员在家休息；此刻没有回复健康或精力，须下一真实周再确认恢复。'); return; }
  if (c.type === 'RECOVER_TEAM') { for (const m of t.members) if (m.joined && m.health > 0) { m.health = Math.min(100, m.health + 20); m.energy = Math.min(20, m.energy + 8); } t.restRequestedWeek = null; ctx.note('经过真实一周的有限休整', '已加入的同一成员各恢复至多20健康与8精力，不超过原上限；未清除历史失败、未改变意愿，也未自动到场。'); return; }
  s.actionsRemaining--;
  if (c.type === 'JOIN_COHORT') {
    const group = membersOf(s, c.cohortId);
    for (const m of group) { m.location = 'YARD'; m.present = true; m.joined = true; m.joinedWeek = s.week; }
    t.firstJoinedWeek ??= s.week;
    ctx.note(`第${c.cohortId.slice(1)}组五人实际加入`, `${group.map(m => m.name).join('、')}与本人面对面约定互助，各自明确同意，然后沿原路回家。这只是成员关系，尚无共同成长或仪式资格。`);
    dismissIronBloodMembers(s, group.map(m => m.id)); return;
  }
  if (c.type === 'PREPARE_RITE') {
    s.cash -= 120;
    for (const m of t.members) { m.location = 'YARD'; m.present = true; }
    t.rite = { id: `IB4-RITE-${t.riteHistory.length + 1}`, participantIds: t.members.map(m => m.id), arrivedWeek: s.week };
    ctx.note('原30位战友重新实际到场', '1行动、120便士已付；逐人核对当前意愿、健康与精力，30位原身体均留在原院。本次集合只服务这一瓶，最后行动已用尽仍可0行动服药或实际离院。'); return;
  }
  const group = c.type === 'TEAM_ACTIVITY' ? membersOf(s, c.cohortId) : t.members;
  for (const m of group) { m.present = true; m.location = 'YARD'; }
  s.cash -= c.type === 'TEAM_ACTIVITY' ? 20 : 60;
  const outcome = ctx.check('knowledge', c.type === 'TEAM_ACTIVITY' ? 12 : 16).tier;
  if (c.type === 'TEAM_ACTIVITY') {
    t.cohorts.find(g => g.id === c.cohortId)!.attempts.push({ activity: c.activity, week: s.week, outcome, participantIds: group.map(m => m.id) });
    if (success(outcome)) for (const m of group) { m.cohortActivities.push({ activity: c.activity, week: s.week }); m.experience++; }
    else { for (const m of group) m.energy = Math.max(0, m.energy - 2); s.mind = Math.max(0, s.mind - 2); }
    ctx.note(`${ACTIVITY_LABELS[c.activity]}：第${c.cohortId.slice(1)}组`, ACTIVITY_STORIES[c.activity] + (success(outcome) ? '实际成功：每人共同经验+1，原经历与本周记录保留。' : '本次协作没有完成：每人实际精力−2，本人精神−2，没有成功或成长计数；下周才可重试。'));
  } else {
    t.exercises.push({ week: s.week, outcome, participantIds: group.map(m => m.id) });
    if (success(outcome)) for (const m of group) { m.exerciseWeeks.push(s.week); m.experience++; }
    else { for (const m of group) m.energy = Math.max(0, m.energy - 2); s.mind = Math.max(0, s.mind - 3); }
    ctx.note('30位原成员的全队协作', '六组本人实际到场，在原石院交换已学信号并依序护送模拟避难者撤回。前组给出目光提示，后组纠正路线，薄弱处由原同伴接手。' + (success(outcome) ? '本次成功，每人真实协作经验+1；另一场仍需不同真实周。' : '本次队形失配，没有成功记录；每人精力−2，本人精神−3，下一真实周才可重试。'));
  }
  dismissIronBloodMembers(s, group.map(m => m.id));
}
export function ironBloodTeamActions(s: SliceState): IronBloodKnightAction[] {
  if (s.progression.pathwayId !== 'hunter' || ![5, 4, 3, 2].includes(s.progression.sequence ?? 0)) return [];
  const out: IronBloodKnightAction[] = [], t = s.ironBloodKnight.team;
  const add = (command: IronBloodTeamCommand, label: string, cost: string) => { const reason = blockIronBloodTeamCommand(s, command); out.push({ id: `iron-blood-team-${command.type.toLowerCase()}${'cohortId' in command ? `-${command.cohortId}` : ''}${'activity' in command ? `-${command.activity}` : ''}`, label, cost, command, enabled: reason === null, reason }); };
  if (t.rite) { add({ type: 'LEAVE_RITE' }, '让本次30位原战友实际回家', '0行动 · 本次120便士不返还'); return out; }
  if (s.progression.sequence === 5) {
    for (const id of IRON_BLOOD_COHORT_IDS) {
      const group = membersOf(s, id);
      if (!group.every(m => m.joined)) add({ type: 'JOIN_COHORT', cohortId: id }, `与第${id.slice(1)}组五位原成年人面对面结伴`, '1行动 · 不以金钱购买成员');
      else for (const activity of IRON_BLOOD_TEAM_ACTIVITIES) if (!group.every(m => m.cohortActivities.some(a => a.activity === activity))) add({ type: 'TEAM_ACTIVITY', cohortId: id, activity }, `第${id.slice(1)}组：${ACTIVITY_LABELS[activity]}`, '1行动 · 20便士 · 知识12 · 每组每周一次');
    }
    if (exerciseWeeks(s).length < 2) add({ type: 'FULL_EXERCISE' }, '原30人全队协作演练', '1行动 · 60便士 · 知识16 · 不同真实周');
    add({ type: 'PREPARE_RITE' }, '逐人确认并实际集合30位原战友', '1行动 · 每次120便士 · 全员当前愿意且状态足够');
  }
  if (t.restRequestedWeek !== null) add({ type: 'RECOVER_TEAM' }, '确认跨真实周的有限恢复', '0行动 · 至多健康+20、精力+8');
  else if (t.members.some(m => m.joined && (m.health < 100 || m.energy < 20))) add({ type: 'REST_TEAM' }, '为原成员安排休整', '0行动 · 40便士 · 下一真实周才恢复');
  return out;
}
export function projectIronBloodTeam(s: SliceState): IronBloodTeamProjection {
  const t = s.ironBloodKnight.team, qualified = ironBloodTeamQualified(s);
  return { title: '三十个名字，真实共同成长', source: '原著第五部第177章：至少30位成员与深厚战友情。具体成员、次数、周数与预算为原创G。', environment: IRON_BLOOD_TEAM_ENVIRONMENT,
    firstJoinedWeek: t.firstJoinedWeek, elapsedWeeks: t.firstJoinedWeek === null ? 0 : s.week - t.firstJoinedWeek, qualified,
    qualification: qualified ? '共同经历已满足；每瓶仍须重新检查当前状态并真实到场。' : '六组各三种跨周成功实践、两场不同周全队成功演练，首次结伴后至少六真实周。', restRequestedWeek: t.restRequestedWeek,
    cohorts: t.cohorts.map(g => { const members = membersOf(s, g.id); return { id: g.id, title: `第${g.id.slice(1)}组 · 五位原成年人`, joined: members.every(m => m.joined), members: structuredClone(members), successfulActivities: members[0]!.cohortActivities.map(a => ACTIVITY_LABELS[a.activity]), activityWeeks: members[0]!.cohortActivities.map(a => a.week), lastAttemptWeek: g.attempts.at(-1)?.week ?? null }; }),
    exerciseWeeks: exerciseWeeks(s), rite: structuredClone(t.rite), riteHistory: structuredClone(t.riteHistory) };
}
export function validateIronBloodTeamState(s: SliceState): boolean {
  const t = s.ironBloodKnight?.team;
  if (!record(t) || !shape(t, ['members', 'cohorts', 'exercises', 'firstJoinedWeek', 'restRequestedWeek', 'rite', 'riteHistory']) || !Array.isArray(t.members) || t.members.length !== 30 || !Array.isArray(t.cohorts) || t.cohorts.length !== 6 || !Array.isArray(t.exercises) || !Array.isArray(t.riteHistory)) return false;
  const week = (v: unknown) => integer(v, 0, s.week), tier = (v: unknown) => ['SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(v));
  if (t.firstJoinedWeek !== null && !week(t.firstJoinedWeek) || t.restRequestedWeek !== null && !week(t.restRequestedWeek)) return false;
  for (const [i, m] of t.members.entries()) {
    const original = IRON_BLOOD_ROSTER[i]!;
    if (!record(m) || !shape(m, ['id', 'name', 'age', 'source', 'cohortId', 'health', 'energy', 'location', 'present', 'willing', 'joined', 'joinedWeek', 'experience', 'cohortActivities', 'exerciseWeeks']) || m.id !== original.id || m.name !== original.name || m.age !== original.age || m.source !== original.source || m.cohortId !== original.cohortId) return false;
    if (!integer(m.health, 0, 100) || !integer(m.energy, 0, 20) || !integer(m.experience, 0, 5) || !['HOME', 'YARD'].includes(m.location) || ![m.present, m.willing, m.joined].every(v => typeof v === 'boolean') || m.present !== (m.location === 'YARD') || m.present && !m.joined) return false;
    if (!Array.isArray(m.cohortActivities) || m.cohortActivities.length > 3 || !Array.isArray(m.exerciseWeeks) || m.exerciseWeeks.length > 2 || m.joined !== (m.joinedWeek !== null) || m.joinedWeek !== null && !week(m.joinedWeek)) return false;
    if (!m.joined && (m.experience || m.cohortActivities.length || m.exerciseWeeks.length || m.present) || m.experience !== m.cohortActivities.length + m.exerciseWeeks.length) return false;
    if (m.cohortActivities.some(a => !record(a) || !shape(a, ['activity', 'week']) || !IRON_BLOOD_TEAM_ACTIVITIES.includes(a.activity) || !week(a.week) || m.joinedWeek === null || a.week < m.joinedWeek) || new Set(m.cohortActivities.map(a => a.activity)).size !== m.cohortActivities.length || new Set(m.cohortActivities.map(a => a.week)).size !== m.cohortActivities.length || m.exerciseWeeks.some(w => !week(w))) return false;
  }
  const joinedWeeks = t.members.flatMap(m => m.joinedWeek === null ? [] : [m.joinedWeek]);
  if (t.firstJoinedWeek !== (joinedWeeks.length ? Math.min(...joinedWeeks) : null) || t.restRequestedWeek !== null && !joinedWeeks.length) return false;
  if (joinedWeeks.length && (!s.ironBloodKnight.guidanceKnown || s.progression.pathwayId !== 'hunter' || ![5, 4, 3, 2, 1].includes(s.progression.sequence ?? 0) || s.reaper.promotionWeek === null || joinedWeeks.some(w => w < s.reaper.promotionWeek!))) return false;
  for (const [i, g] of t.cohorts.entries()) {
    if (!record(g) || !shape(g, ['id', 'attempts']) || g.id !== IRON_BLOOD_COHORT_IDS[i] || !Array.isArray(g.attempts) || !g.attempts.every(record)) return false;
    const group = t.members.filter(m => m.cohortId === g.id), ids = group.map(m => m.id);
    if (group.some(m => m.joinedWeek !== group[0]!.joinedWeek) || new Set(g.attempts.map(a => a.week)).size !== g.attempts.length) return false;
    for (const [n, a] of g.attempts.entries()) if (!record(a) || !shape(a, ['activity', 'week', 'outcome', 'participantIds']) || !week(a.week) || !tier(a.outcome) || !IRON_BLOOD_TEAM_ACTIVITIES.includes(a.activity) || !sameIds(a.participantIds, ids) || group[0]!.joinedWeek === null || a.week < group[0]!.joinedWeek || n > 0 && a.week <= g.attempts[n - 1]!.week) return false;
    const successes = g.attempts.filter(a => success(a.outcome));
    if (new Set(successes.map(a => a.activity)).size !== successes.length) return false;
    for (const m of group) if (m.cohortActivities.length !== successes.length || m.cohortActivities.some((a, n) => a.activity !== successes[n]!.activity || a.week !== successes[n]!.week)) return false;
  }
  if (!t.exercises.every(record)) return false;
  const ids = IRON_BLOOD_ROSTER.map(m => m.id), successes = t.exercises.filter(a => success(a.outcome));
  if (successes.length > 2 || new Set(t.exercises.map(a => a.week)).size !== t.exercises.length) return false;
  for (const [i, a] of t.exercises.entries()) {
    if (!record(a) || !shape(a, ['week', 'outcome', 'participantIds']) || !week(a.week) || !tier(a.outcome) || !sameIds(a.participantIds, ids) || i > 0 && a.week <= t.exercises[i - 1]!.week) return false;
    if (t.members.some(m => m.cohortActivities.length !== 3 || m.cohortActivities.some(h => h.week > a.week))) return false;
  }
  for (const m of t.members) if (m.exerciseWeeks.length !== successes.length || m.exerciseWeeks.some((w, i) => w !== successes[i]!.week)) return false;
  const validRite = (r: IronBloodRite, ordinal: number) => record(r) && r.id === `IB4-RITE-${ordinal}` && week(r.arrivedWeek) && sameIds(r.participantIds, ids) && t.firstJoinedWeek !== null && r.arrivedWeek - t.firstJoinedWeek >= 6 && successes.length === 2 && successes.every(a => a.week <= r.arrivedWeek);
  for (const [i, r] of t.riteHistory.entries()) if (!record(r) || !shape(r, ['id', 'participantIds', 'arrivedWeek', 'closedWeek', 'consumedBottleId']) || !validRite(r, i + 1) || !week(r.closedWeek) || r.closedWeek !== r.arrivedWeek || r.consumedBottleId !== null && (typeof r.consumedBottleId !== 'string' || !r.consumedBottleId) || i > 0 && r.arrivedWeek < t.riteHistory[i - 1]!.arrivedWeek) return false;
  const consumed = t.riteHistory.flatMap(r => r.consumedBottleId === null ? [] : [r.consumedBottleId]);
  if (new Set(consumed).size !== consumed.length) return false;
  if (t.rite !== null && (!record(t.rite) || !shape(t.rite, ['id', 'participantIds', 'arrivedWeek']) || !validRite(t.rite, t.riteHistory.length + 1) || !canConsumeIronBloodRite(s) || s.progression.sequence !== 5 || s.world.city !== 'BACKLUND' || s.combat || s.activeEvent)) return false;
  return true;
}
