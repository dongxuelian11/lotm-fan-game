import type { PublicGameDate } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import { addGameDays, addGameYears, compareGameDates, completedGameYears, formatGameDate, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import type { SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasUndyingRitualLock } from '../undying/ritual.js';
import { hasUndyingEncounterLock } from '../undying/encounter.js';
import { hasUndyingOldPractice, validateUndyingLife } from '../undying/life.js';
import { closeFerrymanOriginalEra, hasFerrymanRitualLock } from '../ferryman/index.js';
import { initializeFerrymanEra } from '../ferryman/era.js';
import { LONG_CHAPTER_SUPPORT_IDS, type LongChapterCommand, type LongChapterCustodian, type LongChapterObject, type LongChapterProjection, type LongChapterState } from './types.js';

const START_DATE: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
const REPLY_ID = 'SG6-REPLY-1';
const REPLY_SOURCE = 'spirit-guide:SG6-GRAY-FEATHER:actual-reply';
const COST = 960;
const SUPPORT_LABELS: Record<typeof LONG_CHAPTER_SUPPORT_IDS[number], string> = {
  SORT_RECORDS: '实际分拣原保管目录', CHECK_CHEST: '实际检查原保管箱', COPY_HANDOVER: '实际整理旧交接记录', PREPARE_ROOM: '实际准备供养房间',
};
const RESIDENCE_RECORD_BOUNDARY = '首次六十年周期及跨过小说末日后的新时代是本作有限原创G后世分支，不宣称原著未来。七天复起与数值为G可玩规则，原著实际复起时长未定；不开放任意复活、普通致命伤抢救、三百年章节或序列3。';
const BOUNDARY = '首次六十年周期及跨过小说末日后的新时代是本作有限原创G后世分支，不宣称原著未来。七天复起与数值为G可玩规则，原著实际复起时长未定；不开放任意复活、普通致命伤抢救或三百年章节。完成有限寻回并带原物离开后，可单独交接摆渡人章节；不重开旧时代。';
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const dateText = (date: PublicGameDate) => formatGameDate(date);
const firstCycle = (s: SliceState) => s.progression.pathwayId === 'death' && s.progression.sequence === 4;
const preparing = (s: SliceState) => ['PREPARING', 'RESIDING'].includes(s.longChapter.phase);
const revived = (s: SliceState) => ['AMNESIAC', 'PARTIAL_RECOVERY'].includes(s.longChapter.phase);
const remainingCost = (l: LongChapterState) => COST - l.supportTasks.length * 200 - (l.deadlineSupportCompleted ? 160 : 0);

export function createLongChapterState(): LongChapterState {
  return { handoff: null, phase: 'NONE', facilityId: 'LC-CARE-HOUSE', chestId: 'LC-CARE-CHEST-1', location: 'OUTSIDE', reviewedDate: null,
    supportTasks: [], paidPennies: 0, paidDate: null, cancellations: 0,
    deadlinePreparationGranted: false, deadlinePreparationRemaining: 0, deadlineSupportCompleted: false,
    releasedSpiritDate: null, bookId: 'UDY4-BOOK-1', bookDeposits: 0, bookWithdrawals: 0, retainedObjectId: null,
    departureDate: null, departureWeek: null, cycleDeathDate: null, revivedDate: null, elapsedDays: 0, calendarRemainderDays: 0,
    body: null, custodians: [], people: [], objects: [], recoveredSources: [], mentallyStable: false,
    newLife: { week: null, works: 0, rests: 0, weeks: 0, income: 0, expenses: 0, emergencyWorks: 0, emergencyWorkUsed: false } };
}
export function isLongChapterEraClosed(s: SliceState): boolean { return s.longChapter?.cycleDeathDate !== null && s.longChapter?.cycleDeathDate !== undefined; }
export function hasLongChapterHandoff(s: SliceState): boolean { return s.longChapter?.handoff?.target === 'FERRYMAN'; }
export function hasLongChapterLock(s: SliceState): boolean {
  const l = s.longChapter;
  return !!l && (isLongChapterEraClosed(s) || l.phase === 'RESIDING' || s.undying.life.book.location === 'CARE_CHEST');
}
/** Guard the next ordinary seven-day pulse. Never silently cross, rewind, or simulate thousands of bills. */
export function longChapterBlocksOrdinaryPulse(s: SliceState): boolean {
  if (isLongChapterEraClosed(s)) return true;
  const date = s.undying.lifecycle.expectedCycleDate;
  return firstCycle(s) && s.undying.lifecycle.experiencedCycles === 0 && date !== null && compareGameDates(addGameDays(s.date, 7), date) >= 0;
}
export function validateLongChapterCommand(v: unknown): v is LongChapterCommand {
  if (!record(v)) return false;
  if (v.type === 'PREPARE_SUPPORT') return shape(v, ['type', 'taskId']) && LONG_CHAPTER_SUPPORT_IDS.includes(v.taskId as typeof LONG_CHAPTER_SUPPORT_IDS[number]);
  if (v.type === 'PAY_RESIDENCE' || v.type === 'LIVE_TO_CYCLE') return shape(v, ['type', 'confirmed']) && v.confirmed === true;
  return shape(v, ['type']) && ['REVIEW', 'DEADLINE_SUPPORT', 'RELEASE_GRAY_FEATHER', 'BOOK_IN', 'BOOK_OUT', 'CANCEL', 'AWAIT_REVIVAL', 'RECOVER_IDENTITY', 'RECOVER_CASE', 'RECOVER_WITNESS', 'WORK', 'REST', 'NEXT_WEEK', 'ENTER_RECEPTION', 'LEAVE_RECEPTION', 'CONTINUE_FERRYMAN'].includes(String(v.type));
}
function originalPracticeBlock(s: SliceState): string | null {
  if (s.world.city !== 'BACKLUND') return '须本人实际在贝克兰德办理这所原创G档案会供养居所。';
  if (s.activeEvent || s.combat || s.eventQueue.length || s.pulse !== 'NONE') return '先处理当前战斗、事件与未结周账。';
  if (s.debts.some(d => d.remaining > 0) || ['ACCEPTED', 'CORRECT'].includes(s.aid) || s.arc.transferPending) return '先结清债务、在途援助与未交接事项。';
  if (hasFerrymanRitualLock(s)) return '先实际取消或收束当前摆渡人服药准备；旧准备不能跨越六十年。';
  if (hasUndyingRitualLock(s) || hasUndyingEncounterLock(s) || hasUndyingOldPractice(s)) return '先实际收束原仪式、遭遇、旧看门人实践及借物。';
  if (s.undying.life.playerLocation !== 'OUTSIDE' || Object.values(s.undying.life.cases).some(c => c.contactOpen || c.effectActive || c.status !== 'RESOLVED') || !s.undying.life.reflected) return '原三项记忆准备须完成、归还原物并实际退出。';
  if (!validateUndyingLife(s) || s.undying.life.book.entries.length !== 3 || s.undying.life.book.blankPages !== 0 || s.arc.stage !== 'ENDED') return '须有完整、真实来源未改的唯一原三页和已收束首案。';
  if (!s.spiritGuide.messenger.replyReceived) return '须已有原灰羽实际交付后的唯一原回信，不能新造旧物。';
  return null;
}
function fitForResidence(s: SliceState): string | null {
  return s.health < 80 || s.mind <= 0 || s.injuries.some(i => i.treatedRevision === null) || s.injuryRisk > 0
    ? '入驻须健康至少80、精神为正且无未治伤势或伤势风险；先走普通休养，不用周期抢救伤者。' : null;
}
function preparationPointAvailable(s: SliceState): boolean {
  return s.actionsRemaining > 0 || s.longChapter.deadlinePreparationRemaining > 0;
}
function spendPreparationPoint(s: SliceState): void {
  if (s.actionsRemaining > 0) s.actionsRemaining -= 1;
  else s.longChapter.deadlinePreparationRemaining -= 1;
}
function currentCustodian(s: SliceState): LongChapterCustodian | undefined { return s.longChapter.custodians.at(-1); }

export function blockLongChapterCommand(s: SliceState, c: LongChapterCommand): string | null {
  if (!validateLongChapterCommand(c)) return '长期章节命令无效。';
  if (hasLongChapterHandoff(s)) return '这段居所生活已完成交接，只能阅读原历史；当前行动请使用摆渡人章节。';
  if (c.type === 'CONTINUE_FERRYMAN') return blockLongChapterHandoff(s);
  if (s.status !== 'ACTIVE' || !firstCycle(s)) return '仅当前仍可继续的序列4不死者可进入首次周期；普通死亡存档不能恢复。';
  const l = s.longChapter;
  if (c.type === 'AWAIT_REVIVAL') return l.phase === 'CYCLE_DEAD' && s.health === 0 && l.body?.id === `${s.runId}:body` && l.body.location === 'LC-CARE-HOUSE' && s.undying.life.book.location === 'CARE_CHEST' ? null : '只有已真实登记的首周期死亡、同一原身体与守护保管才可等待七天。';
  if (l.phase === 'CYCLE_DEAD') return '原身体正在周期性死亡，普通行动均不可用；只能实际等待本作G七天复起。';
  if (s.health <= 0) return '普通致命伤不属于本流程，不死者不能借此复活。';
  if (c.type === 'REVIEW') {
    if (!['NONE', 'CANCELLED'].includes(l.phase) && !(l.phase === 'PREPARING' && !l.deadlinePreparationGranted && longChapterBlocksOrdinaryPulse(s))) return '当前清单已实际核对。';
    const block = originalPracticeBlock(s); if (block) return block;
    const due = s.undying.lifecycle.expectedCycleDate;
    return due === null || s.undying.lifecycle.experiencedCycles !== 0 || compareGameDates(s.date, due) > 0 ? '缺少尚未越过的真实首周期周年，不能倒拨日期。' : null;
  }
  if (c.type === 'CANCEL') return !preparing(s) ? '当前没有可取消的跳时前安排。' : s.undying.life.book.location === 'CARE_CHEST' ? '先BOOK_OUT亲手取回唯一原簿与原回信；取消不会传送原物。' : null;
  if (c.type === 'BOOK_OUT') return (preparing(s) || revived(s)) && s.undying.life.book.location === 'CARE_CHEST' && l.bookDeposits - l.bookWithdrawals === 1 ? null : '没有本人留在原保管箱、尚待取回的唯一原簿。';
  if (c.type === 'BOOK_IN') return !preparing(s) ? '只有跳时前筹备可以把原册放入保管箱。' : s.undying.life.book.location !== 'PLAYER' ? '同一本原簿必须确实在本人手中。' : originalPracticeBlock(s);
  if (c.type === 'RELEASE_GRAY_FEATHER') {
    if (l.phase !== 'PREPARING' || l.releasedSpiritDate !== null || s.gatekeeper.companion.status !== 'INSIDE') return '仅原灰羽仍实际短驻体内且尚未结束约定时可用。';
    const block = originalPracticeBlock(s); if (block) return block;
    return preparationPointAvailable(s) ? null : '须花1行动实际去原工作室释放同一灰羽并普通返回。';
  }
  if (c.type === 'PREPARE_SUPPORT' || c.type === 'DEADLINE_SUPPORT') {
    if (l.phase !== 'PREPARING' || l.paidDate !== null) return '只可在付费入驻之前实际准备供养，已付费用不能重新抵扣。';
    if (!preparationPointAvailable(s)) return '需要1行动；原册可先取回，让原普通周正常结算。';
    if (c.type === 'PREPARE_SUPPORT') return l.supportTasks.includes(c.taskId) ? '这项原档案劳动已经完成，不能重复抵扣。' : null;
    return !l.deadlinePreparationGranted || l.deadlineSupportCompleted || l.supportTasks.length !== 4 || s.cash >= 160 ? '仅临近首周年且四项已完成、仍不足160便士时，可一次实做额外档案核验抵最后160便士G；不发现金。' : null;
  }
  if (c.type === 'PAY_RESIDENCE') {
    if (l.phase !== 'PREPARING' || l.paidDate !== null) return '已付供养不重复收费；须先核对清单。';
    const block = originalPracticeBlock(s) ?? fitForResidence(s); if (block) return block;
    if (s.gatekeeper.companion.status !== 'OUTSIDE') return '先实际前往原工作室栖架结束同一原灰羽的短驻约定，不默认它同意留体内六十年。';
    if (s.undying.life.book.location !== 'CARE_CHEST') return '先把同一本原册与原回信亲手放入原保管箱。';
    return !preparationPointAvailable(s) ? '入驻需要1行动；可先取回原册继续筹备。' : s.cash < remainingCost(l) ? `尚需${remainingCost(l)}便士实际供养出资，可先完成四项不同原档案劳动。` : null;
  }
  if (c.type === 'LIVE_TO_CYCLE') {
    if (l.phase !== 'RESIDING' || l.paidDate === null || s.undying.life.book.location !== 'CARE_CHEST') return '须先实际付费入驻并把原册放在保管箱；本次是另一次不可逆时代确认。';
    const block = originalPracticeBlock(s) ?? fitForResidence(s); if (block) return block;
    if (s.gatekeeper.companion.status !== 'OUTSIDE') return '先实际前往原工作室栖架结束同一原灰羽的短驻约定，不默认它同意留体内六十年。';
    return s.undying.lifecycle.expectedCycleDate === null || compareGameDates(s.date, s.undying.lifecycle.expectedCycleDate) > 0 ? '不能倒拨至已过去的周年。' : null;
  }
  if (!revived(s)) return '先完成实际首周期死亡与七天复起。';
  if (c.type === 'ENTER_RECEPTION') return l.location === 'OUTSIDE' ? null : '本人已经在供养居所或新接待处。';
  if (c.type === 'LEAVE_RECEPTION') return l.phase !== 'PARTIAL_RECOVERY' ? '先通过原三页和真实保管记录完成有限的自我寻回。' : l.location !== 'RECEPTION' ? '须本人在新接待处，才能沿普通出口离开。' : s.undying.life.book.location !== 'PLAYER' ? '先亲手取回原册，不能把它瞬移出原箱。' : null;
  if (['RECOVER_IDENTITY', 'RECOVER_CASE', 'RECOVER_WITNESS'].includes(c.type)) {
    const index = ['RECOVER_IDENTITY', 'RECOVER_CASE', 'RECOVER_WITNESS'].indexOf(c.type);
    if (l.location === 'OUTSIDE' || s.undying.life.book.location !== 'PLAYER') return '须在新接待处，实际取回同一原册后逐页对照。';
    if (l.recoveredSources.length !== index) return '须依次实际寻回，每个原来源仅登记一次。';
    if (index === 1 && !l.objects.some(o => o.id === REPLY_ID && o.disposition === 'PRESERVED' && o.location === 'PLAYER')) return '第二页需要实际取回有来源的同一原回信。';
    if (index === 2 && !currentCustodian(s)) return '第三页需要当代守护人持有真实连续交接记录。';
    return s.actionsRemaining < 1 ? '本次实际寻回需要1行动。' : null;
  }
  if (l.phase !== 'PARTIAL_RECOVERY' || l.location !== 'RECEPTION') return '先完成三步有限寻回，并实际进入新档案接待处。';
  if (c.type === 'NEXT_WEEK') {
    if (s.actionsRemaining !== 0) return '须用完本周4点行动后再实际推进七天。';
    if (s.cash < 24) return '本周生活需24便士；可在这里实做一次受限基础劳动，不生成债务。';
    const second = addGameYears(s.undying.lifecycle.expectedCycleDate!, 60);
    return compareGameDates(addGameDays(s.date, 7), second) >= 0 ? '本版只开放首周期；第二次六十年周年前暂停，不伪造已实现的后续周期。' : null;
  }
  if (c.type === 'WORK') return s.actionsRemaining > 0 || s.cash < 24 && !l.newLife.emergencyWorkUsed ? null : '需要1行动；本周低于24便士时才有一次真实补劳动，不能无限取款。';
  if (c.type === 'REST') return s.actionsRemaining < 1 ? '休整需要1行动。' : s.cash < 8 ? '休整需要实付8便士，可先在新接待处工作。' : null;
  return '当前没有这项长期章节行动。';
}

function preservationObjects(s: SliceState): LongChapterObject[] {
  return [{ id: s.undying.life.book.id, sourceId: 'undying:original-three-page-book', label: '原记忆簿与原三页', disposition: 'PRESERVED', location: 'CARE_CHEST', quantity: 1 },
    { id: REPLY_ID, sourceId: REPLY_SOURCE, label: '原灰羽真实递信后的同一原回信', disposition: 'PRESERVED', location: 'CARE_CHEST', quantity: 1 }];
}
function oldObjects(s: SliceState): LongChapterObject[] {
  const result: LongChapterObject[] = [];
  for (const key of ['corpsecollector', 'gravedigger', 'spiritmedium', 'spiritGuide', 'gatekeeper', 'undying'] as const) {
    for (const bottle of s[key].bottles) if (bottle.status === 'PLAYER') result.push({ id: bottle.id, sourceId: `${key}:original-bottle`, label: '未保护的旧原成品瓶', disposition: 'EXPIRED', location: 'OLD_LOCATION', quantity: 1 });
  }
  for (const strip of s.undying.life.strips) if (strip.status === 'PLAYER') result.push({ id: strip.id, sourceId: 'undying:paid-original-strip', label: '未保护的旧原封条', disposition: 'EXPIRED', location: 'OLD_LOCATION', quantity: 1 });
  result.push({ id: 'UDY4-OWEN-CLUB', sourceId: 'undying:original-owen', label: `欧文原棍保留旧落点${s.undying.encounter.enemy.weaponLocation}`, disposition: 'HISTORICAL_ONLY', location: 'OLD_LOCATION', quantity: 1 });
  return result;
}
function eraRecords(start: PublicGameDate, throughDate: PublicGameDate): Pick<LongChapterState, 'custodians' | 'people'> {
  const eligible = (date: PublicGameDate) => compareGameDates(date, throughDate) <= 0;
  const l: Pick<LongChapterState, 'custodians' | 'people'> = { custodians: [], people: [] };
  const first = addGameYears(start, 25), second = addGameYears(start, 50);
  l.custodians = [{ id: 'LC-ADA-FENN', name: '艾达·芬恩', startedDate: { ...start }, ageAtStart: 34, endedDate: eligible(first) ? first : null }];
  if (eligible(first)) l.custodians.push({ id: 'LC-MILES-REED', name: '迈尔斯·里德', startedDate: first, ageAtStart: 31, endedDate: eligible(second) ? second : null });
  if (eligible(second)) l.custodians.push({ id: 'LC-LENA-VOSS', name: '莱娜·沃斯', startedDate: second, ageAtStart: 29, endedDate: null });
  l.people = [{ id: 'UDY4-JORY', date: { ...start }, kind: 'UNKNOWN', text: '乔里原67岁不死者的旧监督约定已结束；此后去向未知，不按普通寿命判死，不提供新预约。' },
    { id: 'SG6-GRAY-FEATHER', date: { ...start }, kind: 'AGREEMENT_ENDED', text: '原灰羽已实际在旧工作室原栖架，旧递信与短驻约定不再延长；原次数、原信和旧历史保留，其后去向与当前联系未知，不留体内无限续约或生成第二灵体。' }];
  if (eligible(first)) l.people.push({ id: 'LC-ADA-FENN', date: first, kind: 'RETIRED', text: '艾达在登记25周年、59岁时退休，把同一身体与原箱交给新的迈尔斯·里德。' });
  if (eligible(second)) l.people.push({ id: 'LC-MILES-REED', date: second, kind: 'RETIRED', text: '迈尔斯在自己任期25周年、56岁时交棒给新的莱娜·沃斯；不是伊芙琳本人，也没有血缘保证。' });
  const death = addGameYears(start, 39);
  if (eligible(death)) l.people.push({ id: 'EVELYN-VOSS', date: death, kind: 'DEATH', text: '伊芙琳·沃斯当年登记44岁，在离开旧生活后39年、83岁时故去（G）；当年的同意与核对留下原始记录，本人不再接单。' });
  l.people.sort((a, b) => compareGameDates(a.date, b.date) || a.id.localeCompare(b.id));
  return l;
}
function moveClock(s: SliceState, date: PublicGameDate): void {
  const days = gameDaysBetween(START_DATE, date);
  s.date = { ...date }; s.week = Math.floor(days / 7) + 1;
  s.longChapter.calendarRemainderDays = days % 7;
  s.longChapter.elapsedDays = gameDaysBetween(s.longChapter.departureDate!, date);
  Object.assign(s.longChapter, eraRecords(s.longChapter.departureDate!, date));
}
export function applyLongChapterCommand(s: SliceState, c: LongChapterCommand, ctx: SeerContext): void {
  const reason = blockLongChapterCommand(s, c); if (reason) throw new Error(reason);
  const l = s.longChapter;
  if (c.type === 'CONTINUE_FERRYMAN') { handoffLongChapterToFerryman(s, ctx); return; }
  if (c.type === 'REVIEW') {
    l.reviewedDate = { ...s.date }; l.phase = l.paidDate === null ? 'PREPARING' : 'RESIDING';
    l.location = l.paidDate === null ? 'OUTSIDE' : 'CARE_ROOM';
    if (!l.deadlinePreparationGranted && longChapterBlocksOrdinaryPulse(s)) { l.deadlinePreparationGranted = true; l.deadlinePreparationRemaining = 7; }
    ctx.note('核对真实首周期清单', `原周年为${dateText(s.undying.lifecycle.expectedCycleDate!)}；供养出资960便士G，四项不同1行动劳动各抵200，余160。入驻付款与不可逆度过年代另行确认。原工作及旧约定将结束，旧人会交棒或故去，只有原簿和已有原回信保留；旧药与封条过期。${l.deadlinePreparationGranted ? '临近周年已有一次专用7点筹备额度，不回填普通行动、不允许领旧工资；四项后仍不足160可实做一次额外核验抵最后160。' : ''}${l.paidDate !== null ? '原已付出资仍有效，本次不再收费。' : ''}`); return;
  }
  if (c.type === 'RELEASE_GRAY_FEATHER') { spendPreparationPoint(s); s.gatekeeper.companion.status = 'OUTSIDE'; s.gatekeeper.companion.releases += 1; l.releasedSpiritDate = { ...s.date }; ctx.note('亲赴原工作室结束同一原灰羽短驻', '实际花1行动，本人沿普通道路去原工作室，把同一SG6-GRAY-FEATHER从体内释放到原栖架并普通返回；这次G往返未虚造精确距离。实际释放次数+1，旧入驻、实付、递信和原回信保持，未延长同意或生成新灵体。'); return; }
  if (c.type === 'PREPARE_SUPPORT') { spendPreparationPoint(s); l.supportTasks.push(c.taskId); ctx.note(SUPPORT_LABELS[c.taskId], `实际花1行动完成本项，抵扣本次长期供养200便士；已完成${l.supportTasks.length}/4，尚需${remainingCost(l)}便士。没有发现金、药物或非凡成长。`); return; }
  if (c.type === 'DEADLINE_SUPPORT') { spendPreparationPoint(s); l.deadlineSupportCompleted = true; ctx.note('临近周年的额外档案核验', '实际花1点筹备行动完成第五项不同核验，档案会追加160便士G补助抵最后个人出资；不发现金、不重复提供，也不生成债务。'); return; }
  if (c.type === 'BOOK_IN') {
    s.undying.life.book.location = 'CARE_CHEST'; l.bookDeposits += 1; l.retainedObjectId = REPLY_ID;
    l.objects = preservationObjects(s); ctx.note('亲手把同一本原册放入原箱', 'UDY4-BOOK-1及原三页实际放入LC-CARE-CHEST-1；原灰羽已真实递信后交到手中的同一回信登记为SG6-REPLY-1，一同保管，没有生成或抄造另一件旧物。'); return;
  }
  if (c.type === 'BOOK_OUT') {
    s.undying.life.book.location = 'PLAYER'; l.bookWithdrawals += 1;
    for (const object of l.objects) if (object.disposition === 'PRESERVED') object.location = 'PLAYER';
    if (revived(s)) { l.location = 'RECEPTION'; l.body!.location = 'LC-RECEPTION'; }
    ctx.note('实际取回唯一原册与原回信', '本人在同一保管箱前亲手取回UDY4-BOOK-1和SG6-REPLY-1，原三页原文、来源及旧桌放取次数均不变；读到外部档案还不等于自己已经记起。'); return;
  }
  if (c.type === 'CANCEL') { l.phase = 'CANCELLED'; l.location = 'OUTSIDE'; l.cancellations += 1; ctx.note('沿普通出口返回原来的时代', `没有推进任何日期；原册已亲手取回。已实际支出${l.paidPennies}便士不凭空退款，劳动和期限专用额度不重置；再次核对可沿用已付供养。`); return; }
  if (c.type === 'PAY_RESIDENCE') {
    spendPreparationPoint(s); l.paidPennies = remainingCost(l); s.cash -= l.paidPennies; l.paidDate = { ...s.date }; l.phase = 'RESIDING'; l.location = 'CARE_ROOM';
    ctx.note('实际支付原创G长期供养出资', `实付${l.paidPennies}便士并花1行动，进入LC-CARE-HOUSE；960便士为档案会补助后的个人出资，不是真实六十年市场报价。日期尚未跳转。再次明确确认LIVE_TO_CYCLE才不可逆关闭旧时代；现在仍能取册后取消，已支出不退款。`); return;
  }
  if (c.type === 'LIVE_TO_CYCLE') {
    l.departureDate = { ...s.date }; l.departureWeek = s.week;
    l.body = { id: `${s.runId}:body`, location: 'LC-CARE-HOUSE', entryHealth: s.health, entryMind: s.mind, entrySpirituality: s.spirituality, entryInjuries: structuredClone(s.injuries), entryInjuryRisk: s.injuryRisk, entryCash: s.cash };
    l.objects = [...preservationObjects(s), ...oldObjects(s)]; l.phase = 'CYCLE_DEAD'; l.cycleDeathDate = { ...s.undying.lifecycle.expectedCycleDate! };
    closeFerrymanOriginalEra(s, l.departureDate, l.cycleDeathDate);
    moveClock(s, l.cycleDeathDate); s.health = 0; s.actionsRemaining = 0;
    s.undying.lifecycle.status = 'CYCLE_DEAD';
    ctx.note('真实到达首六十年周年，原身体周期性死亡', `从${dateText(l.departureDate)}实际经过${l.elapsedDays}天，到保存的晋升六十周年${dateText(s.date)}，第${s.week}周另余${l.calendarRemainderDays}天。${l.body.id}仍在LC-CARE-HOUSE，健康0；原伤势记录和灵性${l.body.entrySpirituality}未清除或补满。剩余现金${l.body.entryCash}便士已由原供养机构实登记托管，同额零利息保存，不继承未知资产。旧职业、旧约定与旧场景已结束；不累计工资、首案奖励、供货或消化。独立周期死可以保存，普通死亡规则不变。`); return;
  }
  if (c.type === 'AWAIT_REVIVAL') {
    l.revivedDate = addGameDays(l.cycleDeathDate!, 7); moveClock(s, l.revivedDate); l.phase = 'AMNESIAC'; l.location = 'CARE_ROOM';
    s.health = 50; s.mind = 60; s.spirituality = Math.min(120, l.body!.entrySpirituality); s.actionsRemaining = 4; s.weeklyBudget = 4;
    s.undying.lifecycle.experiencedCycles = 1; s.undying.lifecycle.status = 'AMNESIAC'; l.newLife.week = s.week;
    ctx.note('七天后同一身体实际复起，当前部分失忆', `${dateText(s.date)}，${l.body!.id}仍是原身体。G健康50、精神60；灵性${s.spirituality}不超过入驻原值，没有新身体或原伤治愈。供养机构同额交还托管现金${l.body!.entryCash}便士，零利息。原始文书仍可阅读，但本人尚未寻回任何来源；先亲手取回原册，再用三次真实行动逐步核对。${RESIDENCE_RECORD_BOUNDARY}`); return;
  }
  if (c.type === 'RECOVER_IDENTITY' || c.type === 'RECOVER_CASE' || c.type === 'RECOVER_WITNESS') {
    const index = ['RECOVER_IDENTITY', 'RECOVER_CASE', 'RECOVER_WITNESS'].indexOf(c.type), entry = s.undying.life.book.entries[index]!;
    s.actionsRemaining -= 1; l.recoveredSources.push({ entryId: entry.id, sourceId: entry.sourceId, objectId: index === 1 ? REPLY_ID : index === 2 ? 'LC-HANDOVER-1' : l.bookId, date: { ...s.date } });
    if (index === 2) { l.phase = 'PARTIAL_RECOVERY'; l.mentallyStable = true; s.undying.lifecycle.status = 'PARTIAL_RECOVERY'; }
    ctx.note(['从原身份页寻回名字与来处', '从首案页与同一原回信寻回片段', '与当代守护人核对灰羽旧页'][index]!, `实际花1行动对照${entry.id}及${l.recoveredSources[index]!.objectId}。${entry.text}${index === 2 ? ` ${currentCustodian(s)!.name}持有LC-HANDOVER-1连续交接记录，不是原伊芙琳复生。现在有限核心身份与精神稳定已恢复，仍有大量人生记忆未寻回。` : ''} 不发扮演、掌握或完整人生记忆。`); return;
  }
  if (c.type === 'ENTER_RECEPTION') { l.location = 'RECEPTION'; l.body!.location = 'LC-RECEPTION'; ctx.note('沿普通道路进入当代接待处', '本人及已经取回的原册、原回信来到LC-RECEPTION；只开放本作G当代档案劳动与休整，旧雇主不在此接单。'); return; }
  if (c.type === 'LEAVE_RECEPTION') { l.location = 'OUTSIDE'; l.body!.location = 'LC-OUTSIDE'; ctx.note('本人沿新接待处的普通出口离开', '身体和实际持有的同一原册、原回信来到门外；可以再次普通走入。本版后世只开放此接待处，不把六十年前的旧人旧案重新排进当代。'); return; }
  if (c.type === 'WORK') {
    const emergency = s.actionsRemaining === 0;
    if (emergency) { l.newLife.emergencyWorkUsed = true; l.newLife.emergencyWorks += 1; } else s.actionsRemaining -= 1;
    s.cash += 24; l.newLife.works += 1; l.newLife.income += 24;
    ctx.note('在新档案接待处实际劳动', `完成1行动的普通整理工作，实际获得24便士。${emergency ? '本周现金不足生活费，实做一次额外补劳动；本周不能再领此机会，不生成债务。' : ''}旧职业工资、能力掌握与消化不增加。`); return;
  }
  if (c.type === 'REST') { s.actionsRemaining -= 1; s.cash -= 8; l.newLife.rests += 1; l.newLife.expenses += 8; s.health = Math.min(100, s.health + 5); s.mind = Math.min(100, s.mind + 8); s.spirituality = Math.min(120, s.spirituality + 10); ctx.note('在新接待处实际休整', '花1行动及8便士，健康+5、精神+8、灵性+10（上限100/100/120）；这是复起后的普通休整，不是周期死或普通致命伤治疗。'); return; }
  if (c.type === 'NEXT_WEEK') {
    s.cash -= 24; l.newLife.expenses += 24; l.newLife.weeks += 1; l.newLife.emergencyWorkUsed = false;
    moveClock(s, addGameDays(s.date, 7)); l.newLife.week = s.week; s.actionsRemaining = 4; s.weeklyBudget = 4;
    ctx.note('新年代实际过去七天', `${dateText(s.date)}，实付本周基本生活24便士，下一周固定4行动；没有旧工资、旧债重跑、旧人物复位或批量补药。`); return;
  }
}

/** One-way public handoff. It changes neither the current resources nor the original residence. */
export function blockLongChapterHandoff(s: SliceState): string | null {
  const l = s.longChapter;
  if (hasLongChapterHandoff(s)) return '居所已经完成交接，不能重复领取行动或新生活资源。';
  if (s.status !== 'ACTIVE' || s.health <= 0 || !firstCycle(s)) return '只有仍在世的序列4不死者可以交接；普通死亡不能继续。';
  if (l.phase !== 'PARTIAL_RECOVERY' || !l.mentallyStable || l.recoveredSources.length !== 3) return '须先实际经历首次周期，并逐一完成三个原来源的有限寻回。';
  if (l.location !== 'OUTSIDE' || l.body?.location !== 'LC-OUTSIDE') return '先带着原册与原回信，沿接待处普通出口实际离开。';
  if (s.activeEvent || s.combat || s.eventQueue.length || s.pulse !== 'NONE' || hasFerrymanRitualLock(s) || hasUndyingRitualLock(s) || hasUndyingEncounterLock(s)) return '先收束当前事件、战斗、周账和服药准备。';
  if (s.undying.life.book.id !== l.bookId || s.undying.life.book.location !== 'PLAYER' || !s.spiritGuide.messenger.replyReceived || !l.objects.some(o => o.id === REPLY_ID && o.sourceId === REPLY_SOURCE && o.disposition === 'PRESERVED' && o.location === 'PLAYER')) return '必须亲手持有同一本原三页记忆簿及已经取回的同一原回信。';
  if (!validateLongChapterState(s) || !validateUndyingLife(s)) return '居所原记录、恢复来源或实际离开结余未通过完整核对，不能交接。';
  return null;
}
export function handoffLongChapterToFerryman(s: SliceState, ctx: SeerContext): void {
  const reason = blockLongChapterHandoff(s); if (reason) throw new Error(reason);
  s.longChapter.handoff = { target: 'FERRYMAN', date: { ...s.date }, week: s.week, cash: s.cash, health: s.health, mind: s.mind, spirituality: s.spirituality, actionsRemaining: s.actionsRemaining };
  initializeFerrymanEra(s);
  ctx.note('完成居所交接，继续当代摆渡人章节', `在${dateText(s.date)}第${s.week}周，保留本人实际离开结余：现金${s.cash}便士、健康${s.health}/精神${s.mind}/灵性${s.spirituality}、行动${s.actionsRemaining}。同一原簿、原回信、三次寻回与居所账目封存为可读历史；没有移动、补行动、发物或恢复资源。旧时代仍关闭，新供应人须另行实际介绍和到场。`);
}

export function validateLongChapterState(s: SliceState): boolean {
  try { return validateState(s); } catch { return false; }
}
function validateState(s: SliceState): boolean {
  const raw: unknown = s.longChapter, base = createLongChapterState();
  if (!record(raw) || !shape(raw, Object.keys(base))) return false;
  const l = raw as unknown as LongChapterState;
  if (!['NONE', 'PREPARING', 'RESIDING', 'CANCELLED', 'CYCLE_DEAD', 'AMNESIAC', 'PARTIAL_RECOVERY'].includes(l.phase) || l.facilityId !== base.facilityId || l.chestId !== base.chestId || l.bookId !== base.bookId || !['OUTSIDE', 'CARE_ROOM', 'RECEPTION'].includes(l.location)) return false;
  if (l.phase === 'NONE') return same(l, base);
  const h = l.handoff;
  if (h !== null && (!record(h) || !shape(h, ['target', 'date', 'week', 'cash', 'health', 'mind', 'spirituality', 'actionsRemaining']) || h.target !== 'FERRYMAN' || !isValidGameDate(h.date) || compareGameDates(h.date, s.date) > 0 || !integer(h.week, 1, s.week) || !integer(h.cash) || !integer(h.health, 1, 100) || !integer(h.mind, 1, 100) || !integer(h.spirituality, 0, 120) || !integer(h.actionsRemaining, 0, 4))) return false;
  if (h !== null && (l.phase !== 'PARTIAL_RECOVERY' || !l.mentallyStable || l.location !== 'OUTSIDE' || l.body?.location !== 'LC-OUTSIDE' || s.progression.pathwayId !== 'death' || ![4, 3, 2].includes(s.progression.sequence!))) return false;
  // A completed residence is checked against its compact terminal balance, never today's body or purse.
  const balance = h ?? s, throughDate = balance.date;
  const cancelledHistory = l.phase === 'CANCELLED' && s.progression.pathwayId === 'death' && [4, 3, 2].includes(s.progression.sequence!);
  if (h === null && !cancelledHistory && (!firstCycle(s) || s.status !== 'ACTIVE') || !isValidGameDate(l.reviewedDate) || compareGameDates(l.reviewedDate, throughDate) > 0) return false;
  if (!Array.isArray(l.supportTasks) || l.supportTasks.length > 4 || new Set(l.supportTasks).size !== l.supportTasks.length || l.supportTasks.some(id => !LONG_CHAPTER_SUPPORT_IDS.includes(id))) return false;
  if (!integer(l.paidPennies, 0, COST) || !integer(l.cancellations) || !integer(l.bookDeposits) || !integer(l.bookWithdrawals) || !integer(l.elapsedDays) || !integer(l.calendarRemainderDays, 0, 6)) return false;
  if (typeof l.deadlinePreparationGranted !== 'boolean' || !integer(l.deadlinePreparationRemaining, 0, 7) || typeof l.deadlineSupportCompleted !== 'boolean' || typeof l.mentallyStable !== 'boolean') return false;
  if (!l.deadlinePreparationGranted && (l.deadlinePreparationRemaining !== 0 || l.deadlineSupportCompleted) || l.deadlineSupportCompleted && l.supportTasks.length !== 4) return false;
  if (l.paidDate === null ? l.paidPennies !== 0 || l.phase === 'RESIDING' : !isValidGameDate(l.paidDate) || compareGameDates(l.paidDate, throughDate) > 0 || l.paidPennies !== remainingCost(l)) return false;
  if (l.phase === 'PREPARING' && l.paidDate !== null || l.phase === 'CANCELLED' && (l.cancellations < 1 || l.location !== 'OUTSIDE')) return false;
  if (l.releasedSpiritDate !== null && (!isValidGameDate(l.releasedSpiritDate) || compareGameDates(l.releasedSpiritDate, throughDate) > 0 || s.gatekeeper.companion.status !== 'OUTSIDE')) return false;
  const book = s.undying.life.book;
  if (!['PLAYER', 'CARE_CHEST'].includes(book.location) || l.bookDeposits - l.bookWithdrawals !== (book.location === 'CARE_CHEST' ? 1 : 0)) return false;
  if (l.bookDeposits === 0 ? l.retainedObjectId !== null : l.retainedObjectId !== REPLY_ID || !s.spiritGuide.messenger.replyReceived) return false;
  if (!Array.isArray(l.objects) || !Array.isArray(l.custodians) || !Array.isArray(l.people) || !Array.isArray(l.recoveredSources)) return false;
  if (!record(l.newLife) || !shape(l.newLife, Object.keys(base.newLife)) || !['works', 'rests', 'weeks', 'income', 'expenses', 'emergencyWorks'].every(k => integer(l.newLife[k as 'works'])) || typeof l.newLife.emergencyWorkUsed !== 'boolean') return false;
  const preserved = l.bookDeposits > 0 ? preservationObjects(s).map(o => ({ ...o, location: book.location === 'PLAYER' ? 'PLAYER' : 'CARE_CHEST' })) : [];
  if (!isLongChapterEraClosed(s)) {
    if (h !== null || l.cycleDeathDate !== null || l.departureDate !== null || l.departureWeek !== null || l.revivedDate !== null || l.body !== null || l.elapsedDays !== 0 || l.calendarRemainderDays !== 0 || l.custodians.length || l.people.length || l.recoveredSources.length || l.mentallyStable || !same(l.newLife, base.newLife)) return false;
    if (!same(l.objects, preserved) || !['PREPARING', 'RESIDING', 'CANCELLED'].includes(l.phase)) return false;
    if (cancelledHistory && book.location !== 'PLAYER') return false;
    return (cancelledHistory || s.health > 0) && (l.phase === 'RESIDING' ? l.location === 'CARE_ROOM' : l.location === 'OUTSIDE') && s.undying.lifecycle.experiencedCycles === 0 && s.undying.lifecycle.status === 'REGISTERED_NOT_EXPERIENCED';
  }
  if (!['CYCLE_DEAD', 'AMNESIAC', 'PARTIAL_RECOVERY'].includes(l.phase) || l.paidDate === null || !isValidGameDate(l.departureDate) || !integer(l.departureWeek, 1, balance.week) || !isValidGameDate(l.cycleDeathDate) || !same(l.cycleDeathDate, s.undying.lifecycle.expectedCycleDate)) return false;
  if (compareGameDates(l.paidDate, l.departureDate) > 0 || compareGameDates(l.departureDate, l.cycleDeathDate) > 0 || !same(l.objects, [...preserved, ...oldObjects(s)])) return false;
  if (l.departureWeek !== Math.floor(gameDaysBetween(START_DATE, l.departureDate) / 7) + 1) return false;
  const absoluteDays = gameDaysBetween(START_DATE, throughDate);
  if (balance.week !== Math.floor(absoluteDays / 7) + 1 || l.calendarRemainderDays !== absoluteDays % 7 || l.elapsedDays !== gameDaysBetween(l.departureDate, throughDate)) return false;
  const body = l.body;
  if (!record(body) || !shape(body, ['id', 'location', 'entryHealth', 'entryMind', 'entrySpirituality', 'entryInjuries', 'entryInjuryRisk', 'entryCash']) || body.id !== `${s.runId}:body` || !['LC-CARE-HOUSE', 'LC-RECEPTION', 'LC-OUTSIDE'].includes(body.location) || !integer(body.entryHealth, 80, 100) || !integer(body.entryMind, 1, 100) || !integer(body.entrySpirituality, 0, 120) || !integer(body.entryCash) || body.entryInjuryRisk !== 0) return false;
  if (!Array.isArray(body.entryInjuries) || body.entryInjuries.some(i => !record(i) || !shape(i, ['id', 'severity', 'acquiredRevision', 'treatedRevision']) || typeof i.id !== 'string' || !['LIGHT', 'HEAVY'].includes(i.severity) || !integer(i.acquiredRevision) || !integer(i.treatedRevision))) return false;
  if (h === null && (!same(body.entryInjuries, s.injuries) || s.injuryRisk !== body.entryInjuryRisk)) return false;
  const records = eraRecords(l.departureDate, throughDate);
  if (!same(l.custodians, records.custodians) || !same(l.people, records.people)) return false;
  if (h === null && (s.activeEvent || s.combat || s.eventQueue.length || s.pulse !== 'NONE') || s.gatekeeper.companion.status !== 'OUTSIDE') return false;
  if (l.phase === 'CYCLE_DEAD') return l.location === 'CARE_ROOM' && body.location === 'LC-CARE-HOUSE' && book.location === 'CARE_CHEST' && same(s.date, l.cycleDeathDate) && l.revivedDate === null && s.health === 0 && s.mind === body.entryMind && s.spirituality === body.entrySpirituality && s.cash === body.entryCash && s.actionsRemaining === 0 && l.recoveredSources.length === 0 && !l.mentallyStable && same(l.newLife, base.newLife) && s.undying.lifecycle.status === 'CYCLE_DEAD' && s.undying.lifecycle.experiencedCycles === 0;
  if (!isValidGameDate(l.revivedDate) || !same(l.revivedDate, addGameDays(l.cycleDeathDate, 7)) || !same(throughDate, addGameDays(l.revivedDate, l.newLife.weeks * 7)) || l.newLife.week !== balance.week || h === null && s.weeklyBudget !== 4) return false;
  if (s.undying.lifecycle.experiencedCycles !== 1 || s.undying.lifecycle.status !== l.phase || l.mentallyStable !== (l.phase === 'PARTIAL_RECOVERY') || l.recoveredSources.length > 3 || (l.recoveredSources.length === 3) !== l.mentallyStable) return false;
  if (body.location !== (l.location === 'CARE_ROOM' ? 'LC-CARE-HOUSE' : l.location === 'RECEPTION' ? 'LC-RECEPTION' : 'LC-OUTSIDE') || l.location === 'OUTSIDE' && (!l.mentallyStable || book.location !== 'PLAYER')) return false;
  if (l.recoveredSources.length > 0 && book.location !== 'PLAYER') return false;
  for (const [index, recovery] of l.recoveredSources.entries()) {
    const entry = book.entries[index];
    if (!record(recovery) || !shape(recovery, ['entryId', 'sourceId', 'objectId', 'date']) || !entry || recovery.entryId !== entry.id || recovery.sourceId !== entry.sourceId || recovery.objectId !== (index === 1 ? REPLY_ID : index === 2 ? 'LC-HANDOVER-1' : l.bookId) || !isValidGameDate(recovery.date) || compareGameDates(recovery.date, l.revivedDate) < 0 || compareGameDates(recovery.date, throughDate) > 0 || index > 0 && compareGameDates(recovery.date, l.recoveredSources[index - 1]!.date) < 0) return false;
  }
  if (l.newLife.income !== l.newLife.works * 24 || l.newLife.expenses !== l.newLife.rests * 8 + l.newLife.weeks * 24 || balance.cash !== body.entryCash + l.newLife.income - l.newLife.expenses) return false;
  if (l.newLife.emergencyWorks > l.newLife.weeks + 1 || l.newLife.emergencyWorks > l.newLife.works || l.newLife.emergencyWorkUsed && l.newLife.emergencyWorks === 0) return false;
  if (balance.actionsRemaining !== 4 * (l.newLife.weeks + 1) - l.recoveredSources.length - l.newLife.works - l.newLife.rests + l.newLife.emergencyWorks || !integer(balance.actionsRemaining, 0, 4)) return false;
  if (l.phase === 'AMNESIAC' && (l.newLife.works || l.newLife.rests || l.newLife.weeks)) return false;
  return balance.health === Math.min(100, 50 + l.newLife.rests * 5) && balance.mind === Math.min(100, 60 + l.newLife.rests * 8) && balance.spirituality === Math.min(120, body.entrySpirituality + l.newLife.rests * 10);
}

export function projectLongChapter(s: SliceState): LongChapterProjection {
  const l = s.longChapter, handedOff = hasLongChapterHandoff(s), historicalDate = l.handoff?.date ?? s.date, available = firstCycle(s) || handedOff, closed = isLongChapterEraClosed(s), guardian = currentCustodian(s);
  const actions: LongChapterProjection['actions'] = [];
  const add = (command: LongChapterCommand, label: string, cost: string) => {
    const reason = blockLongChapterCommand(s, command);
    actions.push({ id: `long-chapter-${command.type}${command.type === 'PREPARE_SUPPORT' ? `-${command.taskId}` : ''}`, label, cost, enabled: reason === null, reason, command });
  };
  if (available && s.status === 'ACTIVE' && !handedOff) {
    if (l.phase === 'NONE' || l.phase === 'CANCELLED') add({ type: 'REVIEW' }, l.paidDate ? '重新核对并沿用已付供养安排' : '核对首次六十年周期与时代后果', '0行动 · 尚不付款或跳时');
    if (preparing(s)) {
      if (l.phase === 'PREPARING' && !l.deadlinePreparationGranted && longChapterBlocksOrdinaryPulse(s)) add({ type: 'REVIEW' }, '临近首周年，重新核对一次专用筹备额度', '0行动 · 一次7点，只能办理当前供养事项');
      if (l.phase === 'PREPARING') {
        if (s.gatekeeper.companion.status === 'INSIDE') add({ type: 'RELEASE_GRAY_FEATHER' }, '亲赴原栖架结束同一灰羽短驻，再普通返回', '1行动 · 同一原灵实际释放 · 不延长同意');
        for (const taskId of LONG_CHAPTER_SUPPORT_IDS) add({ type: 'PREPARE_SUPPORT', taskId }, SUPPORT_LABELS[taskId], '1行动 · 本次供养抵200便士');
        if (l.deadlinePreparationGranted) add({ type: 'DEADLINE_SUPPORT' }, '实做期限额外核验，抵最后160便士', '1筹备行动 · 四项后仍不足160时仅一次G补助');
      }
      add({ type: 'BOOK_IN' }, '亲手放入原记忆簿与同一原回信', '0行动 · 唯一原箱，不生成副本');
      if (s.undying.life.book.location === 'CARE_CHEST') add({ type: 'BOOK_OUT' }, '亲手取回原册与原回信', '0行动 · 可取回后继续原周筹备');
      if (l.phase === 'PREPARING') add({ type: 'PAY_RESIDENCE', confirmed: true }, '确认支付并入驻供养居所', `1行动 · ${remainingCost(l)}便士 · 付款后取消不退已出资`);
      else add({ type: 'LIVE_TO_CYCLE', confirmed: true }, '确认度过真实年代至首周期死亡', `0行动 · 不可逆到${s.undying.lifecycle.expectedCycleDate ? dateText(s.undying.lifecycle.expectedCycleDate) : '未知周年'}`);
      add({ type: 'CANCEL' }, '取回原物后取消，返回旧生活', '0行动 · 不跳日期 · 已付款不退款');
    }
    if (l.phase === 'CYCLE_DEAD') add({ type: 'AWAIT_REVIVAL' }, '守护同一原身体，实际等待七天复起', '真实7天 · G健康50/精神60 · 灵性不补满');
    if (revived(s)) {
      if (s.undying.life.book.location === 'CARE_CHEST') add({ type: 'BOOK_OUT' }, '从原保管箱亲手取回原册与原回信', '0行动 · 外部记录不等于已想起');
      if (l.phase === 'AMNESIAC') {
        add({ type: 'RECOVER_IDENTITY' }, '对照同一原身份页，寻回名字与来处', '1行动 · 第一来源');
        add({ type: 'RECOVER_CASE' }, '对照同一首案页与实际取回的原回信', '1行动 · 第二来源');
        add({ type: 'RECOVER_WITNESS' }, '与新守护人核对原灰羽页和连续交接', '1行动 · 第三来源 · 有限精神稳定');
      } else {
        if (l.location === 'OUTSIDE') {
          add({ type: 'CONTINUE_FERRYMAN' }, '完成居所交接，继续当代摆渡人章节', '0行动 · 留存实际结余 · 不补资源或移动');
          add({ type: 'ENTER_RECEPTION' }, '沿普通道路进入新档案接待处', '0行动 · 同一身体与已取回原物');
        }
        else {
          add({ type: 'WORK' }, '在当代接待处实做普通档案劳动', s.actionsRemaining === 0 ? '本周仅一次实做补劳动 · 低于24便士时 · +24便士' : '1行动 · +24便士');
          add({ type: 'REST' }, '在当代接待处实际休整', '1行动 · 8便士 · 健康+5/精神+8/灵性+10');
          add({ type: 'NEXT_WEEK' }, '实际支付生活费，再过去七天', '0行动时 · 24便士 · 下周4行动');
          add({ type: 'LEAVE_RECEPTION' }, '带着原册沿普通出口离开', '0行动 · 可普通返回');
        }
      }
    }
  }
  const entry = s.undying.lifecycle.promotionDate, due = s.undying.lifecycle.expectedCycleDate;
  const dates = [entry ? `原实际晋升：${dateText(entry)}` : '尚无不死者晋升日期', due ? `原首六十年周年：${dateText(due)}` : '尚无首周年', `实际当前：${dateText(s.date)} · 第${s.week}周`];
  if (l.departureDate) dates.push(`离开旧生活：${dateText(l.departureDate)} · 实际经过${l.elapsedDays}天 · 日历余${l.calendarRemainderDays}天`);
  if (l.cycleDeathDate) dates.push(`原身体周期死：${dateText(l.cycleDeathDate)}`);
  if (l.revivedDate) dates.push(`同一身体七天后复起：${dateText(l.revivedDate)}`);
  if (l.handoff) dates.push(`完成居所交接：${dateText(l.handoff.date)} · 第${l.handoff.week}周 · 其后居所日期及账目不再推进`);
  const consequences = [
    `个人长期供养出资960便士G；四项不同实际劳动各1行动抵200，剩160。现在尚需${l.paidDate === null ? remainingCost(l) : 0}，已实付${l.paidPennies}；取消不退款。`,
    `另一次明确确认才推进至原晋升六十周年${due ? dateText(due) : ''}；不重新从今天算60年，不补发数千周旧工资、药品、奖励或消化。`,
    '出发时艾达·芬恩34岁；25年后59岁退休交给31岁迈尔斯，50年节点再交给29岁莱娜。只落实实际经过的节点，新ID不冒充原人。',
    '原伊芙琳当年44岁，出发39年后83岁故去（G）；乔里是原67岁超凡者，旧约定结束后去向未知，不能按普通寿命断言死亡。莱娜不是伊芙琳本人，也无血缘保证。',
    '保管只有同一原三页记忆簿与已收到的同一原回信；未保护的旧药瓶和封条实际登记过期且不能使用，其他旧原物只留历史地点，欧文原生死与原棍不变。',
    '周年时健康0、同一身体停留供养居所；只有这次已安排的周期死可继续七天G等待。复起健康50、精神60、灵性不超过入驻值；先逐一实际寻回三个来源，大量人生记忆仍缺失。',
    '现有现金由同一供养机构实际登记托管，回归时同额交还，零利息，不继承或生成未知资产。',
    '旧职业、旧人委托与旧城现场全部成为历史；居所交接后使用摆渡人当前渠道的独立生活，不保证旧城格局与关系原样延续。',
  ];
  const people = l.custodians.map(p => `${p.id} ${p.name}：${dateText(p.startedDate)}以${p.ageAtStart}岁接任，${p.endedDate ? `${dateText(p.endedDate)}交棒（${p.ageAtStart + completedGameYears(p.startedDate, p.endedDate)}岁）` : `截至${dateText(historicalDate)}登记${p.ageAtStart + completedGameYears(p.startedDate, historicalDate)}岁，当时在任`}。`);
  people.push(...l.people.map(p => `${dateText(p.date)} · ${p.id} · ${p.text}`));
  if (!closed) people.push('未来供养首任：LC-ADA-FENN 艾达·芬恩34岁；后继者LC-MILES-REED与LC-LENA-VOSS使用全新身份，不复活旧NPC。');
  const memory = s.undying.life.book.entries.map(e => `${l.recoveredSources.some(r => r.entryId === e.id) ? '本人已有限寻回' : closed ? '外部原记录，尚不等于本人想起' : '原页已保存，周期尚未发生'} · ${e.id} / ${e.sourceId}：${e.text}`);
  if (l.mentallyStable) memory.push('仅恢复名字、来处、首案片段与灰羽旧联系的有限核心事实，精神稳定；未寻回其余人生记忆，不增加扮演或掌握。');
  const currentIdentity = l.phase === 'CYCLE_DEAD' ? '同一原身体正在周期死，不能执行普通行动。' : l.phase === 'AMNESIAC' && l.recoveredSources.length === 0 ? '本人尚未记起名字；原档案仍保留创建身份。' : `${s.character.name} · 创建年龄${s.character.age}岁；距开局实际${completedGameYears(START_DATE, historicalDate)}整年，${handedOff ? '居所交接时' : '当前'}历龄登记${s.character.age + completedGameYears(START_DATE, historicalDate)}岁。生理年龄未凭复起重设。`;
  return { available, started: l.phase !== 'NONE', eraClosed: closed, locked: hasLongChapterLock(s), phase: l.phase, title: handedOff ? '已完成居所 · 首次周期只读档案' : '不死者 · 首次六十年周期与新年代',
    summary: handedOff ? '居所已实际完成交接；原身体、原物与寻回事实留在历史中，当前生活由摆渡人章节接续。' : l.phase === 'CYCLE_DEAD' ? '实际首周年已到；原身体周期性死亡，可以保存此节点。' : l.phase === 'AMNESIAC' ? `同一身体已复起，本人实际寻回${l.recoveredSources.length}/3个原来源。` : l.phase === 'PARTIAL_RECOVERY' ? `首次周期已实际经历1次；${guardian?.name ?? '当代守护人'}的新接待处开放有限普通生活。` : l.phase === 'RESIDING' ? '供养已实付、当前仍在原时代；还需要单独确认不可逆地度过年代。' : '先核对真实日期、原物及旧人的未来；现在仍可选择留在原时代。',
    boundary: BOUNDARY, consequences, dates, body: l.body ? `${l.body.id} · ${handedOff ? '居所离开时位置' : '当前位置'}${l.body.location} · 入驻健康${l.body.entryHealth}/精神${l.body.entryMind}/灵性${l.body.entrySpirituality}；原伤势记录${l.body.entryInjuries.length}条保留。${l.handoff ? `交接时健康${l.handoff.health}/精神${l.handoff.mind}/灵性${l.handoff.spirituality}，现金${l.handoff.cash}便士、行动${l.handoff.actionsRemaining}；这些是历史结余，当前身体位置和资源见摆渡人章节。` : `当前健康${s.health}/精神${s.mind}/灵性${s.spirituality}。`}` : `当前仍是本周目原身体${s.runId}:body；尚未登记长期守护。`,
    currentIdentity, people, objects: l.objects.map(o => `${o.id} · ${o.label} · ${o.disposition === 'PRESERVED' ? `实际保留在${o.location === 'PLAYER' ? '本人手中' : '原保管箱'}` : o.disposition === 'EXPIRED' ? '已过期，不属于当代可用库存' : '只保旧地点历史，不授予当代使用权'} · 来源${o.sourceId}`), memory,
    history: [`原册${l.bookId}，原三页保持唯一；原桌放下${s.undying.life.book.placements}次/取回${s.undying.life.book.returns}次，长期原箱放入${l.bookDeposits}次/取回${l.bookWithdrawals}次。`, `旧职业${s.character.professionName}和原周工资${s.character.weeklyWage}便士保留履历${closed ? '，当前雇佣已结束，不再领款' : ''}。`, `欧文原事实：${s.undying.encounter.enemy.status}，原棍${s.undying.encounter.enemy.weaponId}在原${s.undying.encounter.enemy.weaponLocation}；此章节不覆盖旧结局。`, ...(l.deadlinePreparationGranted ? [`临近周年一次专用筹备额度剩${l.deadlinePreparationRemaining}/7，不可用于旧职业；${l.deadlineSupportCompleted ? '第五项实做追加抵160已完成' : '尚未使用第五项困难补助'}。`] : [])],
    occupation: handedOff ? `已完成居所劳动${l.newLife.works}次、休整${l.newLife.rests}次、付费七天生活${l.newLife.weeks}次；原收入${l.newLife.income}/支出${l.newLife.expenses}便士不再变化。新渠道不会延长旧职业约定。` : closed ? `新档案接待处G：本人在${l.location === 'OUTSIDE' ? '门外' : l.location === 'CARE_ROOM' ? '原供养房' : '接待处'}；普通工作1行动+24便士，休整1行动/8便士，生活每七天24便士，下周固定4行动。已实际工作${l.newLife.works}次、休整${l.newLife.rests}次，收入${l.newLife.income}/支出${l.newLife.expenses}便士。` : `原职业${s.character.professionName}仍未因查看清单而终止；原册未保管且未入驻时，可继续原生活。`, actions };
}
export type * from './types.js';
