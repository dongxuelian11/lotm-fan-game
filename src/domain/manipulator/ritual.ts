import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import type { ManipulatorAction } from './types.js';

export const MANIPULATOR_GROUP_IDS = ['MP4-NORTH', 'MP4-EAST', 'MP4-SOUTH', 'MP4-WEST'] as const;
export type ManipulatorGroupId = typeof MANIPULATOR_GROUP_IDS[number];
export const MANIPULATOR_HALL_ID = 'MP4-MEMORIAL-HALL';
export const MANIPULATOR_HALL_CAPACITY = 12000;
export const MANIPULATOR_REQUIRED_ATTENDANCE = 10000;
export const MANIPULATOR_GATHERING_PRICE = 240;
const COMMON_EMOTION = 'REMEMBRANCE_AND_SOLIDARITY' as const;
/** Four disjoint original adult populations, not four purchased attendance certificates. */
export const MANIPULATOR_DISTRICTS = Object.freeze([
  { id: 'MP4-NORTH', title: '北区旧桥成年居民团', home: 'MP4-NORTH-HOME', route: '北区旧桥 → 公共北门 → 原纪念厅', source: '原创G：北区旧桥互助名册MP4-NORTH，原成年居民0001—3000，仅属于北区，受邀自愿到场。' },
  { id: 'MP4-EAST', title: '东区石街成年居民团', home: 'MP4-EAST-HOME', route: '东区石街 → 公共东门 → 原纪念厅', source: '原创G：东区石街互助名册MP4-EAST，原成年居民0001—3000，仅属于东区，与其它三区无重号人员，受邀自愿到场。' },
  { id: 'MP4-SOUTH', title: '南区河岸成年居民团', home: 'MP4-SOUTH-HOME', route: '南区河岸 → 公共南门 → 原纪念厅', source: '原创G：南区河岸互助名册MP4-SOUTH，原成年居民0001—3000，仅属于南区，与其它三区无重号人员，受邀自愿到场。' },
  { id: 'MP4-WEST', title: '西区钟巷成年居民团', home: 'MP4-WEST-HOME', route: '西区钟巷 → 公共西门 → 原纪念厅', source: '原创G：西区钟巷互助名册MP4-WEST，原成年居民0001—3000，仅属于西区，与其它三区无重号人员，受邀自愿到场。' },
] as const);
export const MANIPULATOR_GATHERING_STORY = '原创G有限市民纪念与互助集会：四个互不重叠的成年居民团各登记3000人，按原路线实际往返同一纪念厅；登记、付款与邀请都不计为到场。厅容量12000，四处原门均可正常退出。居民自主聆听旧桥洪水中相互救援与追念逝者的公开故事，自愿表达共同的追念与互助之情；不施展催眠或操纵，不以名单替代真实群众。';

export interface ManipulatorGatheringGroup {
  id: ManipulatorGroupId; title: string; source: string; home: string; route: string;
  registeredCount: number; arrivedCount: number; presentCount: number;
  location: 'HOME' | 'HALL'; emotion: 'CALM' | 'RESONANT';
  arrivalWeek: number | null; arrivalOutcome: PublicResolutionTier | null; returnedWeek: number | null;
}
export interface ManipulatorGathering {
  id: string; source: string; venueId: string; capacity: number;
  status: 'BOOKED' | 'OPEN' | 'CLOSED' | 'CANCELLED';
  bookedWeek: number; plannedWeek: number; startedWeek: number | null; closedWeek: number | null;
  groups: ManipulatorGatheringGroup[];
  resonanceAttemptWeek: number | null; resonanceOutcome: PublicResolutionTier | null;
  windowWeek: number | null; commonEmotion: typeof COMMON_EMOTION | null; consumedBottleId: string | null;
}
export interface ManipulatorRitualState {
  playerLocation: 'OUTSIDE' | 'HALL'; activeGatheringId: string | null; gatherings: ManipulatorGathering[];
}
export type ManipulatorRitualCommand =
  | { type: 'BOOK_GATHERING' | 'OPEN_GATHERING' | 'RESONATE' | 'LEAVE_GATHERING' }
  | { type: 'ARRIVE_GROUP'; groupId: ManipulatorGroupId };
export interface ManipulatorRitualProjection {
  title: string; status: string; venue: string; appointment: string; emotion: string;
  actualPresent: number; registeredCount: number; requiredCount: number; currentEventId: string | null; windowOpen: boolean;
  groups: { id: ManipulatorGroupId; title: string; source: string; registeredCount: number; presentCount: number; arrivedCount: number; location: string; emotion: string; arrival: string }[];
  history: { id: string; summary: string }[];
}

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const tier = (v: unknown): v is PublicResolutionTier => ['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(String(v));
const success = (v: PublicResolutionTier | null) => v === 'GREAT_SUCCESS' || v === 'SUCCESS';
const arrivalCount = (v: PublicResolutionTier) => success(v) ? 3000 : v === 'FAILURE' ? 1800 : 1200;
const presentCount = (g: ManipulatorGathering) => g.groups.reduce((n, group) => n + (group.location === 'HALL' ? group.presentCount : 0), 0);
const arrivedCount = (g: ManipulatorGathering) => g.groups.reduce((n, group) => n + group.arrivedCount, 0);
function rule(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
function originalGroups(): ManipulatorGatheringGroup[] {
  return MANIPULATOR_DISTRICTS.map(group => ({ ...group, registeredCount: 3000, arrivedCount: 0, presentCount: 0, location: 'HOME', emotion: 'CALM', arrivalWeek: null, arrivalOutcome: null, returnedWeek: null }));
}
export function createManipulatorRitualState(): ManipulatorRitualState {
  return { playerLocation: 'OUTSIDE', activeGatheringId: null, gatherings: [] };
}
export function currentManipulatorGathering(s: SliceState): ManipulatorGathering | undefined {
  return s.manipulator.ritual.gatherings.find(g => g.id === s.manipulator.ritual.activeGatheringId);
}
/** A pending booking never takes away the player's ordinary week. */
export function hasManipulatorRitualLock(s: SliceState): boolean {
  return currentManipulatorGathering(s)?.status === 'OPEN' && s.manipulator.ritual.playerLocation === 'HALL';
}
/** Read current bodies and current emotion, never an earlier event's peak attendance. */
export function canConsumeManipulatorRitual(s: SliceState): boolean {
  const g = currentManipulatorGathering(s);
  return !!g && g.status === 'OPEN' && s.status === 'ACTIVE' && s.health > 0 && s.mind > 0
    && s.world.city === 'BACKLUND' && s.manipulator.ritual.playerLocation === 'HALL'
    && g.venueId === MANIPULATOR_HALL_ID && g.startedWeek === s.week && g.windowWeek === s.week
    && g.resonanceAttemptWeek === s.week && success(g.resonanceOutcome) && g.commonEmotion === COMMON_EMOTION
    && g.consumedBottleId === null && g.groups.length === 4
    && g.groups.every((group, i) => group.id === MANIPULATOR_GROUP_IDS[i] && group.arrivalWeek === s.week
      && group.registeredCount === 3000 && group.source === MANIPULATOR_DISTRICTS[i]!.source
      && tier(group.arrivalOutcome) && group.arrivedCount === arrivalCount(group.arrivalOutcome)
      && group.presentCount === group.arrivedCount && group.location === 'HALL' && group.emotion === 'RESONANT' && group.returnedWeek === null)
    && presentCount(g) >= MANIPULATOR_REQUIRED_ATTENDANCE && presentCount(g) <= MANIPULATOR_HALL_CAPACITY;
}
/** Closes the actual gathering, retaining original arrivals and outcome in its history. */
export function closeManipulatorRitual(s: SliceState, bottleId: string | null = null): void {
  const r = s.manipulator.ritual, g = currentManipulatorGathering(s);
  if (!g) return;
  rule(g.status === 'BOOKED' || g.status === 'OPEN', '这场集会已经结束。');
  if (bottleId !== null) {
    rule(canConsumeManipulatorRitual(s), '只有当前实际万人共同情绪窗口允许记录本瓶服药。');
    const bottle = s.manipulator.bottles.find(value => value.id === bottleId);
    rule(bottle?.status === 'CONSUMED' && bottle.consumedWeek === s.week && bottle.ritualId === g.id && bottle.ritualWindowWeek === g.windowWeek, '须先实际耗尽当前合格窗口对应的同一原瓶，不能仅用瓶号完成晋升。');
  }
  g.status = g.status === 'BOOKED' ? 'CANCELLED' : 'CLOSED'; g.closedWeek = s.week; g.consumedBottleId = bottleId;
  for (const group of g.groups) {
    if (group.location === 'HALL') group.returnedWeek = s.week;
    group.location = 'HOME'; group.presentCount = 0; group.emotion = 'CALM';
  }
  r.playerLocation = 'OUTSIDE'; r.activeGatheringId = null;
}
export function validateManipulatorRitualCommand(v: unknown): v is ManipulatorRitualCommand {
  if (!record(v)) return false;
  if (v.type === 'ARRIVE_GROUP') return shape(v, ['type', 'groupId']) && MANIPULATOR_GROUP_IDS.includes(v.groupId as ManipulatorGroupId);
  return ['BOOK_GATHERING', 'OPEN_GATHERING', 'RESONATE', 'LEAVE_GATHERING'].includes(String(v.type)) && shape(v, ['type']);
}
export const isManipulatorRitualCommand = validateManipulatorRitualCommand;
export function blockManipulatorRitualCommand(s: SliceState, command: ManipulatorRitualCommand): string | null {
  if (!validateManipulatorRitualCommand(command)) return '集会命令无效，不能直接设定人数或共鸣。';
  const g = currentManipulatorGathering(s);
  if (command.type === 'LEAVE_GATHERING') return g && ['BOOKED', 'OPEN'].includes(g.status) ? null : '没有待取消或尚未散场的原集会。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0) return '须本人仍活着且身体与精神可以行动。';
  if (s.progression.pathwayId !== 'audience' || s.progression.sequence !== 5 || s.dreamwalker.promotionWeek === null || !s.manipulator.guidanceKnown) return '须成为梦境行者，并取得原导师的操纵师指导。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际回到贝克兰德原纪念厅所在城区。';
  if (s.dreamwalker.ritual.activeVisitId !== null || Object.values(s.dreamwalker.cases).some(c => c.contactOpen || c.status === 'PREPARED') || s.dreamwalker.practice.dream !== 'NONE' || s.dreamwalker.practice.location !== 'SOURCE_ROOM' || Object.values(s.hypnotist.cases).some(c => c.contactOpen || c.status === 'PREPARED')) return '先实际结束旧梦境或催眠接触，归还原物并返回源房间。';
  if (command.type === 'BOOK_GATHERING') {
    if (g) return '已有原集会预约或正在进行的集会，须先0行动取消或散场。';
    if (!s.manipulator.bottles.some(b => b.status === 'PLAYER')) return '须至少持有一瓶由原材料和七名不同人物泪水实际调配的操纵师原瓶。';
    if (s.actionsRemaining < 1) return '预约需要1行动。';
    return s.cash < MANIPULATOR_GATHERING_PRICE ? '原纪念厅预约、到场引导与本次散场服务合计需要240便士。' : null;
  }
  if (!g) return '先实际付费预约下一真实周的原集会。';
  if (command.type === 'OPEN_GATHERING') {
    if (g.status !== 'BOOKED') return '本次集会已经开场，不能重复入场。';
    if (s.week < g.plannedWeek) return `须到下一真实周，第${g.plannedWeek}周起才能亲自到厅开场。`;
    if (!s.manipulator.bottles.some(b => b.status === 'PLAYER')) return '尚未持有可服的操纵师原瓶，可以0行动取消预约。';
    return s.actionsRemaining < 1 ? '亲自到厅开场需要1行动，随后有限到场、故事、服药与散场均为已付服务。' : null;
  }
  if (g.status !== 'OPEN' || s.manipulator.ritual.playerLocation !== 'HALL' || g.startedWeek !== s.week) return '须在本周本人实际在场的同一场集会中操作。';
  if (command.type === 'ARRIVE_GROUP') {
    if (g.resonanceAttemptWeek !== null) return '本次故事已经结束，不追加群众或重开情绪窗口。';
    return g.groups.find(group => group.id === command.groupId)?.arrivalWeek === null ? null : '该区本场已经实际到达一次，未到者留在原住处，不能重抽补齐。';
  }
  if (g.resonanceAttemptWeek !== null) return '每场只有一次真实纪念故事与自愿共鸣，失败不能重抽。';
  return g.groups.some(group => group.arrivalWeek === null) ? '先核对四个原居民团各自的实际到场；登记人数不算在场。' : null;
}
export function applyManipulatorRitualCommand(s: SliceState, command: ManipulatorRitualCommand, c: SeerContext): void {
  rule(validateManipulatorRitualCommand(command), '集会命令无效。');
  const blocked = blockManipulatorRitualCommand(s, command); rule(!blocked, blocked ?? '当前无法进行集会行动。');
  const r = s.manipulator.ritual;
  if (command.type === 'BOOK_GATHERING') {
    const id = `manipulator-gathering-${r.gatherings.length + 1}`;
    s.actionsRemaining -= 1; s.cash -= MANIPULATOR_GATHERING_PRICE;
    r.gatherings.push({ id, source: MANIPULATOR_GATHERING_STORY, venueId: MANIPULATOR_HALL_ID, capacity: MANIPULATOR_HALL_CAPACITY, status: 'BOOKED', bookedWeek: s.week, plannedWeek: s.week + 1, startedWeek: null, closedWeek: null, groups: originalGroups(), resonanceAttemptWeek: null, resonanceOutcome: null, windowWeek: null, commonEmotion: null, consumedBottleId: null });
    r.activeGatheringId = id;
    c.note('预约原纪念与互助集会', `1行动、240便士，预约${id}第${s.week + 1}周起开场。四区各登记3000位原成年居民，当前实际到场0人，四团都在原住处；邀请和付款不生成群众。尚可正常度过本周，也可0行动取消，不退款。${MANIPULATOR_GATHERING_STORY}`); return;
  }
  const g = currentManipulatorGathering(s)!;
  if (command.type === 'OPEN_GATHERING') {
    s.actionsRemaining -= 1; g.status = 'OPEN'; g.startedWeek = s.week; r.playerLocation = 'HALL';
    c.note('本人实际到原厅开场', `第${s.week}周，你沿正常道路进入${MANIPULATOR_HALL_ID}，消耗1行动。四团尚在原住处，当前0人在场。余下四次到场核对、一次故事、服一原瓶或退出均是本次已付服务，0行动；须先实际散场才能离厅进行其它生活或推进时间。`); return;
  }
  if (command.type === 'ARRIVE_GROUP') {
    const group = g.groups.find(value => value.id === command.groupId)!, result = c.check('knowledge', 12), actual = arrivalCount(result.tier);
    group.arrivalWeek = s.week; group.arrivalOutcome = result.tier; group.arrivedCount = actual; group.presentCount = actual; group.location = 'HALL';
    c.note(`${group.title}实际入厅`, `原来源${group.source}沿${group.route}，知识12判定${result.roll}/${result.chance}，${result.tier}：实际${actual}人进入本场原厅，余下${group.registeredCount - actual}人留在原住处。0行动，不重抽、不复制、不把登记人数计入。当前同厅实有${presentCount(g)}/${MANIPULATOR_REQUIRED_ATTENDANCE}人。`); return;
  }
  if (command.type === 'RESONATE') {
    const result = c.check('will', 14); g.resonanceAttemptWeek = s.week; g.resonanceOutcome = result.tier;
    if (success(result.tier)) {
      g.commonEmotion = COMMON_EMOTION;
      for (const group of g.groups) if (group.location === 'HALL' && group.presentCount > 0) group.emotion = 'RESONANT';
      if (presentCount(g) >= MANIPULATOR_REQUIRED_ATTENDANCE) g.windowWeek = s.week;
    }
    c.note(g.windowWeek === s.week ? '同厅万人形成强烈共同情绪' : '本场未形成可服药的万人窗口', `已付服务，0行动。你讲述公开的旧桥救援与纪念故事；意志14判定${result.roll}/${result.chance}，${result.tier}。${success(result.tier) ? `当前同厅${presentCount(g)}位实际居民自主形成强烈的共同追念与互助之情。` : '居民各有感受，未形成强烈共同情绪，没有强迫或篡改。'}${g.windowWeek === s.week ? `窗口仅属本周当前原集会${g.id}，本人须仍在厅内，可独立确认服一瓶或0行动散场。` : `实际人数或共鸣未满足≥10000要求，原瓶未消耗；可0行动让所有到场者按原路回家，另付预约费并等待新的真实周。`}每场只有一次故事，不可反复重抽。`); return;
  }
  const wasBooked = g.status === 'BOOKED', actual = arrivedCount(g);
  closeManipulatorRitual(s, null);
  c.note(wasBooked ? '取消尚未到场的集会' : '原集会散场，实际群众返家', `0行动，${g.id}第${s.week}周结束。${wasBooked ? '四团始终在原住处，没有任何到场被计入。' : `${actual}位实际到场者沿各自原路线离厅返家，未到者一直留在家中；本人回到厅外。`}当前在场0人，窗口失效。已付240便士不返还，原瓶未耗、身体与精神不恢复；本场到场、失败和共鸣经过保留。`);
}

export function manipulatorRitualActions(s: SliceState): ManipulatorAction[] {
  if (!s.manipulator.guidanceKnown) return [];
  const g = currentManipulatorGathering(s), result: ManipulatorAction[] = [];
  const add = (id: string, label: string, cost: string, command: ManipulatorRitualCommand) => {
    const reason = blockManipulatorRitualCommand(s, command); result.push({ id, label, cost, command, enabled: reason === null, reason });
  };
  if (!g && s.progression.pathwayId === 'audience' && s.progression.sequence === 5) add('book-manipulator-gathering', '预约四区原居民的纪念互助集会', '1行动 · 240便士 · 下一真实周 · 邀请不等于到场', { type: 'BOOK_GATHERING' });
  if (g?.status === 'BOOKED') add('open-manipulator-gathering', '本人实际到原纪念厅开场', `1行动 · 已付服务 · 第${g.plannedWeek}周起`, { type: 'OPEN_GATHERING' });
  if (g?.status === 'OPEN') {
    for (const group of g.groups) if (group.arrivalWeek === null) add(`arrive-${group.id}`, `核对${group.title}实际到场`, '0行动 · 已付服务 · 知识12 · 本团仅一次实际入厅', { type: 'ARRIVE_GROUP', groupId: group.id });
    if (g.resonanceAttemptWeek === null) add('resonate-manipulator-gathering', '讲述纪念故事，等待居民自愿共鸣', '0行动 · 已付服务 · 意志14 · 本场仅一次', { type: 'RESONATE' });
  }
  if (g) add('leave-manipulator-gathering', g.status === 'BOOKED' ? '取消未到场的原集会预约' : '让原居民实际返家，本人离厅', '0行动 · 费用不退 · 不消耗原瓶 · 不恢复资源', { type: 'LEAVE_GATHERING' });
  return result;
}
export function projectManipulatorRitual(s: SliceState): ManipulatorRitualProjection {
  const known = s.manipulator.guidanceKnown, g = known ? currentManipulatorGathering(s) : undefined;
  const last = known ? s.manipulator.ritual.gatherings.at(-1) : undefined, shown = g ?? last;
  return {
    title: '同一场集会的万人强烈情绪共鸣',
    status: !known ? '尚未了解必要仪式' : !g ? '当前没有举行中的集会，过往人数不能服药' : g.status === 'BOOKED' ? '已预约，实际到场0人' : canConsumeManipulatorRitual(s) ? '当前同厅万人共同情绪窗口开放' : g.resonanceAttemptWeek !== null ? '本场没有可服药窗口，可0行动散场' : '已亲自到厅，正在核对实际到场',
    venue: known ? `${MANIPULATOR_HALL_ID}，容量12000，四处原门与原路均可退出。${MANIPULATOR_GATHERING_STORY}` : '',
    appointment: !g ? '没有待赴预约' : `第${g.bookedWeek}周支付240便士，第${g.plannedWeek}周起可实际开场；${g.startedWeek === null ? '本人在厅外，四团仍在原住处，可正常度过本周' : `第${g.startedWeek}周本人实际开场，余下有限服务0行动，散场前不能推进时间`}。`,
    emotion: !g || g.resonanceAttemptWeek === null ? '尚无当前强烈共同情绪。' : success(g.resonanceOutcome) ? `本场实际居民自愿共鸣于追念与互助；${g.windowWeek === s.week ? '仅本人仍在厅内、当前同厅实有万人时可服药。' : '人数未达万人，仍不可服药。'}` : '本场故事未形成强烈共同情绪，不可重抽或用能力强迫。',
    actualPresent: g ? presentCount(g) : 0, registeredCount: shown ? shown.groups.reduce((n, group) => n + group.registeredCount, 0) : 0,
    requiredCount: MANIPULATOR_REQUIRED_ATTENDANCE, currentEventId: g?.id ?? null, windowOpen: known && canConsumeManipulatorRitual(s),
    groups: shown ? shown.groups.map(group => ({
      id: group.id, title: group.title, source: group.source, registeredCount: group.registeredCount,
      presentCount: group.presentCount, arrivedCount: group.arrivedCount,
      location: group.location === 'HALL' ? '同一原纪念厅' : '原住处',
      emotion: group.emotion === 'RESONANT' ? '共同追念与互助，强烈共鸣' : '未在当前共同情绪中',
      arrival: group.arrivalWeek === null ? '本场尚未实际入厅；登记不算到场'
        : `第${group.arrivalWeek}周实际入厅${group.arrivedCount}人，${group.arrivalOutcome}；${group.registeredCount - group.arrivedCount}人一直在家。${group.returnedWeek === null ? '当前仍在原厅。' : `第${group.returnedWeek}周沿原路线返家，历史到场不计当前人数。`}`,
    })) : [],
    history: known ? s.manipulator.ritual.gatherings.map(item => ({ id: item.id, summary: `第${item.bookedWeek}周预约，第${item.plannedWeek}周起计划开场；${item.startedWeek === null ? '未实际开场' : `第${item.startedWeek}周实际开场`}，实际累计入厅${arrivedCount(item)}人，${item.resonanceOutcome === null ? '未尝试共鸣' : `共鸣${item.resonanceOutcome}`}，${item.windowWeek === null ? '无合格窗口' : `第${item.windowWeek}周曾有合格窗口`}；${item.consumedBottleId === null ? '未服原瓶' : `已耗同一原瓶${item.consumedBottleId}`}；${item.closedWeek === null ? '尚未结束' : `第${item.closedWeek}周结束，所有原居民在家，本人在厅外`}。` })) : [],
  };
}

/** Checks real source identity, one arrival per district, original counts, chronology and bottle linkage. */
export function validateManipulatorRitualState(s: SliceState): boolean {
  const raw: unknown = s.manipulator.ritual;
  if (!record(raw) || !shape(raw, ['playerLocation', 'activeGatheringId', 'gatherings']) || !['OUTSIDE', 'HALL'].includes(String(raw.playerLocation)) || !Array.isArray(raw.gatherings)) return false;
  if (raw.activeGatheringId !== null && typeof raw.activeGatheringId !== 'string') return false;
  const r = raw as unknown as ManipulatorRitualState, week = (value: unknown) => integer(value, 1, s.week);
  if (r.gatherings.length && (!s.manipulator.guidanceKnown || s.progression.pathwayId !== 'audience' || ![5, 4, 3, 2].includes(s.progression.sequence ?? 0) || !week(s.dreamwalker.promotionWeek))) return false;
  let active: ManipulatorGathering | undefined;
  const usedBottles = new Set<string>();
  for (const [index, g] of r.gatherings.entries()) {
    if (!record(g) || !shape(g, ['id', 'source', 'venueId', 'capacity', 'status', 'bookedWeek', 'plannedWeek', 'startedWeek', 'closedWeek', 'groups', 'resonanceAttemptWeek', 'resonanceOutcome', 'windowWeek', 'commonEmotion', 'consumedBottleId'])) return false;
    if (g.id !== `manipulator-gathering-${index + 1}` || g.source !== MANIPULATOR_GATHERING_STORY || g.venueId !== MANIPULATOR_HALL_ID || g.capacity !== MANIPULATOR_HALL_CAPACITY || !['BOOKED', 'OPEN', 'CLOSED', 'CANCELLED'].includes(g.status)) return false;
    if (!week(g.bookedWeek) || g.bookedWeek < s.dreamwalker.promotionWeek! || g.plannedWeek !== g.bookedWeek + 1 || !Array.isArray(g.groups) || g.groups.length !== 4) return false;
    if (s.manipulator.promotionWeek !== null && g.bookedWeek > s.manipulator.promotionWeek) return false;
    if (!s.manipulator.bottles.some(b => b.brewedWeek <= g.bookedWeek && (b.consumedWeek === null || b.consumedWeek >= g.bookedWeek))) return false;
    if (index > 0 && (r.gatherings[index - 1]!.closedWeek === null || r.gatherings[index - 1]!.closedWeek! > g.bookedWeek)) return false;
    const started = g.status === 'OPEN' || g.status === 'CLOSED', closed = g.status === 'CLOSED' || g.status === 'CANCELLED';
    if (started ? !week(g.startedWeek) || g.startedWeek! < g.plannedWeek : g.startedWeek !== null) return false;
    if (closed ? !week(g.closedWeek) || g.closedWeek! < g.bookedWeek : g.closedWeek !== null) return false;
    if (g.status === 'OPEN' && g.startedWeek !== s.week || g.status === 'CLOSED' && g.closedWeek !== g.startedWeek) return false;
    if (!closed) { if (active || index !== r.gatherings.length - 1) return false; active = g; }
    for (const [i, group] of g.groups.entries()) {
      if (!record(group) || !shape(group, ['id', 'title', 'source', 'home', 'route', 'registeredCount', 'arrivedCount', 'presentCount', 'location', 'emotion', 'arrivalWeek', 'arrivalOutcome', 'returnedWeek'])) return false;
      const original = MANIPULATOR_DISTRICTS[i]!;
      if (group.id !== original.id || group.title !== original.title || group.source !== original.source || group.home !== original.home || group.route !== original.route || group.registeredCount !== 3000 || !integer(group.arrivedCount, 0, 3000) || !integer(group.presentCount, 0, 3000)) return false;
      if (!['HOME', 'HALL'].includes(group.location) || !['CALM', 'RESONANT'].includes(group.emotion)) return false;
      if (group.arrivalWeek === null) {
        if (group.arrivalOutcome !== null || group.arrivedCount !== 0 || group.presentCount !== 0 || group.location !== 'HOME' || group.emotion !== 'CALM' || group.returnedWeek !== null) return false;
      } else {
        if (!started || group.arrivalWeek !== g.startedWeek || !tier(group.arrivalOutcome) || group.arrivedCount !== arrivalCount(group.arrivalOutcome)) return false;
        if (g.status === 'OPEN') {
          if (group.location !== 'HALL' || group.presentCount !== group.arrivedCount || group.returnedWeek !== null) return false;
        } else if (group.location !== 'HOME' || group.presentCount !== 0 || group.returnedWeek !== g.closedWeek || group.emotion !== 'CALM') return false;
      }
    }
    if (g.resonanceAttemptWeek === null) {
      if (g.resonanceOutcome !== null || g.windowWeek !== null || g.commonEmotion !== null || g.groups.some(group => group.emotion !== 'CALM')) return false;
    } else {
      if (!started || g.resonanceAttemptWeek !== g.startedWeek || !tier(g.resonanceOutcome) || g.groups.some(group => group.arrivalWeek === null)) return false;
      const resonant = success(g.resonanceOutcome), qualified = resonant && arrivedCount(g) >= MANIPULATOR_REQUIRED_ATTENDANCE;
      if (g.commonEmotion !== (resonant ? COMMON_EMOTION : null) || g.windowWeek !== (qualified ? g.startedWeek : null)) return false;
      if (g.status === 'OPEN' && g.groups.some(group => group.emotion !== (resonant ? 'RESONANT' : 'CALM'))) return false;
    }
    if (g.consumedBottleId !== null) {
      if (g.status !== 'CLOSED' || g.windowWeek === null || typeof g.consumedBottleId !== 'string' || usedBottles.has(g.consumedBottleId)) return false;
      const bottle = s.manipulator.bottles.find(b => b.id === g.consumedBottleId);
      if (!bottle || bottle.status !== 'CONSUMED' || bottle.consumedWeek !== g.closedWeek || bottle.ritualId !== g.id || bottle.ritualWindowWeek !== g.windowWeek) return false;
      usedBottles.add(g.consumedBottleId);
    }
  }
  if (r.activeGatheringId !== (active?.id ?? null) || r.playerLocation !== (active?.status === 'OPEN' ? 'HALL' : 'OUTSIDE')) return false;
  if (active?.status === 'OPEN' && (s.world.city !== 'BACKLUND' || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.health <= 0 || s.mind <= 0)) return false;
  return true;
}
