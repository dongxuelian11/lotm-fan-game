import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { stableStringify } from '../canonical.js';
import { sha256Hex } from '../checksum.js';
import { DeterministicActionRandomStream } from '../../resolution/deterministic-random.js';
import { compareGameDates, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import { SITE_IDS, PLOT_IDS, FACILITY_IDS, RESERVE_IDS, LOTS, COORDINATES, createTownState, transitionTown, validateTownState, validateTownCommand, townCommandBlock, townEvidence, hasUsableTownRegion, type TownCommand, type TownState, type HostFacts, type Place } from './town.js';
import type { AttendantMysteriesAction, AttendantMysteriesTownProjection, AttendantMysteriesBudget } from './types.js';

export const ATTENDANT_MYSTERIES_PLACES: Record<Place, string> = {
  base: '当代接待处', quarry: '石角采坑', 'reed-cave': '芦面洞穴', 'ash-grove': '灰皮林地', 'salt-vault': '盐眼旧窖', 'rain-ruin': '雨腔废墟', 'hollow-bank': '空木河岸',
  'new-alder-clearing': '新白榆空地', 'new-flint-clearing': '新燧石空地', 'quarry-reserve': '采坑北侧新线索', 'reed-reserve': '芦湾新线索', 'ash-reserve': '灰林北端新线索',
  'salt-reserve': '盐窖东侧新线索', 'rain-reserve': '雨墟东端新线索', 'hollow-reserve': '空木南岸新线索',
};
export const ATTENDANT_MYSTERIES_FACILITIES = { mill: '磨坊', bakery: '面包房', workshop: '工坊', clinic: '照料所', post: '邮务所', market: '集市' } as const;
const VISITOR_NAMES = { 'merchant-ada': '商人艾达，34岁', 'courier-neri': '信使奈莉，29岁', 'weaver-iven': '织工伊文，52岁' } as const;
const STATUS: Record<string, string> = { WILD: '原活体，尚可抵抗', INITIAL_CONTROL: '暂时初控，尚活着', CONTROLLED: '已不可逆转化的秘偶', INERT: '失去控制的遗骸', DEAD: '原体已经死亡' };
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const int = (v: unknown, a = 0, b = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= a && (v as number) <= b;
const ORIGIN = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 } as const;
export function attendantMysteriesSourceDigest(s: SliceState): string {
  return sha256Hex(stableStringify([s.seer.batches, s.clown, s.magician, s.faceless, s.marionettist, s.bizarroSorcerer, s.ancientScholar, s.miracleWorker]));
}
export function attendantMysteriesBudget(s: SliceState): AttendantMysteriesBudget {
  return { actions: s.actionsRemaining, health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash, pollution: s.seer.pollution,
    sequence: s.progression.sequence as 2 | 1, acting: s.progression.acting, coreStats: { ...s.character.coreStats }, mastery: { ...s.progression.mastery },
    completedSources: [...s.seer.completedSources], injuries: structuredClone(s.injuries), injuryRisk: s.injuryRisk };
}
/** Bounded game control strength. The actual will/perception and retained thread
 * mastery remain inputs; no purchase or promotion grants missing mastery. */
export const attendantMysteriesControlPower = (s: SliceState) => Math.min(100, Math.floor(50 + (s.character.coreStats.will + s.character.coreStats.perception) / 4 + (s.progression.mastery['diviner.s5.spirit-threads'] ?? 0) / 5));
export const attendantMysteriesExternalWorms = (s: SliceState) => s.bizarroSorcerer.life.worms.split - s.bizarroSorcerer.life.worms.lost - s.bizarroSorcerer.life.worms.recalled;
export function attendantMysteriesTownHost(s: SliceState, die: number | null): HostFacts {
  return { week: s.week, active: s.status === 'ACTIVE', sequence: s.progression.sequence as 2 | 1, health: s.health, mind: s.mind, spirituality: s.spirituality, cash: s.cash,
    actions: s.actionsRemaining, externalLiveWorms: attendantMysteriesExternalWorms(s), controlPower: attendantMysteriesControlPower(s), die };
}
export const hasAttendantMysteriesTownLock = (s: SliceState) => !!s.attendantMysteries.town && (s.attendantMysteries.town.operatorAt !== 'base' || s.attendantMysteries.town.originals.some(o => o.status === 'INITIAL_CONTROL'));
export function attendantMysteriesTownBlock(s: SliceState, c: TownCommand): string | null {
  const a = s.attendantMysteries, t = a.town;
  if (!a.guidanceKnown || !t || s.progression.pathwayId !== 'diviner' || ![2, 1].includes(s.progression.sequence ?? 0) || s.status !== 'ACTIVE') return '先活着取得诡秘侍者配方与城镇指导。';
  if (a.preparation) return '先取消当前原瓶服药准备，再改变原城镇。';
  if (c.type === 'BEGIN_CONTROL' && s.health <= 4) return '初控失败可能损失4健康；先从原路退回休养。';
  const error = townCommandBlock(t, c, attendantMysteriesTownHost(s, c.type === 'BEGIN_CONTROL' || c.type === 'MOVE_TOWN' ? 100 : null));
  return error ? townReason(error) : null;
}
export function applyAttendantMysteriesTown(s: SliceState, c: TownCommand, ctx: SeerContext): void {
  const reason = attendantMysteriesTownBlock(s, c); if (reason) throw new Error(reason);
  const before = attendantMysteriesBudget(s), randomBefore = s.random.cursor;
  const die = c.type === 'BEGIN_CONTROL' || c.type === 'MOVE_TOWN' ? ctx.roll(1, 100) : null;
  const host = attendantMysteriesTownHost(s, die), result = transitionTown(s.attendantMysteries.town!, c, host), cost = result.cost;
  s.actionsRemaining -= cost.actions; s.cash -= cost.cash; s.spirituality -= cost.spirituality; s.mind -= cost.mind; s.health -= cost.health;
  s.seer.pollution = Math.min(100, s.seer.pollution + cost.pollution); s.attendantMysteries.town = result.state;
  s.attendantMysteries.townJournal.push({ week: s.week, date: { ...s.date }, revision: s.revision, command: structuredClone(c), actor: { name: s.character.name, pathwayId: 'diviner', sourceHistoryDigest: attendantMysteriesSourceDigest(s) },
    before, after: attendantMysteriesBudget(s), host, paid: structuredClone(cost), randomBefore, randomAfter: s.random.cursor, journalIndex: result.state.journal.length - 1 });
  ctx.note(townLabel(c, result.state), `行动−${cost.actions}、${cost.cash}便士、灵性−${cost.spirituality}、精神−${cost.mind}、健康−${cost.health}、排异+${cost.pollution}。${die === null ? '' : `本次实际骰${die}。`}${townEffect(c, result.state)}`);
}
function townEffect(c: TownCommand, t: TownState): string {
  if (c.type === 'OCCUPY_ROLE') return `让${c.originalId}接替真实空缺${c.roleId}`;
  if ('originalId' in c) { const o = t.originals.find(x => x.id === c.originalId)!; return `${o.id}：${STATUS[o.status]}，原健康${o.health}，实际位于${ATTENDANT_MYSTERIES_PLACES[o.location]}。${o.wormId ? `所用原灵之虫${o.wormId}。` : ''}`; }
  if (c.type === 'LIVE_WEEK') { const f = t.fates.at(-1)!; return `本次${f.id}涉及${f.participants.length}位原居民，实际物资支出与产物记入原账；既往事件没有重置。`; }
  if (c.type === 'FORM_REGION' || c.type === 'REVERIFY_REGION') return `实际区域${t.region?.id}对应${ATTENDANT_MYSTERIES_PLACES[t.plot!]}；服药时仍须核对居民、原场地与往来。`;
  return `本人实际位于${ATTENDANT_MYSTERIES_PLACES[t.operatorAt]}；原物、原体、往来和已付成本保留。`;
}
export function validateAttendantMysteriesTown(s: SliceState): boolean {
  try {
    const a = s.attendantMysteries, t = a.town;
    if (!a.guidanceKnown) return t === null && a.townJournal.length === 0;
    if (!t || !validateTownState(t) || t.originWeek !== a.guidanceWeek || t.journal.length !== a.townJournal.length || t.lastObservedWeek > s.week) return false;
    let lastRevision = -1, lastWeek = t.originWeek, lastRandom = -1;
    for (const [i, e] of a.townJournal.entries()) {
      const j = t.journal[i]!;
      if (!same(Object.keys(e).sort(), ['week', 'date', 'revision', 'command', 'actor', 'before', 'after', 'host', 'paid', 'randomBefore', 'randomAfter', 'journalIndex'].sort()) ||
        !int(e.week, lastWeek, s.week) || !int(e.revision, lastRevision + 1, s.revision) || !isValidGameDate(e.date) || compareGameDates(e.date, s.date) > 0 || gameDaysBetween(ORIGIN, e.date) !== 7 * (e.week - 1) + s.ancientScholar.ritual.calendarRemainderDays ||
        e.journalIndex !== i || !same(j, { command: e.command, host: e.host, cost: e.paid }) || !same(e.actor, { name: s.character.name, pathwayId: 'diviner', sourceHistoryDigest: a.sourceHistoryDigest }) ||
        !int(e.randomBefore, Math.max(0, lastRandom), s.random.cursor) || !int(e.randomAfter, e.randomBefore, s.random.cursor)) return false;
      const b = e.before;
      if (!validAttendantMysteriesBudget(b) || !validAttendantMysteriesBudget(e.after)) return false;
      const expectedHost: HostFacts = { week: e.week, active: true, sequence: b.sequence, health: b.health, mind: b.mind, spirituality: b.spirituality, cash: b.cash, actions: b.actions,
        externalLiveWorms: attendantMysteriesExternalWorms(s), controlPower: Math.min(100, Math.floor(50 + (b.coreStats.will + b.coreStats.perception) / 4 + (b.mastery['diviner.s5.spirit-threads'] ?? 0) / 5)), die: null };
      const random = new DeterministicActionRandomStream(s.random.seed, e.randomBefore);
      if (e.command.type === 'BEGIN_CONTROL' || e.command.type === 'MOVE_TOWN') expectedHost.die = random.nextInt(1, 100);
      if (random.cursor !== e.randomAfter || !same(e.host, expectedHost)) return false;
      const paid = e.paid, after = { ...b, actions: b.actions - paid.actions, cash: b.cash - paid.cash, spirituality: b.spirituality - paid.spirituality, mind: b.mind - paid.mind, health: b.health - paid.health, pollution: Math.min(100, b.pollution + paid.pollution) };
      if (!same(e.after, after)) return false;
      lastRevision = e.revision; lastWeek = e.week; lastRandom = e.randomAfter;
    }
    return true;
  } catch { return false; }
}
export function validAttendantMysteriesBudget(v: AttendantMysteriesBudget): boolean {
  return !!v && typeof v === 'object' && !Array.isArray(v) && same(Object.keys(v).sort(), ['actions', 'health', 'mind', 'spirituality', 'cash', 'pollution', 'sequence', 'acting', 'coreStats', 'mastery', 'completedSources', 'injuries', 'injuryRisk'].sort()) &&
    int(v.actions, 0, 10) && int(v.health, 1, 100) && int(v.mind, 0, 100) && int(v.spirituality, 0, 120) && int(v.cash) && int(v.pollution, 0, 100) && [2, 1].includes(v.sequence) && int(v.acting, 0, 100) &&
    !!v.coreStats && same(Object.keys(v.coreStats).sort(), ['physique', 'perception', 'will', 'knowledge'].sort()) && Object.values(v.coreStats).every(n => int(n, 0, 500)) &&
    !!v.mastery && typeof v.mastery === 'object' && !Array.isArray(v.mastery) && Object.values(v.mastery).every(n => int(n, 0, 500)) &&
    Array.isArray(v.completedSources) && v.completedSources.every(x => typeof x === 'string' && x.length > 0 && x.length <= 200) && new Set(v.completedSources).size === v.completedSources.length &&
    Array.isArray(v.injuries) && v.injuries.every(x => x && typeof x.id === 'string' && ['HEAVY', 'LIGHT'].includes(x.severity) && int(x.acquiredRevision) && (x.treatedRevision === null || int(x.treatedRevision, x.acquiredRevision))) && int(v.injuryRisk);
}
const LABELS: Record<string, string> = { HIRE_CART: '亲领唯一运输车', UNLOAD_CART: '在原镇卸下实物', FOUND: '让原居民开始镇内生活', FORM_REGION: '核验新生灵界对应区域', REVERIFY_REGION: '重新核证既有灵界区域', REPAIR_RELOCATION: '修复实际搬迁损坏', RELEASE_INITIAL: '放开仍活着的初控对象' };
export function townLabel(c: TownCommand, t: TownState): string {
  if (c.type === 'TRAVEL') return `沿原路前往${ATTENDANT_MYSTERIES_PLACES[c.to]}`;
  if (c.type === 'SURVEY_SITE') return `亲查${ATTENDANT_MYSTERIES_PLACES[c.siteId]}原生物`;
  if (c.type === 'SURVEY_PLOT') return `亲查${ATTENDANT_MYSTERIES_PLACES[c.plotId]}为空地`;
  if (c.type === 'BUY_LOT') return `购买并装车：${c.lotId}`;
  if (c.type === 'BUILD') return `建成原${ATTENDANT_MYSTERIES_FACILITIES[c.facilityId]}`;
  if (c.type === 'LIVE_WEEK') return `${c.choice === 'FULFILL' ? '完成' : '接受实际减产后果：简办'}本阶段第${c.eventIndex + 1}周生活事件`;
  if (c.type === 'OCCUPY_ROLE') return `让${c.originalId}接替真实空缺${c.roleId}`;
  if ('originalId' in c) return `${({ RELEASE_INITIAL: '放开仍活着的初控对象', BEGIN_CONTROL: '尝试初控', CONVERT: '不可逆转化', ASSIGN_WORM: '实际分虫赋予', TRANSPORT: '让原身体实际走到镇内', RECALL_WORM: '收回原灵之虫', END_CONTROL: '结束原控制', STAFF: '安排原岗位' } as Record<string, string>)[c.type] ?? c.type} ${c.originalId}`;
  if ('visitorId' in c) return `${({ MEET_VISITOR: '接待并询问本次意愿', EXCHANGE: '履行本次真实往来', WITHDRAW_VISITOR: '接受撤回', SEND_VISITOR_HOME: '沿原路送别' } as Record<string, string>)[c.type]}：${VISITOR_NAMES[c.visitorId]}`;
  if (c.type === 'CONFIRM_DELIVERY') return `核实原信后续送达：${c.letterId}`;
  if (c.type === 'MOVE_TOWN') return `搬往${ATTENDANT_MYSTERIES_PLACES[c.plotId]}，旧往来不再计入新址`;
  if (c.type === 'COMMISSION_REPLACEMENT') return `为真实空缺${c.roleId}付费调查独立新来源`;
  if (c.type === 'VERIFY_REPLACEMENT') return `隔周亲核${ATTENDANT_MYSTERIES_PLACES[c.sourceId]}新原体`;
  if ('phaseId' in c) return `${({ COMMISSION_PHASE: '付费筹备独立后续生活阶段', VERIFY_PHASE_SUPPLY: '隔周核实新原物装车', START_PHASE: '开始新阶段并保留旧账' } as Record<string, string>)[c.type]} ${c.phaseId}`;
  return LABELS[c.type] ?? '核对城镇原记录';
}
function townReason(error: string): string {
  const phrases: [string, string][] = [
    ['Insufficient actual', '当前行动、金钱、灵性或身心不足；原路回接待处工作或休养后再来。'], ['initial control before leaving', '先完成或释放当前初控，再离开同一原活体。'], ['same-week retry', '本周已尝试这名原活体，须跨周再来；不能反复重抽。'], ['same week', '须在本周完成同一初控，或释放后重新筹备。'],
    ['physically with', '须亲自在同一原身体旁。'], ['No shared worm', '实际已分灵之虫达到50容量，先核对并收回可回收原虫。'], ['Missing finite', '原镇实际物资不足；需把尚未用过的原批实物运来并卸下。'], ['original lot is exhausted', '这一原批已购买，不能刷新旧库存。'],
    ['later game week', '须实际跨周，并到原交接地点核验新来源。'], ['already', '该原对象或此项原记录已存在，不能重复领取或覆写。'], ['at base', '须本人回到当代接待处办理。'], ['real loaded cart', '须把同一装货运输车实际带到镇内再卸货。'], ['cart', '须同一原车在场且载重未超限，原货不能隔空转移。'],
    ['previously unsettled', '须亲自核查尚未形成对应区域的新空地。'], ['Twenty-four', '尚未齐备24个实际分虫控制的原居民和6座已配员设施。'], ['twelve actual', '尚未完成12个实际成功生活周。'], ['All 24', '24个岗位的原秘偶必须实际受控、在场并可行动。'], ['Six operational', '6座原设施必须建成、完好且各有4名原居民。'], ['Every individual', '每位原居民均须参与本址真实生活。'], ['fate graph', '居民命运和往来尚未连成实际相互影响的整体。'], ['All six', '所有6座设施都须参与实际生活。'], ['Three independent', '三位独立外客的货物、信件送达和贸易尚未全部完成。'],
  ];
  return phrases.find(([text]) => error.includes(text))?.[1] ?? '这一操作的原地点、对象、当次许可或前置记录尚不具备；请按当前城镇目标先完成缺项。';
}
function candidates(t: TownState): TownCommand[] {
  const out: TownCommand[] = [], at = t.operatorAt;
  const add = (c: TownCommand) => out.push(c);
  if (at !== 'base') add({ type: 'TRAVEL', to: 'base' });
  for (const o of t.originals.filter(o => o.location === at)) {
    if (o.status === 'WILD' && o.surveyedWeek !== null) add({ type: 'BEGIN_CONTROL', originalId: o.id });
    if (o.status === 'INITIAL_CONTROL') { add({ type: 'CONVERT', originalId: o.id, confirmedIrreversibleDeath: true }); add({ type: 'RELEASE_INITIAL', originalId: o.id }); }
    if (o.status === 'CONTROLLED') {
      if (!o.wormId) add({ type: 'ASSIGN_WORM', originalId: o.id });
      else { if (at !== t.plot && t.plot) add({ type: 'TRANSPORT', originalId: o.id }); add({ type: 'RECALL_WORM', originalId: o.id }); }
      if (at === t.plot && !o.facility) { const role = t.roles.find(r => r.currentOriginalId === o.id); if (role) add({ type: 'STAFF', originalId: o.id, facilityId: role.facilityId }); }
      add({ type: 'END_CONTROL', originalId: o.id, confirmedLoss: true });
    }
  }
  const site = t.sites.find(s => s.id === at); if (site && site.surveyedWeek === null) add({ type: 'SURVEY_SITE', siteId: site.id });
  if (PLOT_IDS.includes(at as typeof PLOT_IDS[number]) && !t.surveyedPlots.includes(at as typeof PLOT_IDS[number])) add({ type: 'SURVEY_PLOT', plotId: at as typeof PLOT_IDS[number] });
  if (at === 'base') {
    if (!t.cart.hired) add({ type: 'HIRE_CART' });
    for (const lot of LOTS.filter(l => !t.boughtLots.includes(l.id))) add({ type: 'BUY_LOT', lotId: lot.id });
    for (const role of t.roles) { const original = t.originals.find(o => o.id === role.currentOriginalId)!; if (['DEAD', 'INERT'].includes(original.status)) { const source = RESERVE_IDS.find(id => !t.replacements.some(r => r.sourceId === id)); if (source) add({ type: 'COMMISSION_REPLACEMENT', roleId: role.id, sourceId: source }); } }
    if (t.foundedWeek !== null) for (const id of ['reserve-phase-3', 'reserve-phase-4'] as const) { const phase = t.phases.find(p => p.id === id); if (!phase) add({ type: 'COMMISSION_PHASE', phaseId: id }); else if (phase.status === 'COMMISSIONED') add({ type: 'VERIFY_PHASE_SUPPLY', phaseId: id }); }
  }
  for (const request of t.replacements) {
    if (request.verifiedWeek === null && at === request.sourceId) add({ type: 'VERIFY_REPLACEMENT', sourceId: request.sourceId });
    if (request.originalId && at === t.plot) { const role = t.roles.find(r => r.id === request.roleId)!; if (role.currentOriginalId !== request.originalId) add({ type: 'OCCUPY_ROLE', roleId: role.id, originalId: request.originalId }); }
  }
  if (t.plot === at) {
    if (t.cart.cargo.length) add({ type: 'UNLOAD_CART' });
    for (const f of t.facilities) if (f.builtWeek === null) add({ type: 'BUILD', facilityId: f.id });
    if (t.foundedWeek === null) add({ type: 'FOUND' }); else {
      const phase = t.phases.find(p => p.id === t.activePhaseId)!;
      if (phase.nextEvent < phase.limit) { add({ type: 'LIVE_WEEK', eventIndex: phase.nextEvent, choice: 'FULFILL' }); add({ type: 'LIVE_WEEK', eventIndex: phase.nextEvent, choice: 'CUT_CORNERS' }); }
      for (const phase of t.phases.filter(p => p.status === 'DELIVERED' && p.id !== 'initial')) add({ type: 'START_PHASE', phaseId: phase.id as 'reserve-phase-3' | 'reserve-phase-4', confirmedAbandon: true });
      for (const v of t.visitors) if (v.location === 'outside') add({ type: 'MEET_VISITOR', visitorId: v.id }); else { add({ type: 'EXCHANGE', visitorId: v.id }); add({ type: 'WITHDRAW_VISITOR', visitorId: v.id }); add({ type: 'SEND_VISITOR_HOME', visitorId: v.id }); }
      for (const letter of t.letters.filter(l => l.deliveredWeek === null)) add({ type: 'CONFIRM_DELIVERY', letterId: letter.id });
      add({ type: t.region ? 'REVERIFY_REGION' : 'FORM_REGION' });
      if (t.relocations.some(r => r.status === 'FAILED' && r.repairedWeek === null)) add({ type: 'REPAIR_RELOCATION' });
      for (const plotId of PLOT_IDS.filter(id => id !== t.plot)) add({ type: 'MOVE_TOWN', plotId, confirmedBrokenLinks: true });
    }
  }
  const destinations: Place[] = [...PLOT_IDS.filter(id => !t.surveyedPlots.includes(id) || id === t.plot), ...SITE_IDS.filter(id => t.originals.some(o => o.site === id && ['WILD', 'CONTROLLED'].includes(o.status) && o.location !== t.plot)), ...t.replacements.filter(r => r.verifiedWeek === null).map(r => r.sourceId), ...t.originals.filter(o => ['WILD', 'INITIAL_CONTROL', 'CONTROLLED'].includes(o.status) && o.location !== t.plot).map(o => o.location)];
  for (const to of new Set(destinations)) if (to !== at) add({ type: 'TRAVEL', to });
  return out;
}
export function attendantMysteriesTownActions(s: SliceState): AttendantMysteriesAction[] {
  const t = s.attendantMysteries.town; if (!t) return [];
  const actions = candidates(t).map(c => { const reason = attendantMysteriesTownBlock(s, c); return { id: `AM1:TOWN:${stableStringify(c)}`, label: townLabel(c, t), cost: townCost(c), enabled: reason === null, reason,
    command: { type: 'TOWN', command: c } as const, cleanup: c.type === 'TRAVEL' && c.to === 'base' || (c.type === 'END_CONTROL' || c.type === 'RELEASE_INITIAL'), irreversible: ['CONVERT', 'END_CONTROL', 'MOVE_TOWN', 'START_PHASE'].includes(c.type) }; });
  const valid = actions.filter(a => a.enabled), pick = (type: string) => valid.find(a => a.command.command.type === type);
  let preferred: AttendantMysteriesAction | undefined;
  if (t.originals.some(o => o.status === 'INITIAL_CONTROL')) preferred = pick('CONVERT') ?? pick('RELEASE_INITIAL');
  preferred ??= pick('UNLOAD_CART') ?? pick('ASSIGN_WORM') ?? pick('OCCUPY_ROLE') ?? pick('STAFF') ?? pick('TRANSPORT') ?? pick('SURVEY_PLOT') ?? pick('HIRE_CART') ?? pick('BUY_LOT') ?? pick('BUILD') ?? pick('SURVEY_SITE') ?? pick('BEGIN_CONTROL') ?? pick('VERIFY_REPLACEMENT') ?? pick('FOUND') ?? pick('CONFIRM_DELIVERY') ?? pick('EXCHANGE');
  if (!preferred && t.foundedWeek !== null) preferred = !t.region && townEvidence(t, s.week).ready ? pick('FORM_REGION') : undefined;
  preferred ??= pick('LIVE_WEEK') ?? pick('MEET_VISITOR') ?? pick('SEND_VISITOR_HOME');
  if (!preferred) {
    const destination = !t.plot ? PLOT_IDS[0] : !t.cart.hired || t.cart.cargo.length === 0 && t.facilities.some(f => f.builtWeek === null) && LOTS.some(l => !t.boughtLots.includes(l.id)) ? 'base' :
      t.cart.cargo.length ? t.plot : t.originals.find(o => o.status === 'CONTROLLED' && (!o.wormId || o.location !== t.plot))?.location ??
      t.originals.find(o => o.status === 'WILD' && o.attemptedWeek !== s.week)?.location ?? (t.operatorAt !== t.plot ? t.plot : 'base');
    preferred = valid.find(a => a.command.command.type === 'TRAVEL' && a.command.command.to === destination) ?? valid.find(a => a.cleanup) ?? valid[0];
  }
  if (preferred) preferred.preferredAction = true;
  return actions;
}
function townCost(c: TownCommand): string {
  if (c.type === 'TRAVEL') return c.to === 'base' ? '0行动，沿实际原路返回' : '1行动，4便士，实际路程';
  if (c.type === 'RELEASE_INITIAL') return '0行动，原活体保留并停止初控';
  if (c.type === 'LIVE_WEEK') return `1行动，${c.choice === 'FULFILL' ? 10 : 0}便士、4灵性，事件原物资`;
  if (c.type === 'CONVERT') return '0行动，8灵性；原活体不可逆死亡转化';
  if (c.type === 'BEGIN_CONTROL') return '1行动，3灵性；失败−4健康，原体受伤';
  if (c.type === 'ASSIGN_WORM') return '0行动，3灵性、2精神，实际占用1灵之虫';
  if (c.type === 'END_CONTROL') return '0行动；未收原虫则损10精神、排异+10';
  if (c.type === 'RECALL_WORM') return '0行动，2灵性';
  if (c.type === 'BUY_LOT') return `1行动，${LOTS.find(l => l.id === c.lotId)!.price}便士；实际原货装车`;
  return ({ HIRE_CART: '1行动，24便士', UNLOAD_CART: '0行动，实物卸入本镇', SURVEY_SITE: '1行动，12便士', SURVEY_PLOT: '1行动，24便士', BUILD: '1行动，12便士，3木料2石料', STAFF: '0行动，原身体在场', TRANSPORT: '1行动，4便士，原身体实际行走', FOUND: '1行动，6灵性', LIVE_WEEK: '1行动，6便士4灵性，事件原物资', FORM_REGION: '1行动，12灵性', REVERIFY_REGION: '1行动，6灵性', MOVE_TOWN: '3行动，72便士12灵性，旧址往来失效', COMMISSION_REPLACEMENT: '1行动，48便士', VERIFY_REPLACEMENT: '1行动，48便士，隔周亲核', COMMISSION_PHASE: '1行动，48便士', VERIFY_PHASE_SUPPLY: '1行动，96便士，隔周实物到货' } as Record<string, string>)[c.type] ?? '按当次原对象与实际物资结算';
}
export function projectAttendantMysteriesTown(s: SliceState): AttendantMysteriesTownProjection {
  const t = s.attendantMysteries.town, actions = attendantMysteriesTownActions(s);
  if (!t) return { title: '秘偶城镇', summary: '先取得城镇仪式指导。', location: '当代接待处', nextStep: '学习配方与真实城镇要求。', preferredActionId: null, residents: [], facilities: [], visitors: [], ledger: [], requirements: [], region: '尚未形成', ready: false, actions };
  const proof = townEvidence(t, s.week), next = actions.find(a => a.preferredAction), residents = t.originals.map(o => ({ id: o.id, name: `原居民来源${o.id}`, source: ATTENDANT_MYSTERIES_PLACES[o.site], bodyId: o.bodyId, alive: o.alive, status: STATUS[o.status]!, location: ATTENDANT_MYSTERIES_PLACES[o.location], facility: o.facility ? ATTENDANT_MYSTERIES_FACILITIES[o.facility] : '尚未入岗', worm: o.wormId ?? '未占用', fateCount: o.fateIds.length }));
  return { title: '秘偶城镇 · 原人原物的真实生活', summary: `${t.roles.filter(r => { const o = t.originals.find(o => o.id === r.currentOriginalId)!; return o.status === 'CONTROLLED' && !!o.wormId && o.location === t.plot; }).length}/24个实际在镇岗位；${t.facilities.filter(f => f.builtWeek !== null).length}/6座设施；${proof.fateIds.length}段有效生活事件。`,
    location: ATTENDANT_MYSTERIES_PLACES[t.operatorAt], nextStep: next?.label ?? '当前没有可执行的镇内操作，可以沿原路回接待处筹备或休养。', preferredActionId: next?.id ?? null, residents,
    facilities: t.facilities.map(f => ({ id: f.id, label: ATTENDANT_MYSTERIES_FACILITIES[f.id], built: f.builtWeek !== null, staffed: f.staff.length, condition: f.condition, output: f.output })),
    visitors: t.visitors.map(v => ({ id: v.id, label: VISITOR_NAMES[v.id], location: v.location === 'outside' ? '原镇外' : ATTENDANT_MYSTERIES_PLACES[v.location], consent: v.consent?.status === 'GRANTED' ? '仅本次往来同意' : v.consent?.status === 'USED' ? '本次已履行' : v.consent?.status === 'WITHDRAWN' ? '已撤回' : '尚未取得本次同意', completed: t.interactions.filter(i => i.visitorId === v.id && i.completedWeek !== null).length })),
    ledger: [`当前第${s.week}周，建镇周${t.foundedWeek ?? '尚未建镇'}；现场有效生活起点${t.proofSinceWeek ?? '未开始'}。`, `灵之虫占用${t.worms.filter(w => w.status === 'ASSIGNED').length}+既存${attendantMysteriesExternalWorms(s)}/50；原回收和丢失分别保留。`, `运输车${t.cart.hired ? `在${ATTENDANT_MYSTERIES_PLACES[t.cart.location]}` : '尚未领取'}；${t.cargoReceipts.length}份实际卸货记录。`, `原镇物资：${Object.entries(t.goods).sort(([a], [b]) => a.localeCompare(b)).map(([k, n]) => `${({timber:'木料',stone:'石料',grain:'粮食',cloth:'布料',fuel:'燃料',paper:'纸张',metal:'金属',tools:'工具',herbs:'草药',ore:'矿石',ink:'墨水',flour:'面粉',bread:'面包',salt:'盐'} as Record<string,string>)[k] ?? k} ${n}`).join('、')}。`, `原往来${t.interactions.length}，旧灵界区域${t.retiredRegions.length}；旧死亡${t.originals.filter(o => o.status === 'DEAD' || o.status === 'INERT').length}。`],
    requirements: proof.blockers.map(b => ({ label: townReason(b), complete: false, detail: townReason(b) })).concat(proof.ready ? [{ label: '本址居民生活、外来往来与时间均已实核', complete: true, detail: '仍须在本址形成或重新核证对应灵界区域，服药不能用数量代替。' }] : []),
    region: t.region ? `${t.region.id}，第${t.region.formedWeek}周形成，第${t.region.lastVerifiedWeek}周核证` : '尚未形成本址新区域', ready: hasUsableTownRegion(t, s.week), actions };
}
