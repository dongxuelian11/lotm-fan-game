import type { PublicGameDate } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { stableStringify } from '../canonical.js';
import { addGameDays, addGameYears, compareGameDates, completedGameYears, formatGameDate, gameDaysBetween, isValidGameDate } from '../game-calendar.js';
import { hasBizarroRitualLock } from '../bizarro-sorcerer/ritual.js';
import { bizarroInside } from '../bizarro-sorcerer/life.js';
import { marionettistInside } from '../marionettist/practice.js';
import { hasAncientScholarLifeLock } from './life.js';
import { hasAncientScholarEncounterLock } from './encounter.js';
import { ANCIENT_SCHOLAR_BOUNDARY, ANCIENT_SCHOLAR_PREPARATIONS, ANCIENT_SCHOLAR_PRICES as PRICE, ANCIENT_SCHOLAR_REASSESSMENT, ANCIENT_SCHOLAR_RECORDS } from './content.js';
import { ANCIENT_SCHOLAR_PREPARATION_IDS, ANCIENT_SCHOLAR_RECORD_IDS, type AncientScholarAction, type AncientScholarIsolationVisit, type AncientScholarRitualCommand, type AncientScholarRitualProjection, type AncientScholarRitualState } from './types.js';

const ORIGIN: PublicGameDate = { epoch: 'FIFTH_EPOCH', year: 1349, month: 6, day: 28 };
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const dateText = (date: PublicGameDate) => formatGameDate(date);
const eligible = (s: SliceState) => s.progression.pathwayId === 'diviner' && [4, 3, 2].includes(s.progression.sequence ?? 0) && s.bizarroSorcerer.promotionWeek !== null;
const unpromoted = (s: SliceState) => s.progression.sequence === 4;
const SIMPLE = ['REVIEW_SECLUSION', 'HAND_OVER_BELL', 'FACILITY_WORK', 'PAY_FACILITY', 'VERIFY_CONTINUITY', 'ADVANCE_FIRST_150', 'ADVANCE_SECOND_150', 'ADVANCE_REASSESSMENT', 'ISOLATION_REST', 'EXIT_SECLUSION', 'REASSESS_HISTORY', 'ENTER_RECEPTION', 'LEAVE_RECEPTION', 'WORK', 'REST', 'NEXT_WEEK', 'CANCEL_PREPARATION'];
export function createAncientScholarRitualState(): AncientScholarRitualState {
  return { phase: 'NONE', location: 'OUTSIDE', facilityId: 'AS3-STASIS-1', vaultId: 'AS3-VAULT', custodianId: 'AS3-MARA', successorId: null,
    reviewedDate: null, preparationTasks: [], labourSteps: 0, paidPennies: 0, paidDate: null, bellHandover: null,
    records: ANCIENT_SCHOLAR_RECORDS.map(r => ({ id: r.id, title: r.title, source: r.source, historicalYear: null, obtainedDate: null, verifiedDate: null, originalLocation: 'ARCHIVE', copyId: null, verification: null })),
    visits: [], currentVisitId: null, eraClosedDate: null, calendarRemainderDays: 0, completed300VisitId: null, reassessedVisitId: null, people: [], objects: [],
    newLife: { week: null, works: 0, rests: 0, weeks: 0, income: 0, expenses: 0, emergencyWorkUsed: false } };
}
export function hasAncientScholarEraClosure(s: SliceState): boolean { return !!s.ancientScholar?.ritual.eraClosedDate; }
export function insideAncientScholarIsolation(s: SliceState): boolean { return s.ancientScholar?.ritual.location === 'VAULT'; }
export function currentAncientScholarVisit(s: SliceState): AncientScholarIsolationVisit | undefined { return s.ancientScholar.ritual.visits.find(v => v.id === s.ancientScholar.ritual.currentVisitId); }
export function hasAncientScholarLock(s: SliceState): boolean { return hasAncientScholarEraClosure(s) || insideAncientScholarIsolation(s) || hasAncientScholarLifeLock(s) || hasAncientScholarEncounterLock(s); }
export function validateAncientScholarRitualCommand(v: unknown): v is AncientScholarRitualCommand {
  if (!record(v)) return false;
  if (SIMPLE.includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'ENTER_SECLUSION' || v.type === 'EXIT_EARLY') return shape(v, ['type', 'confirmed']) && v.confirmed === true;
  if (v.type === 'PREPARE_FACILITY') return shape(v, ['type', 'taskId']) && ANCIENT_SCHOLAR_PREPARATION_IDS.includes(v.taskId as typeof ANCIENT_SCHOLAR_PREPARATION_IDS[number]);
  return ['OBTAIN_RECORD', 'VERIFY_RECORD'].includes(String(v.type)) && shape(v, ['type', 'recordId']) && ANCIENT_SCHOLAR_RECORD_IDS.includes(v.recordId as typeof ANCIENT_SCHOLAR_RECORD_IDS[number]);
}
/** The old record is left intact. Only actual present contacts/objects block departure. */
export function ancientScholarDepartureBlock(s: SliceState): string | null {
  if (s.activeEvent || s.combat || s.eventQueue.length || s.pulse !== 'NONE') return '先处理真实战斗、事件和未结周账，不能把正在发生的事跳过。';
  if (s.debts.some(d => d.remaining > 0) || ['ACCEPTED', 'CORRECT'].includes(s.aid) || s.arc.transferPending) return '先结清旧债务、已接援助和原案在途交接。';
  if (s.world.city !== 'BACKLUND') return '须实际在贝克兰德的AS3-VAULT办理。';
  if (marionettistInside(s) || hasBizarroRitualLock(s) || bizarroInside(s) || s.marionettist.puppet.active || s.bizarroSorcerer.life.worms.assigned > 0 || ['HELD', 'INITIAL_CONTROL', 'CONTROLLED'].includes(s.bizarroSorcerer.life.mouse.status)) return '先实际释放原秘偶/原鼠、回收外部分虫并退出已有现场；不允许室外代办或维持灵体之线。';
  if (Object.values(s.faceless.cases).some(c => c.contactOpen || c.status === 'PREPARED') || Object.values(s.marionettist.cases).some(c => c.contactOpen || c.status === 'PREPARED') || Object.values(s.bizarroSorcerer.life.cases).some(c => c.contactOpen || c.status === 'PREPARED') || s.faceless.outfit.location !== 'WARDROBE') return '先结束旧实践并归还同一原道具服。';
  if (s.bizarroSorcerer.life.practice.ownerAt !== 'NEAR' || s.bizarroSorcerer.life.practice.tag.holder !== 'CARRIER') return '先亲手回到原近端并取回BR4-TAG-1放入同一原携笼。';
  if (s.faceless.appearance.templateId !== 'SELF') return '先通过原无面人还原操作回到本人外貌，再核对同一原身体。';
  if (s.world.bellHolder === 'PLAYER' || s.world.bell === 'SECURED' || s.arc.transferPending) return '同一原铜铃仍只是临时收束；先本人办理真实组织交接，不把它带入封室。';
  if (s.arc.stage !== 'ENDED') return '先实际收束首案，不能用长期隔绝跳过未结束的约定。';
  return null;
}
function fit(s: SliceState): string | null {
  return s.health < 80 || s.mind < 60 || s.injuries.some(i => i.treatedRevision === null) || s.injuryRisk > 0 ? '入舱须健康至少80、精神至少60，且无未治伤势或风险；先实际普通休养，静封钟不治疗旧伤。' : null;
}
const facilityPrice = (r: AncientScholarRitualState) => r.labourSteps === 3 ? PRICE.facilityLabour : PRICE.facility;
export function canConsumeAncientScholar(s: SliceState, bottleId: string): boolean {
  const r = s.ancientScholar.ritual, v = currentAncientScholarVisit(s);
  return !!v && r.location === 'VAULT' && r.phase === 'QUALIFIED' && v.exitedDate === null && v.verifiedDate !== null && v.qualifiedDate !== null && v.result === 'QUALIFIED'
    && v.bodyId === `${s.runId}:body` && v.facilityId === 'AS3-STASIS-1' && v.registeredBottleIds.includes(bottleId)
    && compareGameDates(s.date, v.targetDate) >= 0 && v.milestones.every(m => m.communication === 'NONE' && m.bodyId === v.bodyId && m.facilityId === v.facilityId);
}
export function blockAncientScholarRitual(s: SliceState, c: AncientScholarRitualCommand): string | null {
  if (!validateAncientScholarRitualCommand(c)) return '古代学者隔绝命令无效，入舱与早退须分别确认。';
  if (s.status !== 'ACTIVE' || !eligible(s) || s.health <= 0) return '仅仍活着的诡法师或古代学者可用；普通死亡不能用静封钟复活。';
  const r = s.ancientScholar.ritual, v = currentAncientScholarVisit(s);
  if (s.combat || s.activeEvent || hasAncientScholarLifeLock(s) || hasAncientScholarEncounterLock(s)) return '先真实结束当前战斗、事件或本阶实践。';
  if (r.location === 'VAULT') {
    if (!v || v.exitedDate !== null) return '缺少当前同体封存记录。';
    if (c.type === 'EXIT_EARLY') return v.qualifiedDate === null && v.milestones.length > 0 ? null : '须先实际经过第一段150年才可提前退出；达到本次时长后使用正常离舱。';
    if (c.type === 'EXIT_SECLUSION') return v.qualifiedDate !== null ? null : '尚不足本次时长，可独立确认提前退出；过去年月不退。';
    if (c.type === 'ADVANCE_FIRST_150') return v.mode === 'THREE_CENTURIES' && v.milestones.length === 0 ? null : '第一段150年只能在本次完整隔绝起点推进一次。';
    if (c.type === 'ADVANCE_SECOND_150') return v.mode === 'THREE_CENTURIES' && v.milestones.length === 1 ? null : '先完成本次第一段150年，第二段不能重复。';
    if (c.type === 'ADVANCE_REASSESSMENT') return v.mode === 'G_REASSESSMENT' && v.milestones.length === 0 ? null : '仅已重新核对300年原履历的本次14天重审适用。';
    if (c.type === 'VERIFY_CONTINUITY') return v.qualifiedDate !== null && v.verifiedDate === null && unpromoted(s) ? null : '须本次实际达到目标日期，且尚未完成本地核验。';
    if (c.type === 'ISOLATION_REST') return !unpromoted(s) ? '已经晋升，沿普通出口离舱后休整。' : !s.ancientScholar.bottles.some(b => b.visitId === v.id && ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? '')) ? '封室有限休养仅供本次真实药败后恢复。' : v.recoveryUses >= v.recoveryAllowance ? '本次三个预置恢复包已用尽；可真实退出后重筹。' : s.cash < PRICE.isolationRest ? '本次原预置恢复包需12便士，不能透支。' : null;
    return '本人仍在完全隔绝封室内，不能进行外界通信、采购、工作、普通周结或远程操纵。';
  }
  if (['ADVANCE_FIRST_150', 'ADVANCE_SECOND_150', 'ADVANCE_REASSESSMENT', 'VERIFY_CONTINUITY', 'ISOLATION_REST', 'EXIT_SECLUSION', 'EXIT_EARLY'].includes(c.type)) return '本人并未在封室内，旧窗口不能替代当前连续隔绝。';
  if (c.type === 'HAND_OVER_BELL') {
    if (hasAncientScholarEraClosure(s)) return '旧时代已经关闭，不能让原值夜者再按当年身份收件。';
    if (r.bellHandover || s.arc.stage !== 'ENDED' || s.world.bell !== 'SECURED' || s.world.bellHolder !== 'PLAYER') return '只有本人仍持有首案中临时收束的同一原铜铃，才能办理这次后续交接。';
    if (!s.world.organizationAvailable || !s.world.organizationEligible || s.world.city !== 'BACKLUND') return '须原组织仍实际可接收，且本人在贝克兰德。';
    return s.actionsRemaining < 1 ? '实际走到接收室需1行动。' : s.cash < 60 ? '专业接收与原封装需60便士。' : null;
  }
  if (c.type === 'ENTER_RECEPTION') return hasAncientScholarEraClosure(s) && r.location === 'OUTSIDE' ? null : '只有已经离开隔绝、当前在门外时可进入当代接待处。';
  if (c.type === 'LEAVE_RECEPTION') return r.location === 'RECEPTION' && r.phase === 'RETURNED' ? null : '先结束或取消当前重新筹备，再沿接待处普通出口离开。';
  if (['WORK', 'REST', 'NEXT_WEEK'].includes(c.type)) {
    if (!hasAncientScholarEraClosure(s) || r.location !== 'RECEPTION') return '只有旧时代结束后本人实际在当代接待处，才使用这组新生活动作。';
    if (c.type === 'NEXT_WEEK') return s.actionsRemaining !== 0 ? '用完本周4行动后再实际推进七天。' : s.cash < PRICE.weekly ? '本周基本生活需24便士，资金不足时可实做一次受限补劳动。' : null;
    if (c.type === 'WORK') return s.actionsRemaining > 0 || s.cash < PRICE.weekly && !r.newLife.emergencyWorkUsed ? null : '需要1行动；低资金且0行动时本周仅一次真实补劳动。';
    return s.actionsRemaining < 1 ? '休整需1行动。' : s.cash < PRICE.rest ? '普通休整需8便士。' : null;
  }
  if (!unpromoted(s)) return '已真实晋升3，不可重复准备晋升或使用封室。';
  if (!s.ancientScholar.formulaKnown) return '先了解已核核心配方、隔绝与G设施风险。';
  if (hasAncientScholarEraClosure(s) && r.location !== 'RECEPTION') return '请沿普通道路进入当代接待处再办理重筹。';
  if (c.type === 'REVIEW_SECLUSION') return ['NONE', 'RETURNED'].includes(r.phase) ? ancientScholarDepartureBlock(s) : '当前准备已核对，不重复开启。';
  if (c.type === 'CANCEL_PREPARATION') return r.phase === 'PREPARING' ? null : '当前没有可取消的外界准备。';
  if (r.phase !== 'PREPARING') return '先核对本次隔绝清单。';
  if (c.type === 'ENTER_SECLUSION') {
    const blocked = ancientScholarDepartureBlock(s) ?? fit(s); if (blocked) return blocked;
    if (r.preparationTasks.length !== 3 || r.paidDate === null) return '先完成三项不同实际检查与本次维护付款。';
    if (r.records.some(x => x.verifiedDate === null || x.originalLocation !== 'PLAYER')) return '三份原档案须本次真实取得、核验并由本人登记入舱。';
    if (s.progression.acting !== 100) return '原诡法师魔药须已100消化，长期等待不会赠予消化。';
    if (!s.ancientScholar.bottles.some(b => b.status === 'PREPARED')) return '须先实际调配可登记的原瓶。';
    if (r.visits.length === 0 && s.ancientScholar.bottles.filter(b => b.status === 'PREPARED').length < 3) return '首次隔绝须完成三份独立原材料与原瓶，登记两个备用原瓶。';
    if (r.completed300VisitId && r.reassessedVisitId !== r.completed300VisitId) return '先由当代接待人重新核对已有300年原履历，才能准备14天G复审。';
    return s.date.year > 999699 ? '当前日期不支持继续完整300年。' : null;
  }
  if (c.type === 'PAY_FACILITY') return r.preparationTasks.length !== 3 ? '先完成三项不同实际准备。' : r.paidDate !== null ? '本次已经实际付款。' : s.cash < facilityPrice(r) ? `本次维护需要${facilityPrice(r)}便士，可先做三次实际设施劳动减至120。` : null;
  if (s.actionsRemaining < 1) return '本次实际工作需要1行动。';
  if (c.type === 'FACILITY_WORK') return r.paidDate !== null || r.labourSteps >= 3 ? '本次抵扣已经完成或已付款，不能追溯抵扣。' : null;
  if (c.type === 'PREPARE_FACILITY') return r.preparationTasks.includes(c.taskId) ? '这项不同检查已实际完成。' : null;
  if (c.type === 'REASSESS_HISTORY') return !r.completed300VisitId ? '没有真实完成的连续300年原履历，不能用短期复审替代。' : r.reassessedVisitId === r.completed300VisitId ? '本次重审已实际核对。' : null;
  if (c.type === 'OBTAIN_RECORD' || c.type === 'VERIFY_RECORD') {
    const archive = r.records.find(x => x.id === c.recordId)!;
    if (c.type === 'OBTAIN_RECORD') return archive.obtainedDate !== null ? '这份同一原档案已经实际取得，不能复制。' : null;
    return archive.obtainedDate === null ? '先亲自取得这份原档案。' : archive.verifiedDate !== null ? '已核对这份原档案，不能重复获得真实历史。' : null;
  }
  return '当前没有这项隔绝动作。';
}

function moveClock(s: SliceState, date: PublicGameDate): void {
  const r = s.ancientScholar.ritual, absolute = gameDaysBetween(ORIGIN, date);
  s.date = { ...date }; s.week = Math.floor(absolute / 7) + 1; r.calendarRemainderDays = absolute % 7;
}
function archiveOldEra(s: SliceState): void {
  const r = s.ancientScholar.ritual;
  r.objects = [
    { id: `${s.runId}:AS3-CASH-RECEIPT-1`, source: 'AS3-ARCHIVE:zero-interest-custody-G', disposition: 'PRESERVED', text: `出发时${s.cash}便士由原机构登记同额零利息托管G；隔绝中仅扣本人实际耗用的预置恢复包，出舱兑付剩余余额，无利息、旧工资或未知资产。` },
    { id: 'BR4-CARRIER-1', source: 'bizarroSorcerer.life.practice.carrier', disposition: 'PRESERVED', text: '唯一原携笼与其中BR4-TAG-1登记保护；原鼠已释放/解除控制，不在里面经营或传信。' },
    { id: 'BR4-TAG-1', source: 'bizarroSorcerer.life.practice.tag', disposition: 'PRESERVED', text: '原1克纸签仍在同一原携笼中，没有生成新件。' },
    { id: 'MM5-NOTE', source: 'marionettist.puppet.note', disposition: 'HISTORICAL_ONLY', text: `原信仍留旧位置${s.marionettist.puppet.note.location}，没有入舱。` },
    { id: 'MAGICIAN-OLD-CONSUMABLES', source: 'magician.lantern/figurinesHeld/inventory', disposition: 'EXPIRED', text: '未登记旧灯油、纸替身与旧时代普通耗材不受静封钟保护；旧数量为历史，不可在新时代使用。' },
    { id: `${s.runId}:ARC-BELL-1`, source: 'world.bell/原首案后续交接', disposition: 'HISTORICAL_ONLY', text: '原铜铃没有入舱；保留原首案结论与后续收据，长期后具体外部去向须另查，不宣称永久绝对安全。' },
  ];
  for (const key of ['seer', 'clown', 'magician', 'faceless', 'marionettist', 'bizarroSorcerer'] as const) for (const bottle of s[key].bottles) if (bottle.status !== 'CONSUMED') r.objects.push({ id: bottle.id, source: `${key}:original-bottle`, disposition: 'EXPIRED', text: '未登记入舱的旧原瓶，仅保历史，不再是可服当代材料。' });
}
function recordReturnedEra(s: SliceState): void {
  const r = s.ancientScholar.ritual, first = r.eraClosedDate!, dead = addGameYears(first, 38);
  if (compareGameDates(s.date, dead) >= 0 && !r.people.some(p => p.id === 'AS3-MARA')) r.people.push({ id: 'AS3-MARA', date: dead, kind: 'DEATH', text: '原46岁保管员玛拉·森在出发38年后、84岁故去G；原授权与封存登记仍存，本人没有看守300年。' });
  if (!r.people.some(p => p.id === 'OLD-AGREEMENTS')) r.people.push({ id: 'OLD-AGREEMENTS', date: { ...first }, kind: 'AGREEMENT_ENDED', text: '原租约、职业、周工资、指南及私人约定在出发时终结，不积累300年工资、补给或消化。原死者多恩保持死亡；普通旧人在长期后只属历史，长寿者去向未知。' });
  const years = completedGameYears(first, s.date);
  r.successorId = years < 38 ? 'AS3-MARA' : years < 360 ? 'AS3-ELIN' : `AS3-ELIN-ERA-${Math.floor(years / 300)}`;
}
export function applyAncientScholarRitual(s: SliceState, c: AncientScholarRitualCommand, ctx: SeerContext): void {
  const reason = blockAncientScholarRitual(s, c); if (reason) throw new Error(reason);
  const r = s.ancientScholar.ritual, v = currentAncientScholarVisit(s);
  if (c.type === 'HAND_OVER_BELL') {
    s.actionsRemaining -= 1; s.cash -= 60; r.bellHandover = { bellId: `${s.runId}:ARC-BELL-1`, receiverId: 'AS3-IVO', receiptId: `${s.runId}:AS3-BELL-RECEIPT-1`, date: { ...s.date }, paidPennies: 60 };
    s.world.bell = 'CONTAINED'; s.world.bellHolder = 'ORGANIZATION'; s.world.bellAtScene = false; s.world.organizationArrived = true;
    ctx.note('同一原铜铃实际交入组织收容箱', `花1行动、60便士，本人沿普通道路送交${r.bellHandover.bellId}，由当场38岁成年收容员伊沃·雷恩AS3-IVO核原封装并收进值夜者原收容箱，取得${r.bellHandover.receiptId}。原首案卷宗当时“临时收束”结论及携铃者生死不改；本次只是后续真实交接，不新增铜铃、不带入封室，也不保证组织之后300年的情况。`); return;
  }
  if (c.type === 'REVIEW_SECLUSION') {
    r.phase = 'PREPARING'; r.reviewedDate = { ...s.date }; r.preparationTasks = []; r.labourSteps = 0; r.paidPennies = 0; r.paidDate = null; r.reassessedVisitId = null;
    ctx.note('核对不可逆隔绝清单，尚未入舱', `当前保管员${r.successorId ?? 'AS3-MARA玛拉·森，46岁'}在场。三项实际准备、原档案与原瓶、同一原身体须分别核对。只有ENTER_SECLUSION独立确认才关闭旧时代；普通人会故去，旧约定终止，只有登记原件受保护。${ANCIENT_SCHOLAR_BOUNDARY}${ANCIENT_SCHOLAR_REASSESSMENT}`); return;
  }
  if (c.type === 'CANCEL_PREPARATION') { r.phase = hasAncientScholarEraClosure(s) ? 'RETURNED' : 'NONE'; ctx.note('取消当前未入舱准备', '本人没有进入封室；已做劳动、已付维护与材料成本不退款，原档案和原瓶仍由本人持有。再次准备需重新核对与付款。'); return; }
  if (c.type === 'OBTAIN_RECORD' || c.type === 'VERIFY_RECORD') {
    s.actionsRemaining -= 1; const a = r.records.find(x => x.id === c.recordId)!, spec = ANCIENT_SCHOLAR_RECORDS.find(x => x.id === c.recordId)!;
    if (c.type === 'OBTAIN_RECORD') { a.obtainedDate = { ...s.date }; a.historicalYear = s.date.year - spec.age; a.originalLocation = 'PLAYER'; ctx.note('亲自取得一份原古代档案', `花1行动实际整理目录并从原机构接收${a.id}：${a.title}，第五纪${a.historicalYear}年原件。来源：${a.source}。尚未验证真伪，名字本身不算已知真实历史。`); }
    else { a.verifiedDate = { ...s.date }; a.copyId = `${a.id}:VERIFIED-COPY`; a.verification = '本人实际对照原纸水印、同年签押和独立连续保管目录，逐页比对前后账项与日期；本次G确定为真实旧档案。'; ctx.note('实际核验原史料并保留可读副本', `花1行动，${a.id}：${a.verification}取得${a.copyId}。供药用的每批独立誊录材料会实际消耗，可读核验副本保留；不能由文献追问未知秘密或改写历史。`); } return;
  }
  if (c.type === 'PREPARE_FACILITY') { s.actionsRemaining -= 1; r.preparationTasks.push(c.taskId); ctx.note(ANCIENT_SCHOLAR_PREPARATIONS[c.taskId], `花1行动在${r.vaultId}与当前实际保管员检查固定原件${r.facilityId}。不是随身物，不治入舱旧伤，不补灵性；本地机械钟与本人醒时核对不连接外界消息。`); return; }
  if (c.type === 'FACILITY_WORK') { s.actionsRemaining -= 1; r.labourSteps += 1; ctx.note('实际准备维护材料', `花1行动，完成第${r.labourSteps}/3次实际清理、封条或原槽维护；三次全做后本次360便士降至120，劳动不发现金、不重复折现。`); return; }
  if (c.type === 'PAY_FACILITY') { r.paidPennies = facilityPrice(r); s.cash -= r.paidPennies; r.paidDate = { ...s.date }; ctx.note('原静封钟本次维护已实付', `${r.paidPennies}便士已付，三项准备记录保留。日期尚未推进、本人尚未入舱；另行确认ENTER_SECLUSION才不可逆结束旧时代。`); return; }
  if (c.type === 'REASSESS_HISTORY') { s.actionsRemaining -= 1; r.reassessedVisitId = r.completed300VisitId; ctx.note('当代接待处实际复核原300年履历', `花1行动核对${r.completed300VisitId}原同体、本地钟与无通信记录。${ANCIENT_SCHOLAR_REASSESSMENT}此刻仍在外界，尚不具本次饮药窗口。`); return; }
  if (c.type === 'ENTER_SECLUSION') {
    const mode = r.completed300VisitId ? 'G_REASSESSMENT' : 'THREE_CENTURIES';
    const visit: AncientScholarIsolationVisit = { id: `AS3-VISIT-${r.visits.length + 1}`, mode, facilityId: 'AS3-STASIS-1', bodyId: `${s.runId}:body`, enteredDate: { ...s.date }, exitedDate: null,
      targetDate: mode === 'THREE_CENTURIES' ? addGameYears(s.date, 300) : addGameDays(s.date, 14), elapsedDays: 0, milestones: [],
      registeredBottleIds: s.ancientScholar.bottles.filter(b => b.status === 'PREPARED').map(b => b.id), registeredRecordIds: [...ANCIENT_SCHOLAR_RECORD_IDS], retainedObjectIds: ['BR4-CARRIER-1', 'BR4-TAG-1'],
      entryHealth: s.health, entryMind: s.mind, entrySpirituality: s.spirituality, qualifiedDate: null, verifiedDate: null, result: 'SEALED', recoveryUses: 0, recoveryAllowance: 3, reassessedVisitId: r.reassessedVisitId };
    r.visits.push(visit); r.currentVisitId = visit.id; r.phase = 'SEALED'; r.location = 'VAULT'; for (const a of r.records) a.originalLocation = 'VAULT';
    if (r.eraClosedDate === null) archiveOldEra(s);
    s.actionsRemaining = 0;
    ctx.note('同一原身体实际进入完全隔绝封室', `${visit.bodyId}进入${r.vaultId}，原件${r.facilityId}仅保护本次${visit.registeredBottleIds.length}瓶、三原档案及BR4-CARRIER-1/TAG。健康${s.health}、精神${s.mind}、灵性${s.spirituality}原值保留；没有治疗或回灵。余款${s.cash}便士已登记同额零利息托管G，封室中只有本人实际耗用预置恢复包时本地扣账，不需对外通信，出舱兑付剩余余额。入舱锁定全部旧命令，不通讯、不操纵室外秘偶、不累计旧工资与补给。目标${dateText(visit.targetDate)}，${mode === 'THREE_CENTURIES' ? '实际两段各150年，尚未流逝。' : '新14天G连续隔绝，尚未完成。'}`); return;
  }
  if (c.type === 'ADVANCE_FIRST_150' || c.type === 'ADVANCE_SECOND_150' || c.type === 'ADVANCE_REASSESSMENT') {
    const target = c.type === 'ADVANCE_FIRST_150' ? addGameYears(v!.enteredDate, 150) : v!.targetDate;
    if (r.eraClosedDate === null) r.eraClosedDate = { ...v!.enteredDate };
    moveClock(s, target); v!.elapsedDays = gameDaysBetween(v!.enteredDate, target);
    v!.milestones.push({ id: `${v!.id}:LOCAL-${v!.milestones.length + 1}`, date: { ...target }, elapsedDays: v!.elapsedDays, bodyId: v!.bodyId, facilityId: 'AS3-STASIS-1', communication: 'NONE' });
    if (compareGameDates(target, v!.targetDate) >= 0) { v!.qualifiedDate = { ...target }; v!.result = 'QUALIFIED'; r.phase = 'QUALIFIED'; if (v!.mode === 'THREE_CENTURIES') r.completed300VisitId = v!.id; }
    ctx.note('封室本地钟与同一活体实际走过年月', `${dateText(target)}，世界第${s.week}周另余${r.calendarRemainderDays}天；本次已隔绝${v!.elapsedDays}天。本人清醒核对${v!.milestones.at(-1)!.id}，同体存活、无外界通信，原灵性与伤势不变。${v!.qualifiedDate ? '已到目标，仍须本人本地核验，尚未服药。' : '第一段150年不满足至少300年；可以独立确认早退，过去时间不回退。'}没有当代外界消息传入。`); return;
  }
  if (c.type === 'VERIFY_CONTINUITY') { v!.verifiedDate = { ...s.date }; ctx.note('本地核验同一原身体与完整连续隔绝', `${v!.id}的原机械钟、原封条、同体登记与${v!.milestones.length}段本地记录相符，未通信未出舱；已登记原瓶现在可以独立确认饮用。仍在封室内，没有先走进新城或接触当代人。`); return; }
  if (c.type === 'ISOLATION_REST') { s.cash -= PRICE.isolationRest; v!.recoveryUses += 1; s.health = Math.min(100, s.health + 15); s.mind = Math.min(100, s.mind + 25); s.seer.pollution = Math.max(0, s.seer.pollution - 20); moveClock(s, addGameDays(s.date, 1)); v!.elapsedDays = gameDaysBetween(v!.enteredDate, s.date); ctx.note('耗用一个原预置恢复包，仍未联系外界', `实付12便士，原恢复包第${v!.recoveryUses}/3个耗尽，封室中真实休养1天；健康+15、精神+25、排异−20，灵性不补。不是重新生成生命支持道具；没有备用原瓶就须退出重筹。`); return; }
  if (c.type === 'EXIT_EARLY' || c.type === 'EXIT_SECLUSION') {
    v!.exitedDate = { ...s.date }; v!.elapsedDays = gameDaysBetween(v!.enteredDate, s.date); if (c.type === 'EXIT_EARLY') v!.result = 'EARLY_EXIT'; else if (v!.result !== 'PROMOTED') v!.result = 'LEFT_QUALIFIED';
    r.location = 'RECEPTION'; r.phase = 'RETURNED'; for (const a of r.records) a.originalLocation = 'PLAYER'; recordReturnedEra(s);
    s.actionsRemaining = 4; s.weeklyBudget = 4; r.newLife.week = s.week; r.newLife.emergencyWorkUsed = false;
    ctx.note(c.type === 'EXIT_EARLY' ? '提前走出原封室，过去年月保留' : '沿原出口走入当代接待处', `${v!.bodyId}与登记原件由本人取出，静封钟留在AS3-VAULT。实际日期${dateText(s.date)}，本次过去${v!.elapsedDays}天，费用不退；机构实际兑付同额零利息托管余款${s.cash}便士，已耗预置恢复包费用已扣，不补旧工资。${c.type === 'EXIT_EARLY' ? '本次不够连续300年，不能饮药；再次准备须新完整300年。' : '原隔绝窗口已经关闭；若未晋升，须按G重审与新14天准备。'}当前接待人为${r.successorId === 'AS3-MARA' ? '尚健在的原玛拉' : `新当代32岁艾琳·萨尔${r.successorId}，不是玛拉本人，也没有血亲保证`}。${r.people.map(p => p.text).join(' ')}`); return;
  }
  if (c.type === 'ENTER_RECEPTION') { r.location = 'RECEPTION'; ctx.note('沿普通道路进入当代接待处', '本人及实际取回原件进入AS3-RECEPTION，旧人旧案不在此重新接单。'); return; }
  if (c.type === 'LEAVE_RECEPTION') { r.location = 'OUTSIDE'; ctx.note('沿当代接待处普通出口离开', '同一身体与所持原物来到门外，可沿原路返回；本阶段只开放明确后世接待处与本阶实践。'); return; }
  if (c.type === 'WORK') { const extra = s.actionsRemaining === 0; if (extra) r.newLife.emergencyWorkUsed = true; else s.actionsRemaining -= 1; s.cash += PRICE.work; r.newLife.works += 1; r.newLife.income += PRICE.work; ctx.note('在当代档案接待处实际劳动', `实做整理获得24便士，${extra ? '本周低资金一次额外补劳动已用。' : '花1行动。'}没有旧工资、掌握或消化奖励。`); return; }
  if (c.type === 'REST') { s.actionsRemaining -= 1; s.cash -= PRICE.rest; r.newLife.rests += 1; r.newLife.expenses += PRICE.rest; s.health = Math.min(100, s.health + 5); s.mind = Math.min(100, s.mind + 8); s.spirituality = Math.min(120, s.spirituality + 10); s.seer.pollution = Math.max(0, s.seer.pollution - 10); for (const injury of s.injuries) if (injury.treatedRevision === null) injury.treatedRevision = s.revision + 1; s.injuryRisk = 0; ctx.note('当代接待处实际休整', '花1行动、8便士，健康+5、精神+8、灵性+10、排异−10，普通处理已有伤势；历史受伤事实保留，不治疗普通战死。'); return; }
  if (c.type === 'NEXT_WEEK') { s.cash -= PRICE.weekly; r.newLife.expenses += PRICE.weekly; r.newLife.weeks += 1; r.newLife.emergencyWorkUsed = false; moveClock(s, addGameDays(s.date, 7)); r.newLife.week = s.week; s.actionsRemaining = 4; s.weeklyBudget = 4; ctx.note('当代实际过去七天', `${dateText(s.date)}，实付24便士基本生活，下周4行动；旧工资、旧NPC、旧补给均不重跑。`); }
}

export function ancientScholarRitualActions(s: SliceState): AncientScholarAction[] {
  if (!eligible(s)) return [];
  const r = s.ancientScholar.ritual, v = currentAncientScholarVisit(s), actions: AncientScholarAction[] = [];
  const add = (id: string, label: string, cost: string, command: AncientScholarRitualCommand) => { const reason = blockAncientScholarRitual(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (r.location === 'VAULT') {
    if (v?.mode === 'THREE_CENTURIES' && !v.milestones.length) add('as3-first-150', '真实度过第一段150年', '0行动 · 世界年月不可逆推进 · 无通信', { type: 'ADVANCE_FIRST_150' });
    if (v?.mode === 'THREE_CENTURIES' && v.milestones.length === 1) add('as3-second-150', '继续真实度过第二段150年', '0行动 · 连续隔绝满300年', { type: 'ADVANCE_SECOND_150' });
    if (v?.mode === 'G_REASSESSMENT' && !v.milestones.length) add('as3-reassess-14', '重新连续隔绝14天并保留原记录', '0行动 · 本作G重审 · 真实经过14天', { type: 'ADVANCE_REASSESSMENT' });
    if (v?.qualifiedDate && !v.verifiedDate && unpromoted(s)) add('as3-verify-continuity', '本人核验同体与本地无通信记录', '0行动 · 仍在封室内', { type: 'VERIFY_CONTINUITY' });
    if (v?.qualifiedDate && unpromoted(s)) add('as3-isolation-rest', '耗用原预置恢复包休养一天', `12便士 · 本次已用${v.recoveryUses}/3 · 不补灵性`, { type: 'ISOLATION_REST' });
    if (v?.qualifiedDate) add('as3-exit', '取回同一原件，沿出口离舱', '0行动 · 当前饮药窗口关闭', { type: 'EXIT_SECLUSION' });
    else if (v?.milestones.length) add('as3-exit-early', '提前退出，保留已流逝150年', '独立确认 · 无300年资格 · 成本不返', { type: 'EXIT_EARLY', confirmed: true });
    return actions;
  }
  if (!hasAncientScholarEraClosure(s) && s.world.bellHolder === 'PLAYER') add('as3-hand-over-bell', '本人把原铜铃交入值夜者收容箱', '1行动 · 60便士 · 原收据 · 不入舱', { type: 'HAND_OVER_BELL' });
  if (hasAncientScholarEraClosure(s)) {
    if (r.location === 'OUTSIDE') add('as3-enter-reception', '沿普通道路进入当代接待处', '0行动', { type: 'ENTER_RECEPTION' });
    else {
      add('as3-work', '当代档案接待处实际劳动', '1行动 · +24便士 · 不加消化', { type: 'WORK' });
      add('as3-rest', '当代接待处普通休整', '1行动 · 8便士 · 健康+5/精神+8/灵性+10', { type: 'REST' });
      add('as3-next-week', '实付生活费，进入下个真实周', '24便士 · 需用完行动 · 下一周4行动', { type: 'NEXT_WEEK' });
      if (r.phase === 'RETURNED') add('as3-leave-reception', '沿当代接待处普通出口离开', '0行动', { type: 'LEAVE_RECEPTION' });
    }
  }
  if (!unpromoted(s) || !s.ancientScholar.formulaKnown) return actions;
  if (r.phase === 'NONE' || r.phase === 'RETURNED') add('as3-review-seclusion', r.completed300VisitId ? '核对既有300年履历与重筹清单' : '核对至少300年完全隔绝清单', '0行动 · 尚未入舱 · 先收束旧物', { type: 'REVIEW_SECLUSION' });
  if (r.phase !== 'PREPARING') return actions;
  for (const archive of r.records) {
    if (archive.obtainedDate === null) add(`as3-obtain-${archive.id}`, `实际取得：${archive.title}`, '1行动 · 原件尚未核验', { type: 'OBTAIN_RECORD', recordId: archive.id });
    else if (archive.verifiedDate === null) add(`as3-verify-${archive.id}`, `交叉核验：${archive.title}`, '1行动 · 来源/纸张/保管记录 · 保留可读副本', { type: 'VERIFY_RECORD', recordId: archive.id });
  }
  if (r.completed300VisitId && !r.reassessedVisitId) add('as3-reassess-history', '由当代接待人实际复核原300年记录', '1行动 · 随后新准备与14天G隔绝', { type: 'REASSESS_HISTORY' });
  for (const taskId of ANCIENT_SCHOLAR_PREPARATION_IDS) if (!r.preparationTasks.includes(taskId)) add(`as3-prepare-${taskId}`, ANCIENT_SCHOLAR_PREPARATIONS[taskId].replace('玛拉', r.successorId ? '当代保管员' : '玛拉'), '1行动 · 原设施不治疗旧伤', { type: 'PREPARE_FACILITY', taskId });
  if (r.paidDate === null) {
    if (r.labourSteps < 3) add('as3-facility-work', '实际准备原设施维护材料', `1行动 · ${r.labourSteps}/3 · 三次后维护降至120便士`, { type: 'FACILITY_WORK' });
    add('as3-pay-facility', '支付本次原设施维护', `${facilityPrice(r)}便士 · 0行动 · 不入舱、不跳年`, { type: 'PAY_FACILITY' });
  }
  add('as3-enter-seclusion', r.completed300VisitId ? '同体与原件入舱，开始新14天G隔绝' : '同体与原件入舱，开始至少300年完全隔绝', '独立确认 · 入舱后旧命令锁定 · 年月与成本不退', { type: 'ENTER_SECLUSION', confirmed: true });
  add('as3-cancel-preparation', '取消尚未入舱准备', '0行动 · 已付费用不返还', { type: 'CANCEL_PREPARATION' });
  return actions;
}
export function projectAncientScholarRitual(s: SliceState): AncientScholarRitualProjection {
  const r = s.ancientScholar.ritual, v = currentAncientScholarVisit(s), inside = insideAncientScholarIsolation(s), closed = hasAncientScholarEraClosure(s);
  return { title: '原静封钟与真实300年隔绝', phase: r.phase, eraClosed: closed, locked: hasAncientScholarLock(s), insideIsolation: inside, location: r.location,
    summary: inside ? `同一身体在${r.vaultId}，本次已经实际隔绝${v?.elapsedDays ?? 0}天；只有本地钟与本人记录，没有外界消息。` : closed ? '旧时代已结束；同一身体与登记原物进入明确原创G后世，原旧人和旧场景不再当代接单。' : '先真实取得原档案、核心材料与三原瓶，收束旧实践、伤势与铜铃，再决定是否进入固定封室。可以保持诡法师。',
    boundary: `${ANCIENT_SCHOLAR_BOUNDARY}${ANCIENT_SCHOLAR_REASSESSMENT}`,
    facility: '固定原件AS3-STASIS-1静封钟只存在于AS3-VAULT；原玛拉·森46岁实际授权和检查。只维持登记活体与原件，不治疗、不回灵性，不是可携带无敌物。',
    body: v ? `${v.bodyId}仍是原身体；入舱健康${v.entryHealth}/精神${v.entryMind}/灵性${v.entrySpirituality}，当前${s.health}/${s.mind}/${s.spirituality}；创建年龄不覆盖，隔绝日历龄增加而生理存活由G设施维持。` : '尚未登记原身体，普通死亡与旧伤不能借此复活或治好。',
    dates: [`当前${dateText(s.date)} · 第${s.week}周`, ...(v ? [`本次入舱${dateText(v.enteredDate)}；目标${dateText(v.targetDate)}`, ...v.milestones.map(m => `${m.id}：${dateText(m.date)}，${m.elapsedDays}天，同体与无通信`), ...(v.exitedDate ? [`本次实际退出${dateText(v.exitedDate)}`] : [])] : [])],
    consequences: ['初次入舱独立确认后，旧命令被锁；实际推进150年会不可逆结束旧时代。', '原玛拉会在出发38年后、84岁故去G；当代接待人不是原人等待300年。', '旧租约、职业工资和私人约定终结；现金G同额零利息托管，隔绝仅扣实际预置恢复包，出舱兑付；没有跳时收入、补药或自动消化。', '只有登记的同一身体、原三瓶/史料、原携笼与原纸签受保护；其余旧耗材失效。', '不足300年早退仍保留已过150年；不能饮药，重新隔绝仍须完整300年。'],
    records: r.records.map(a => ({ id: a.id, title: a.title, source: a.source, status: a.verifiedDate ? `第五纪${a.historicalYear}年真实原档案已核验 · ${a.originalLocation} · ${a.copyId}` : a.obtainedDate ? '本人已实际取得，尚未核验真伪' : '机构持有，尚未亲自取得', verification: a.verification ?? '尚无本次真实核验结果。' })),
    people: inside ? [] : r.people.map(p => `${p.id} · ${dateText(p.date)} · ${p.text}`).concat(r.successorId ? [`当前实际接待人${r.successorId === 'AS3-MARA' ? '原玛拉' : `${r.successorId}艾琳·萨尔，32岁G；新原身体，与原玛拉没有身份或血亲保证`}`] : []),
    objects: r.objects.map(o => `${o.id} · ${o.disposition} · ${o.text}`),
    history: r.visits.map(x => `${x.id} · ${x.mode} · ${x.elapsedDays}天 · ${x.result} · 原瓶${x.registeredBottleIds.join('、')}`).concat(r.bellHandover ? [`${r.bellHandover.receiptId}：${dateText(r.bellHandover.date)}本人把${r.bellHandover.bellId}交给AS3-IVO；60便士，原首案结论保留。`] : []),
    qualification: inside && v?.verifiedDate ? `本次${v.mode === 'THREE_CENTURIES' ? '至少300年' : '14天G重新隔绝'}已本地核验；仍在封室的登记原瓶可独立确认饮用。` : inside && v?.qualifiedDate ? '已达到目标时长，尚须本地核验同体/原件/无通信记录。' : r.completed300VisitId ? `已有${r.completed300VisitId}真实300年履历；离舱后旧窗口关闭，重新核对、付款和14天G隔绝才可再试。` : '尚无本次已核验连续300年饮药资格。',
    ordinaryLife: closed ? '当代接待处：工作1行动+24便士；休整1行动8便士；周生活24便士，下一周4行动。低资金每周一次实际补劳动，不刷旧工资或批量供给。' : '尚在旧时代，原普通生活继续；准备不会免费恢复行动。' };
}
export function validateAncientScholarRitualState(s: SliceState): boolean {
  try { return validateRitual(s); } catch { return false; }
}
function validateRitual(s: SliceState): boolean {
  const r = s.ancientScholar.ritual, base = createAncientScholarRitualState();
  if (!record(r) || !shape(r, Object.keys(base)) || r.facilityId !== base.facilityId || r.vaultId !== base.vaultId || r.custodianId !== base.custodianId || !['NONE', 'PREPARING', 'SEALED', 'QUALIFIED', 'RETURNED'].includes(r.phase) || !['OUTSIDE', 'VAULT', 'RECEPTION'].includes(r.location)) return false;
  if (!Array.isArray(r.preparationTasks) || new Set(r.preparationTasks).size !== r.preparationTasks.length || r.preparationTasks.some(t => !ANCIENT_SCHOLAR_PREPARATION_IDS.includes(t)) || !integer(r.labourSteps, 0, 3) || !integer(r.paidPennies, 0, 360) || !integer(r.calendarRemainderDays, 0, 6)) return false;
  const validDate = (d: PublicGameDate | null) => d === null || isValidGameDate(d) && compareGameDates(d, s.date) <= 0;
  if (![r.reviewedDate, r.paidDate, r.eraClosedDate].every(validDate) || r.paidDate !== null && (r.paidPennies !== facilityPrice(r) || r.preparationTasks.length !== 3)) return false;
  if (r.paidDate === null && r.paidPennies !== 0) return false;
  if (r.bellHandover !== null) {
    const h = r.bellHandover;
    if (!record(h) || !shape(h, ['bellId', 'receiverId', 'receiptId', 'date', 'paidPennies']) || h.bellId !== `${s.runId}:ARC-BELL-1` || h.receiverId !== 'AS3-IVO' || h.receiptId !== `${s.runId}:AS3-BELL-RECEIPT-1` || !isValidGameDate(h.date) || !validDate(h.date) || h.paidPennies !== 60 || s.world.bell !== 'CONTAINED' || s.world.bellHolder !== 'ORGANIZATION' || s.world.bellAtScene) return false;
  }
  if (!Array.isArray(r.records) || r.records.length !== 3) return false;
  for (const [i, a] of r.records.entries()) {
    const expected = ANCIENT_SCHOLAR_RECORDS[i]!;
    if (!record(a) || !shape(a, Object.keys(base.records[i]!)) || a.id !== expected.id || a.title !== expected.title || a.source !== expected.source || !validDate(a.obtainedDate) || !validDate(a.verifiedDate) || !['ARCHIVE', 'PLAYER', 'VAULT'].includes(a.originalLocation)) return false;
    if (a.obtainedDate === null) { if (a.historicalYear !== null || a.originalLocation !== 'ARCHIVE' || a.verifiedDate !== null || a.copyId !== null || a.verification !== null) return false; }
    else if (a.historicalYear !== a.obtainedDate.year - expected.age || a.originalLocation === 'ARCHIVE' || a.verifiedDate !== null && compareGameDates(a.verifiedDate, a.obtainedDate) < 0) return false;
    if (a.verifiedDate !== null ? a.copyId !== `${a.id}:VERIFIED-COPY` || typeof a.verification !== 'string' || a.verification.length < 10 : a.copyId !== null || a.verification !== null) return false;
  }
  if (!Array.isArray(r.visits) || new Set(r.visits.map(v => v.id)).size !== r.visits.length) return false;
  for (const [i, v] of r.visits.entries()) {
    if (!record(v) || !shape(v, ['id', 'mode', 'facilityId', 'bodyId', 'enteredDate', 'exitedDate', 'targetDate', 'elapsedDays', 'milestones', 'registeredBottleIds', 'registeredRecordIds', 'retainedObjectIds', 'entryHealth', 'entryMind', 'entrySpirituality', 'qualifiedDate', 'verifiedDate', 'result', 'recoveryUses', 'recoveryAllowance', 'reassessedVisitId']) || v.id !== `AS3-VISIT-${i + 1}` || v.facilityId !== 'AS3-STASIS-1' || v.bodyId !== `${s.runId}:body` || !['THREE_CENTURIES', 'G_REASSESSMENT'].includes(v.mode) || !isValidGameDate(v.enteredDate) || !isValidGameDate(v.targetDate) || !validDate(v.enteredDate) || !validDate(v.exitedDate) || !validDate(v.qualifiedDate) || !validDate(v.verifiedDate)) return false;
    if (!same(v.targetDate, v.mode === 'THREE_CENTURIES' ? addGameYears(v.enteredDate, 300) : addGameDays(v.enteredDate, 14))) return false;
    if (!integer(v.entryHealth, 80, 100) || !integer(v.entryMind, 60, 100) || !integer(v.entrySpirituality, 0, 120) || !integer(v.recoveryUses, 0, 3) || v.recoveryAllowance !== 3 || !integer(v.elapsedDays) || !['SEALED', 'EARLY_EXIT', 'QUALIFIED', 'PROMOTED', 'LEFT_QUALIFIED'].includes(v.result)) return false;
    if (!Array.isArray(v.registeredBottleIds) || !v.registeredBottleIds.length || new Set(v.registeredBottleIds).size !== v.registeredBottleIds.length || v.registeredBottleIds.some(id => !s.ancientScholar.bottles.some(b => b.id === id))) return false;
    if (!same(v.registeredRecordIds, ANCIENT_SCHOLAR_RECORD_IDS) || !same(v.retainedObjectIds, ['BR4-CARRIER-1', 'BR4-TAG-1'])) return false;
    if (!Array.isArray(v.milestones) || v.milestones.length > (v.mode === 'THREE_CENTURIES' ? 2 : 1)) return false;
    for (const [j, m] of v.milestones.entries()) {
      const expected = v.mode === 'THREE_CENTURIES' ? addGameYears(v.enteredDate, (j + 1) * 150) : v.targetDate;
      if (!record(m) || !shape(m, ['id', 'date', 'elapsedDays', 'bodyId', 'facilityId', 'communication']) || m.id !== `${v.id}:LOCAL-${j + 1}` || !same(m.date, expected) || m.elapsedDays !== gameDaysBetween(v.enteredDate, expected) || m.bodyId !== v.bodyId || m.facilityId !== v.facilityId || m.communication !== 'NONE') return false;
    }
    const full = v.milestones.length === (v.mode === 'THREE_CENTURIES' ? 2 : 1);
    if (full !== (v.qualifiedDate !== null) || v.qualifiedDate !== null && !same(v.qualifiedDate, v.targetDate)) return false;
    if (v.verifiedDate !== null && (!full || compareGameDates(v.verifiedDate, v.targetDate) < 0)) return false;
    const latest = v.exitedDate ?? s.date;
    if (v.elapsedDays !== gameDaysBetween(v.enteredDate, latest) || v.elapsedDays < 0 || v.exitedDate === null && (i !== r.visits.length - 1 || r.location !== 'VAULT')) return false;
    if (v.result === 'EARLY_EXIT' && (full || v.exitedDate === null || !v.milestones.length)) return false;
    if (v.mode === 'G_REASSESSMENT' && !r.visits.slice(0, i).some(old => old.id === v.reassessedVisitId && old.mode === 'THREE_CENTURIES' && old.qualifiedDate !== null)) return false;
    if (v.mode === 'THREE_CENTURIES' && v.reassessedVisitId !== null) return false;
    if (i && (r.visits[i - 1]!.exitedDate === null || compareGameDates(v.enteredDate, r.visits[i - 1]!.exitedDate!) < 0)) return false;
  }
  if (r.visits.length === 0 ? r.currentVisitId !== null : r.currentVisitId !== r.visits.at(-1)!.id) return false;
  if (r.completed300VisitId !== null && !r.visits.some(v => v.id === r.completed300VisitId && v.mode === 'THREE_CENTURIES' && v.qualifiedDate !== null)) return false;
  if (r.reassessedVisitId !== null && r.reassessedVisitId !== r.completed300VisitId) return false;
  if (r.eraClosedDate !== null) {
    if (!r.visits.length || !same(r.eraClosedDate, r.visits[0]!.enteredDate) || !r.visits.some(v => v.milestones.length > 0)) return false;
    const days = gameDaysBetween(ORIGIN, s.date); if (s.week !== Math.floor(days / 7) + 1 || r.calendarRemainderDays !== days % 7) return false;
  } else if (r.visits.some(v => v.milestones.length > 0)) return false;
  if (r.location === 'VAULT') { const v = currentAncientScholarVisit(s); if (!v || v.exitedDate !== null || !['SEALED', 'QUALIFIED'].includes(r.phase) || r.records.some(a => a.originalLocation !== 'VAULT' || !a.verifiedDate) || s.actionsRemaining !== 0) return false; }
  else if (['SEALED', 'QUALIFIED'].includes(r.phase) || r.records.some(a => a.originalLocation === 'VAULT')) return false;
  if (!record(r.newLife) || !shape(r.newLife, Object.keys(base.newLife)) || !['works', 'rests', 'weeks', 'income', 'expenses'].every(k => integer(r.newLife[k as 'works'])) || typeof r.newLife.emergencyWorkUsed !== 'boolean' || r.newLife.income !== r.newLife.works * PRICE.work || r.newLife.expenses !== r.newLife.rests * PRICE.rest + r.newLife.weeks * PRICE.weekly || r.newLife.week !== null && !integer(r.newLife.week, 1, s.week)) return false;
  if (!Array.isArray(r.people) || !Array.isArray(r.objects) || new Set(r.objects.map(o => o.id)).size !== r.objects.length) return false;
  if (r.people.some(p => !record(p) || typeof p.id !== 'string' || !isValidGameDate(p.date) || !validDate(p.date) || !['DEATH', 'UNKNOWN', 'AGREEMENT_ENDED'].includes(p.kind) || typeof p.text !== 'string')) return false;
  if (r.objects.some(o => !record(o) || typeof o.id !== 'string' || typeof o.source !== 'string' || typeof o.text !== 'string' || !['PRESERVED', 'EXPIRED', 'HISTORICAL_ONLY'].includes(o.disposition))) return false;
  return true;
}

export const applyAncientScholarRitualCommand = applyAncientScholarRitual;
