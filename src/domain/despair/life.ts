import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { stableStringify } from '../canonical.js';
import type { DespairAbilityId } from './types.js';

export const DESPAIR_CASE_IDS = ['room-clearance', 'stop-and-check', 'care-followup'] as const;
export type DespairCaseId = typeof DESPAIR_CASE_IDS[number];
export type DespairActivityCommand =
  | { type: 'OBSERVE' | 'CLOSE' | 'REPORT' | 'WITHDRAW'; caseId: DespairCaseId }
  | { type: 'PREPARE'; caseId: DespairCaseId; method: 'ORDINARY' }
  | { type: 'PERFORM'; caseId: 'room-clearance' | 'care-followup' }
  | { type: 'PERFORM'; caseId: 'stop-and-check'; plan: 'PAUSE_EXPOSURE' | 'DECLARE_ALL_CURED' }
  | { type: 'WALK_OUT'; caseId: 'room-clearance' }
  | { type: 'RETURN_ROUTE' | 'FOLLOW_UP'; caseId: 'care-followup' }
  | { type: 'REFLECT' };
export interface DespairCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'WAITING' | 'EXAMINED' | 'RESOLVED';
  method: 'ORDINARY' | null; attemptWeek: number | null;
  preparations: number; attempts: number; withdrawals: number; closes: number;
  contactOpen: boolean; taskComplete: boolean; lastOutcome: 'NONE' | 'SUCCESS' | 'ERROR' | 'WITHDRAWN';
}
interface Walker { location: 'INNER_MARK' | 'OUTER_MARK'; walks: number; distanceMetres: number }
interface RecordSlip { id: string; written: boolean; location: 'TABLETOP' | 'SUPPLY' | 'TRAY' | 'FOLDER' }
export interface DespairLifeState {
  cases: Record<DespairCaseId, DespairCaseState>; reflected: boolean;
  room: {
    cartId: 'DP4-CART-1'; cartLocation: 'BLOCKED_CORRIDOR'; boardId: 'DP4-BOARD-1'; boardLocation: 'RACK' | 'CLEAR_EXIT';
    consented: boolean; raviney: Walker; mara: Walker; evacuations: number;
  };
  scenario: {
    overlayId: 'DP4-OVERLAY-1'; overlayLocation: 'STORAGE' | 'TABLETOP';
    cardIds: ['DP4-CARD-1', 'DP4-CARD-2', 'DP4-CARD-3']; cardsLocation: 'STORAGE' | 'TABLETOP';
    paperBatches: { id: number; paidWeek: number; slips: [RecordSlip, RecordSlip, RecordSlip] }[];
    currentBatchId: number | null; recordSlipId: string | null; errors: number;
  };
  care: {
    folderId: 'DP4-FOLDER-1'; folderLocation: 'RACK' | 'PLAYER'; recordSlipId: string | null;
    contactId: 'DP4-CARE-CONTACT-1'; consented: boolean; handovers: number; returns: number;
    deliveredWeek: number | null; followUpDueWeek: number | null; followUpWeek: number | null;
    expected: 'NO_AUTOMATIC_CURE'; observed: 'NOT_CHECKED' | 'FICTIONAL_SYMPTOMS_REMAIN';
  };
  player: { location: 'INNER_MARK' | 'OUTER_MARK' | 'CARE_DOORWAY'; roomWalks: number; careWalks: number; distanceMetres: number };
}
export interface DespairLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: DespairActivityCommand }
export interface DespairLifeProjection {
  cases: { id: DespairCaseId; title: string; story: string; observations: string[]; preparation: string | null; result: string | null; status: string; contactOpen: string; closes: number }[];
  insideCase: boolean; environment: string;
  practice: { room: string; scenario: string; care: string; route: string; cost: string; history: string[] } | null;
}
const CASES = [
  { id: 'room-clearance', title: '原附室的两条出口', story: '成年拉维妮与成年仓管玛拉·维尔自愿参加普通撤离演练。原附室一条走廊被空推车DP4-CART-1堵住；另一条原净空路线从INNER_MARK通向四米外OUTER_MARK。两位本人没有真实疾病。（原创G）', facts: ['只能走实际净空四米路线，堵塞走廊不可通行；原空推车不会被剧情移走。', '玛拉沿净空路线往返八米，把原出口架上的DP4-BOARD-1摆在同一出口；你仍在INNER_MARK。', '实施时两位自愿成年人先普通步行四米撤出，你仍在INNER_MARK，须另选0行动“实际走出四米”才到OUTER_MARK。', '原牌归回外侧出口架且三人确实都在OUTER_MARK后才能报告；撤回演练不会奖励完成。'] },
  { id: 'stop-and-check', title: '停止暴露与仍需复查的纸面记录', story: '外侧标线旁的普通桌上只有原纸覆盖层DP4-OVERLAY-1与三张编号情境卡：1仍有虚构暴露、2源已停止但已有虚构症状、3从未暴露。这些纸面示例完全不是活体疾病。（原创G）', facts: ['准备实际支付40便士买三张独立编号空白记录纸，不是试剂、药物或疾病材料。', '请选择“暂停模拟暴露，保留症状复查”；停源不等于清除既有病例，离场或纸人替身也不抹去既有感染。', '选择“宣布全部痊愈”只消耗1行动并记下解释错误，不伤害任何人、不增加扮演或能力掌握。还须另一个真实命令纠正。', '正确实施将同一原覆盖纸收存，实际写好一张记录；0行动清桌把三原卡归存、余纸收好，原记录留在外侧收件盘。'] },
  { id: 'care-followup', title: '同一原文件夹的真实下周回访', story: '拉维妮再次明确同意普通照护交接排练。把上一案已经写好的同一张原记录放入DP4-FOLDER-1，沿外侧标线至附近门口的三米原路交给成年照护联络员伊迪丝·罗恩。她核对并交回同一文件夹，约定下一真实周复查虚构状态。（原创G）', facts: ['本人没有患病，交接不是治疗，也不能用普通演练冒领瘟疫掌握。', '实施实际步行三米到门口，原联络员接收并交回原文件夹；你仍在门口，必须另选0行动原路返回。', '返回再收束后文件夹在原架，等待安全关闭，不锁住休养与真实跨周。下一真实周起才能花1行动实际回访。', '回访再走三米，核对新一周虚构卡仍有症状与“不能自动宣称治愈”的预期，写回同一原记录；原路返回并收束后才可报告。'] },
] as const;
export const DESPAIR_LIFE_ENVIRONMENT = '三项原创G有限普通应急演练；观察、准备、实施、报告各1行动，每项报告扮演25，三项反思另1行动、扮演25。第二案准备40便士买三张真实空白纸；第三案还须下一真实周回访1行动。原路步行、清桌与收束0行动、0灵性。原成年人全程自愿、未患病；只有纸面虚构症状，没有真实病原、实际施加瘟疫、治疗或能力掌握奖励。安全收束后的等待允许正常休养跨周；没有神话形态展示、不老魔女返老还童或镜中世界逃脱。';
const emptyCase = (): DespairCaseState => ({ status: 'AVAILABLE', method: null, attemptWeek: null, preparations: 0, attempts: 0, withdrawals: 0, closes: 0, contactOpen: false, taskComplete: false, lastOutcome: 'NONE' });
const walker = (): Walker => ({ location: 'INNER_MARK', walks: 0, distanceMetres: 0 });
export function createDespairLifeState(): DespairLifeState {
  return {
    cases: { 'room-clearance': emptyCase(), 'stop-and-check': emptyCase(), 'care-followup': emptyCase() }, reflected: false,
    room: { cartId: 'DP4-CART-1', cartLocation: 'BLOCKED_CORRIDOR', boardId: 'DP4-BOARD-1', boardLocation: 'RACK', consented: false, raviney: walker(), mara: walker(), evacuations: 0 },
    scenario: { overlayId: 'DP4-OVERLAY-1', overlayLocation: 'STORAGE', cardIds: ['DP4-CARD-1', 'DP4-CARD-2', 'DP4-CARD-3'], cardsLocation: 'STORAGE', paperBatches: [], currentBatchId: null, recordSlipId: null, errors: 0 },
    care: { folderId: 'DP4-FOLDER-1', folderLocation: 'RACK', recordSlipId: null, contactId: 'DP4-CARE-CONTACT-1', consented: false, handovers: 0, returns: 0, deliveredWeek: null, followUpDueWeek: null, followUpWeek: null, expected: 'NO_AUTOMATIC_CURE', observed: 'NOT_CHECKED' },
    player: { location: 'INNER_MARK', roomWalks: 0, careWalks: 0, distanceMetres: 0 },
  };
}
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const shape = (x: Record<string, unknown>, keys: readonly string[]) => Object.keys(x).length === keys.length && keys.every(k => Object.hasOwn(x, k));
const integer = (x: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): x is number => Number.isSafeInteger(x) && (x as number) >= min && (x as number) <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'demoness' && [4,3,2].includes(s.progression.sequence!);
const sourceFor = (id: DespairCaseId) => `despair-case:${id}`;
const allSlips = (l: DespairLifeState) => l.scenario.paperBatches.flatMap(b => b.slips);
const caseById = (id: DespairCaseId) => CASES.find(c => c.id === id)!;
export function validateDespairActivityCommand(c: unknown): c is DespairActivityCommand {
  if (!record(c)) return false;
  if (c.type === 'REFLECT') return shape(c, ['type']);
  if (!DESPAIR_CASE_IDS.includes(c.caseId as DespairCaseId)) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && c.method === 'ORDINARY';
  if (c.type === 'PERFORM' && c.caseId === 'stop-and-check') return shape(c, ['type', 'caseId', 'plan']) && ['PAUSE_EXPOSURE', 'DECLARE_ALL_CURED'].includes(c.plan as string);
  if (!shape(c, ['type', 'caseId'])) return false;
  if (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string)) return true;
  if (c.type === 'WALK_OUT') return c.caseId === 'room-clearance';
  return ['RETURN_ROUTE', 'FOLLOW_UP'].includes(c.type as string) && c.caseId === 'care-followup';
}
export function hasDespairLifeLock(s: SliceState): boolean {
  return Object.values(s.despair.life.cases).some(r => r.contactOpen) || s.despair.life.player.location === 'CARE_DOORWAY';
}
export function despairActivityReason(s: SliceState, c: DespairActivityCommand): string | null {
  if (!validateDespairActivityCommand(c)) return '绝望魔女演练命令无效；堵塞路线不能行走，也不开放对志愿者施加疾病。';
  if (!promoted(s)||s.progression.sequence!==4) return '此处保留原绝望魔女实践，当前阶段不重新开启。';
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要回到贝克兰德原附室与外侧照护联络门口。';
  const l = s.despair.life, r = 'caseId' in c ? l.cases[c.caseId] : null;
  if (c.type === 'WALK_OUT') return r?.contactOpen && l.player.location === 'INNER_MARK' ? null : '只有本次撤离仍在INNER_MARK时才能沿原净空路线走出四米。';
  if (c.type === 'RETURN_ROUTE') return r?.contactOpen && l.player.location === 'CARE_DOORWAY' ? null : '你目前不在三米外原照护门口。';
  if (c.type === 'CLOSE') {
    if (!r?.contactOpen) return '没有尚未收束的本次演练。';
    if (c.caseId === 'room-clearance' && (l.player.location !== 'OUTER_MARK' || l.room.raviney.location !== 'OUTER_MARK' || l.room.mara.location !== 'OUTER_MARK')) return '先让原参与者走出，并另选实际走出四米；不能用收束瞬移。';
    return c.caseId === 'care-followup' && l.player.location !== 'OUTER_MARK' ? '先沿原三米路线实际返回，再收束文件夹。' : null;
  }
  if (c.type === 'WITHDRAW') return r && (r.status === 'PREPARED' || r.contactOpen) && !r.taskComplete ? null : '只有尚未完成的准备或开放演练可撤回；已经完成的动作请实际收束。';
  if (hasDespairLifeLock(s) && !(c.type === 'PERFORM' && c.caseId === 'stop-and-check' && r?.status === 'ACTIVE' && !r.taskComplete)) return '先0行动完成实际步行与现场收束；错误纸面判断可用另一个实施命令纠正。';
  if (Object.entries(l.cases).some(([id, other]) => other.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先完成或取消另一项已备好的普通演练。';
  if (s.health <= 0 || s.mind <= 0) return '先休养恢复身体与精神。';
  if (s.actionsRemaining < 1) return '需要1行动；可0行动实际收束，安全后正常休养跨周。';
  if (c.type === 'REFLECT') return l.reflected ? '已经完成反思。' : DESPAIR_CASE_IDS.some(id => l.cases[id].status !== 'RESOLVED') ? '先完成三项原现场报告。' : null;
  if (!r || r.status === 'RESOLVED') return '这项有限报告已经完成。';
  const index = DESPAIR_CASE_IDS.indexOf(c.caseId);
  if (index > 0 && l.cases[DESPAIR_CASE_IDS[index - 1]!].status !== 'RESOLVED') return '先完成上一项真实报告，再承接这一项。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '已经核对这次同意、原人和原物。';
  if (c.type === 'REPORT') return r.status === 'EXAMINED' && r.taskComplete && !r.contactOpen ? null : '先完成真实动作、必要回访与原位置收束，再报告。';
  if (c.type === 'FOLLOW_UP') return r.status !== 'WAITING' || l.care.followUpDueWeek === null ? '先实际交接并返回收束，取得下一真实周约定。' : s.week < l.care.followUpDueWeek ? `须等到第${l.care.followUpDueWeek}真实周；当前已安全关闭，可以正常休养。` : null;
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察本次原现场。' : c.caseId === 'stop-and-check' && s.cash < 40 ? '三张真实空白记录纸需要40便士，不是医药试剂。' : null;
  if (c.type !== 'PERFORM' || !(r.status === 'PREPARED' || c.caseId === 'stop-and-check' && r.status === 'ACTIVE' && !r.taskComplete)) return '先准备本次普通方法。';
  return null;
}
function walkAdult(w: Walker, destination: Walker['location']) {
  if (w.location !== destination) { w.location = destination; w.walks += 1; w.distanceMetres += 4; }
}
function walkPlayer(l: DespairLifeState, destination: DespairLifeState['player']['location'], metres: 3 | 4) {
  if (l.player.location !== destination) { l.player.location = destination; l.player.distanceMetres += metres; if (metres === 4) l.player.roomWalks += 1; else l.player.careWalks += 1; }
}
function storeTable(l: DespairLifeState) {
  l.scenario.overlayLocation = 'STORAGE'; l.scenario.cardsLocation = 'STORAGE'; l.scenario.currentBatchId = null;
  allSlips(l).forEach(slip => { if (slip.location === 'TABLETOP') slip.location = slip.written ? 'TRAY' : 'SUPPLY'; });
}
function returnBoard(l: DespairLifeState) {
  if (l.room.boardLocation === 'CLEAR_EXIT' && l.room.mara.location === 'INNER_MARK') { walkAdult(l.room.mara, 'OUTER_MARK'); walkAdult(l.room.mara, 'INNER_MARK'); }
  l.room.boardLocation = 'RACK';
}
export function applyDespairActivity(s: SliceState, c: DespairActivityCommand, ctx: SeerContext, _award: (id: DespairAbilityId, amount?: number) => void): void {
  const reason = despairActivityReason(s, c); if (reason) throw new Error(reason);
  const l = s.despair.life;
  if (c.type === 'REFLECT') {
    s.actionsRemaining -= 1; l.reflected = true; s.seer.completedSources.push('despair-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('停止新增暴露之后还要做什么', '回看原出口、同一已写纸和下一真实周的实际回访。三位原成年人没有患病；停止源、离开范围和纸人替身不自动治愈已有感染，友军没有天然免疫。普通演练G扮演+25，没有瘟疫能力掌握或神话形态。'); return;
  }
  const r = l.cases[c.caseId], spec = caseById(c.caseId);
  if (c.type === 'WALK_OUT') {
    walkPlayer(l, 'OUTER_MARK', 4); r.taskComplete = true; r.lastOutcome = 'SUCCESS';
    ctx.note('你实际沿原净空四米路线走出', '你从INNER_MARK普通步行四米到OUTER_MARK。拉维妮与玛拉先前已经走出，你现在才与她们会合；没有瞬移、施加疾病或治愈。原牌仍在出口，须实际归架。'); return;
  }
  if (c.type === 'RETURN_ROUTE') {
    walkPlayer(l, 'OUTER_MARK', 3);
    ctx.note('把同一文件夹沿原三米路线带回', '你带着联络员已经交回的DP4-FOLDER-1，普通步行三米回到OUTER_MARK；原记录与文字保留。文件夹仍在手里，另选收束将它放回原架。'); return;
  }
  if (c.type === 'WITHDRAW') {
    if (c.caseId === 'room-clearance') {
      if (r.contactOpen) { walkAdult(l.room.raviney, 'OUTER_MARK'); walkAdult(l.room.mara, 'OUTER_MARK'); walkPlayer(l, 'OUTER_MARK', 4); }
      returnBoard(l);
    } else if (c.caseId === 'stop-and-check') storeTable(l);
    else { if (l.player.location === 'CARE_DOORWAY') walkPlayer(l, 'OUTER_MARK', 3); l.care.folderLocation = 'RACK'; }
    if (r.contactOpen) r.closes += 1;
    r.contactOpen = false; r.withdrawals += 1; r.taskComplete = false;
    r.status = c.caseId === 'care-followup' && l.care.deliveredWeek !== null ? 'WAITING' : 'OBSERVED';
    r.method = r.status === 'WAITING' ? 'ORDINARY' : null; r.lastOutcome = 'WITHDRAWN';
    ctx.note('实际撤回并收好原物', '0行动沿原净空路线实际退出开放现场，原牌归原架、原桌纸张归存或原文件夹带回原架；已走距离、已付纸费与错误记录保留。没有完成奖励。已实际约定的下周回访保留，等待不锁住正常休养。'); return;
  }
  if (c.type === 'CLOSE') {
    if (c.caseId === 'room-clearance') returnBoard(l);
    else if (c.caseId === 'stop-and-check') storeTable(l);
    else l.care.folderLocation = 'RACK';
    r.contactOpen = false; r.closes += 1;
    r.status = r.taskComplete ? 'EXAMINED' : c.caseId === 'care-followup' ? 'WAITING' : 'OBSERVED';
    if (r.status === 'OBSERVED') r.method = null;
    ctx.note('原现场实际收束', c.caseId === 'room-clearance' ? '三人实际都在OUTER_MARK；同一DP4-BOARD-1从出口展示位放回旁边原架，堵塞走廊的原空推车仍在原处。' : c.caseId === 'stop-and-check' ? '同一原覆盖纸与三张原卡已收存，剩余空白纸放回用品架；若已写记录，同一原纸放在收件盘，既有文字与解释错误不清零。' : `你确已回到OUTER_MARK，同一DP4-FOLDER-1放回原架。${r.taskComplete ? '下一真实周的实际核对已写入同一原纸，可以报告。' : `下一真实周第${l.care.followUpDueWeek}周起再回访；当前安全等待，可以正常休养推进周，不锁住行动。`}`); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; if (c.caseId === 'room-clearance') l.room.consented = true; if (c.caseId === 'care-followup') l.care.consented = true; ctx.note(spec.title, spec.story + ' ' + spec.facts.join(' ')); return; }
  if (c.type === 'PREPARE') {
    r.status = 'PREPARED'; r.method = 'ORDINARY'; r.preparations += 1; r.taskComplete = false;
    if (c.caseId === 'room-clearance') {
      walkPlayer(l, 'INNER_MARK', 4); walkAdult(l.room.raviney, 'INNER_MARK'); walkAdult(l.room.mara, 'INNER_MARK');
      walkAdult(l.room.mara, 'OUTER_MARK'); l.room.boardLocation = 'CLEAR_EXIT'; walkAdult(l.room.mara, 'INNER_MARK');
      ctx.note(spec.title, '玛拉实际沿原净空四米路线走到出口，把原架的DP4-BOARD-1摆到旁边真实出口，再走四米回来，共八米；你与拉维妮仍在INNER_MARK。若是重新演练，三人先按原路实际返回附室。准备是安全布置，可以先休养再实施。');
    } else if (c.caseId === 'stop-and-check') {
      s.cash -= 40; const id = l.scenario.paperBatches.length + 1;
      const slips = [1, 2, 3].map(n => ({ id: `DP4-SLIP-${id}-${n}`, written: false, location: 'TABLETOP' as const })) as [RecordSlip, RecordSlip, RecordSlip];
      l.scenario.paperBatches.push({ id, paidWeek: s.week, slips }); l.scenario.currentBatchId = id; l.scenario.overlayLocation = 'TABLETOP'; l.scenario.cardsLocation = 'TABLETOP';
      ctx.note(spec.title, `实际支付40便士，收到并在外侧桌上摆好${slips.map(x => x.id).join('、')}三张空白原纸，同一覆盖纸与三张情境卡也实际摆上桌。纯纸面准备可以安全跨周；没有药物或真实暴露。`);
    } else {
      const slip = allSlips(l).find(x => x.id === l.scenario.recordSlipId)!; slip.location = 'FOLDER'; l.care.recordSlipId = slip.id; l.care.folderLocation = 'PLAYER';
      ctx.note(spec.title, `把上一案已写的同一${slip.id}放入原DP4-FOLDER-1，再拿起文件夹；原记录不复制。拉维妮明确同意普通交接，仍未患病。你尚在OUTER_MARK，附近原门口距离三米。`);
    }
    return;
  }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.seer.completedSources.push(sourceFor(c.caseId)); s.progression.acting = Math.min(100, s.progression.acting + 25);
    const actual = c.caseId === 'room-clearance' ? `你实际在${l.player.location}，累计本案步行${l.player.roomWalks * 4}米；拉维妮在${l.room.raviney.location}走过${l.room.raviney.distanceMetres}米，玛拉在${l.room.mara.location}走过${l.room.mara.distanceMetres}米；原牌已归架，原空推车仍堵走廊。` : c.caseId === 'stop-and-check' ? `同一${l.scenario.recordSlipId}记录了停止新增暴露但虚构症状仍需后续核对；三张卡与覆盖纸已收存，错误${l.scenario.errors}次仍保留。` : `同一${l.care.recordSlipId}始终在原文件夹中；第${l.care.deliveredWeek}周交接，第${l.care.followUpWeek}真实周回访，累计往返${l.player.careWalks * 3}米，你和文件夹已回到外侧标线与原架。新虚构状态仍有症状，与不能自动宣布治愈的预期分别记录。`;
    ctx.note(spec.title, actual + ' 普通演练G扮演+25；没有真实感染、健康变化或瘟疫能力掌握。'); return;
  }
  if (c.type === 'FOLLOW_UP') {
    walkPlayer(l, 'CARE_DOORWAY', 3); l.care.folderLocation = 'PLAYER'; l.care.handovers += 1; l.care.returns += 1; l.care.followUpWeek = s.week; l.care.observed = 'FICTIONAL_SYMPTOMS_REMAIN';
    r.contactOpen = true; r.taskComplete = true; r.status = 'ACTIVE'; r.lastOutcome = 'SUCCESS';
    ctx.note(spec.title, `第${s.week}真实周，你从原架拿同一文件夹，沿原路实际走三米到门口；同一成年联络员核对后交回原夹。原纸新增本周虚构状态“仍有症状”，与原预期“停源不自动治愈”分开核对；拉维妮本人没有疾病。你仍在门口，另选原路返回、收束后报告。`); return;
  }
  r.attemptWeek = s.week; r.attempts += 1; r.contactOpen = true; r.status = 'ACTIVE';
  if (c.caseId === 'room-clearance') {
    walkAdult(l.room.raviney, 'OUTER_MARK'); walkAdult(l.room.mara, 'OUTER_MARK'); l.room.evacuations += 1;
    ctx.note(spec.title, '两位本人依照本次明确同意，各自沿实际净空四米路线走到OUTER_MARK。你仍在INNER_MARK，不能靠收束或报告瞬移；下一步0行动实际走出四米。堵塞走廊不可用，没有人被施加疾病。');
  } else if (c.caseId === 'stop-and-check') {
    if (c.type === 'PERFORM' && c.plan === 'DECLARE_ALL_CURED') {
      l.scenario.errors += 1; r.lastOutcome = 'ERROR';
      ctx.note('纸面判断需要纠正', '本次“全部痊愈”解释错误：卡1仍有暴露，卡2已经停源但已有虚构症状，卡3没有暴露不能混作治愈。实际消耗1行动并保留错误，没有任何真人患病、受伤或获得能力奖励。用另一个实施命令选择暂停暴露并保留复查；行动耗尽时可0行动清桌，下周再准备。'); return;
    }
    const slip = l.scenario.paperBatches[l.scenario.currentBatchId! - 1]!.slips[0]; slip.written = true; l.scenario.recordSlipId = slip.id; l.scenario.overlayLocation = 'STORAGE'; r.taskComplete = true; r.lastOutcome = 'SUCCESS';
    ctx.note(spec.title, `你把同一DP4-OVERLAY-1从桌面实际移入储物格，在本批原纸${slip.id}写下“停止新增暴露，已出现的虚构症状仍需下周复查；未暴露者单列”。只写了一张真实记录；其余两张仍空白，三原卡尚在桌面，须0行动实际清桌。`);
  } else {
    walkPlayer(l, 'CARE_DOORWAY', 3); l.care.handovers += 1; l.care.returns += 1; l.care.deliveredWeek = s.week; l.care.followUpDueWeek = s.week + 1; r.status = 'WAITING';
    ctx.note(spec.title, `你携原DP4-FOLDER-1沿净空原路实际走三米到门口，成年伊迪丝·罗恩实际接收、核对并交回同一文件夹。约定第${s.week + 1}真实周起回访虚构状态；你仍在CARE_DOORWAY。先0行动返回、收束，再正常休养跨周。没有治愈承诺或能力掌握。`);
  }
}

export function despairLifeActions(s: SliceState): DespairLifeAction[] {
  if (!promoted(s)) return [];
  const l = s.despair.life, actions: DespairLifeAction[] = [];
  const add = (id: string, label: string, cost: string, command: DespairActivityCommand) => { const reason = despairActivityReason(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const spec of CASES) {
    const id = spec.id, r = l.cases[id];
    if (r.status === 'AVAILABLE') add(`${id}-observe`, '观察原现场与这次同意', '1行动', { type: 'OBSERVE', caseId: id });
    if (r.status === 'OBSERVED' && !r.contactOpen) add(`${id}-ordinary`, id === 'room-clearance' ? '请玛拉实际摆放原出口牌' : id === 'stop-and-check' ? '购买三张原空白纸并摆好情境卡' : '将上一案原记录放入原文件夹', `1行动 · ${id === 'stop-and-check' ? '40便士 · 三张原纸' : '0便士'} · 普通方法`, { type: 'PREPARE', caseId: id, method: 'ORDINARY' });
    if (r.status === 'PREPARED' || id === 'stop-and-check' && r.status === 'ACTIVE' && !r.taskComplete) {
      if (id === 'stop-and-check') {
        add(`${id}-pause`, '暂停模拟暴露，保留症状复查', '1行动 · 收起原覆盖纸 · 写一张原记录', { type: 'PERFORM', caseId: id, plan: 'PAUSE_EXPOSURE' });
        add(`${id}-cured`, '宣布所有情境都已痊愈', '1行动 · 解释错误会记录且需另行纠正', { type: 'PERFORM', caseId: id, plan: 'DECLARE_ALL_CURED' });
      } else add(`${id}-perform`, id === 'room-clearance' ? '请两位本人沿净空四米路线撤出' : '携原文件夹实际走三米交接', '1行动 · 0灵性 · 普通步行', { type: 'PERFORM', caseId: id });
    }
    if ((r.status === 'PREPARED' || r.contactOpen) && !r.taskComplete) add(`${id}-withdraw`, '撤回本次演练并实际收好原物', '0行动 · 按原路退出 · 无完成奖励', { type: 'WITHDRAW', caseId: id });
    if (r.contactOpen) {
      if (id === 'room-clearance' && l.player.location === 'INNER_MARK') add(`${id}-walk-out`, '自己沿原净空路线实际走出四米', '0行动 · 4米 · INNER_MARK → OUTER_MARK', { type: 'WALK_OUT', caseId: id });
      if (id === 'care-followup' && l.player.location === 'CARE_DOORWAY') add(`${id}-return`, '携原文件夹沿原三米路线返回', '0行动 · 3米 · 回到OUTER_MARK', { type: 'RETURN_ROUTE', caseId: id });
      add(`${id}-close`, id === 'room-clearance' ? '确认全员在外并将原出口牌归架' : id === 'stop-and-check' ? '实际清桌并收好原卡与纸张' : '将原文件夹归架并安全收束', '0行动 · 0灵性 · 保留实际记录', { type: 'CLOSE', caseId: id });
    }
    if (r.status === 'WAITING' && !r.contactOpen) add(`${id}-follow-up`, '到原门口实际回访并核对虚构状态', `1行动 · 第${l.care.followUpDueWeek}真实周起 · 3米去程`, { type: 'FOLLOW_UP', caseId: 'care-followup' });
    if (r.status === 'EXAMINED') add(`${id}-report`, '报告实际位置、原物与有限结果', '1行动 · G扮演+25 · 不增能力掌握', { type: 'REPORT', caseId: id });
  }
  if (!l.reflected) add('despair-reflect', '反思停止新增暴露与既有后果的区别', '1行动 · 三项报告后 · G扮演+25', { type: 'REFLECT' });
  return actions;
}
export function projectDespairLife(s: SliceState): DespairLifeProjection {
  if (!promoted(s)) return { cases: [], insideCase: false, environment: '', practice: null };
  const l = s.despair.life, x = l.scenario, f = l.care;
  return {
    insideCase: hasDespairLifeLock(s), environment: DESPAIR_LIFE_ENVIRONMENT,
    cases: CASES.map(spec => { const r = l.cases[spec.id]; return {
      id: spec.id, title: spec.title, story: spec.story, observations: r.status === 'AVAILABLE' ? [] : [...spec.facts], status: r.status, closes: r.closes,
      preparation: r.status === 'PREPARED' ? spec.id === 'stop-and-check' ? '本批三张原纸已支付40便士；下一步选暂停模拟暴露并保留症状复查。' : spec.id === 'care-followup' ? '同一已写原记录在原文件夹，你尚在OUTER_MARK；下一步实际走三米交接。' : '同一原牌已在真实净空出口；下一步请两位本人普通步行四米撤出，你仍须另行走出。' : null,
      result: r.attemptWeek === null ? r.withdrawals ? '准备已实际撤回，费用与原物历史保留。' : null : `第${r.attemptWeek}周实际实施${r.attempts}次；${r.status === 'WAITING' ? `等第${f.followUpDueWeek}真实周回访，安全关闭后可正常休养` : r.taskComplete ? '真实有限动作已完成，仍须收束并报告' : '尚无完整可报告结果'}。收束${r.closes}次，撤回${r.withdrawals}次。`,
      contactOpen: r.contactOpen ? '原现场开放；先完成0行动步行与收束' : r.status === 'WAITING' ? '安全关闭等待，不锁住正常休养与跨周' : '没有尚未收束的接触',
    }; }),
    practice: {
      room: `同一${l.room.cartId}仍在BLOCKED_CORRIDOR，堵塞路线不可通行；唯一${l.room.boardId}${l.room.boardLocation === 'RACK' ? '在外侧出口原架' : '在真实净空出口展示位'}。成年拉维妮实际在${l.room.raviney.location}，走过${l.room.raviney.distanceMetres}米；成年玛拉·维尔在${l.room.mara.location}，走过${l.room.mara.distanceMetres}米；${l.room.consented ? '已明确同意这次普通演练' : '本次同意尚未核对'}，两人都没有患病。`,
      scenario: `原覆盖纸${x.overlayId}${x.overlayLocation === 'STORAGE' ? '已收存' : '仍在桌面'}；三原卡${x.cardIds.join('/')}依次表示仍有暴露、源已停但已有症状、未暴露，${x.cardsLocation === 'STORAGE' ? '已归存' : '仍在桌面'}。仅有纸面虚构情境。${x.recordSlipId ? `唯一已写原记录${x.recordSlipId}：停止新增暴露，既有虚构症状仍需复查。` : '尚未写好原记录。'}实际错误判断${x.errors}次。`,
      care: `同一${f.folderId}${f.folderLocation === 'RACK' ? '在原架' : '在你手里'}，${f.recordSlipId ? `装着上一案同一${f.recordSlipId}` : '尚未装入上一案原记录'}。原成年联络员伊迪丝·罗恩(${f.contactId})始终在附近原门口，实际接收并交回${f.handovers}/${f.returns}次。${f.deliveredWeek === null ? '尚未交接。' : `第${f.deliveredWeek}周交接，约定第${f.followUpDueWeek}真实周起回访。`}${f.followUpWeek === null ? '尚无下周核对；不能宣称痊愈。' : `第${f.followUpWeek}周实际回访：预期为停源不自动治愈，新虚构状态仍有症状，已写回同一原纸。`}拉维妮未患病，没有真实治疗。`,
      route: `你实际在${l.player.location}；原附室净空路线4米，外侧标线至照护门口3米。累计实际步行${l.player.distanceMetres}米（四米单程${l.player.roomWalks}次、三米单程${l.player.careWalks}次）。场景收束不瞬移。`,
      cost: `已实际支付${x.paperBatches.length * 40}便士，收到${x.paperBatches.length * 3}张原空白纸；目前写好${allSlips(l).filter(p => p.written).length}张，余纸与费用不凭空消失。全部普通行动0灵性、0能力掌握。`,
      history: [`实际完整报告${DESPAIR_CASE_IDS.filter(id => l.cases[id].status === 'RESOLVED').length}/3，反思${l.reflected ? '已完成' : '未完成'}；有限总扮演100，不可重复领取。`, '同一拉维妮、玛拉与伊迪丝是原创成年人物；虚构卡的症状与真人健康严格分开。', '停源或退出范围不抹去既有感染；没有友军天然免疫、实际神话形态或序列3能力。'],
    },
  };
}

/** Validates original identities, real movement, finite paper and cross-week closure. */
export function validateDespairLife(s: SliceState): boolean {
  try {
    const l = s.despair.life, start = s.despair.promotionWeek ?? s.week;
    if (!record(l) || !shape(l, ['cases', 'reflected', 'room', 'scenario', 'care', 'player']) || !record(l.cases) || !shape(l.cases, DESPAIR_CASE_IDS) || typeof l.reflected !== 'boolean') return false;
    if (s.despair.promotionWeek === null) return stableStringify(l) === stableStringify(createDespairLifeState());
    const rm = l.room, x = l.scenario, f = l.care, p = l.player;
    if (!record(rm) || !shape(rm, ['cartId', 'cartLocation', 'boardId', 'boardLocation', 'consented', 'raviney', 'mara', 'evacuations']) || rm.cartId !== 'DP4-CART-1' || rm.cartLocation !== 'BLOCKED_CORRIDOR' || rm.boardId !== 'DP4-BOARD-1' || !['RACK', 'CLEAR_EXIT'].includes(rm.boardLocation) || typeof rm.consented !== 'boolean' || !integer(rm.evacuations)) return false;
    for (const w of [rm.raviney, rm.mara]) if (!record(w) || !shape(w, ['location', 'walks', 'distanceMetres']) || !['INNER_MARK', 'OUTER_MARK'].includes(w.location) || !integer(w.walks) || w.distanceMetres !== w.walks * 4 || (w.walks % 2 === 0) !== (w.location === 'INNER_MARK')) return false;
    if (!record(p) || !shape(p, ['location', 'roomWalks', 'careWalks', 'distanceMetres']) || !['INNER_MARK', 'OUTER_MARK', 'CARE_DOORWAY'].includes(p.location) || !integer(p.roomWalks) || !integer(p.careWalks, 0, 4) || p.distanceMetres !== p.roomWalks * 4 + p.careWalks * 3) return false;
    if ((p.careWalks % 2 === 1) !== (p.location === 'CARE_DOORWAY') || (p.roomWalks % 2 === 0) !== (p.location === 'INNER_MARK')) return false;
    if (!record(x) || !shape(x, ['overlayId', 'overlayLocation', 'cardIds', 'cardsLocation', 'paperBatches', 'currentBatchId', 'recordSlipId', 'errors']) || x.overlayId !== 'DP4-OVERLAY-1' || !['STORAGE', 'TABLETOP'].includes(x.overlayLocation) || !['STORAGE', 'TABLETOP'].includes(x.cardsLocation) || stableStringify(x.cardIds) !== stableStringify(['DP4-CARD-1', 'DP4-CARD-2', 'DP4-CARD-3']) || !Array.isArray(x.paperBatches) || !integer(x.errors)) return false;
    if (x.currentBatchId !== null && !integer(x.currentBatchId, 1, x.paperBatches.length) || x.recordSlipId !== null && typeof x.recordSlipId !== 'string') return false;
    for (const [i, batch] of x.paperBatches.entries()) {
      if (!record(batch) || !shape(batch, ['id', 'paidWeek', 'slips']) || batch.id !== i + 1 || !integer(batch.paidWeek, start, s.week) || !Array.isArray(batch.slips) || batch.slips.length !== 3) return false;
      for (const [j, slip] of batch.slips.entries()) if (!record(slip) || !shape(slip, ['id', 'written', 'location']) || slip.id !== `DP4-SLIP-${i + 1}-${j + 1}` || typeof slip.written !== 'boolean' || !['TABLETOP', 'SUPPLY', 'TRAY', 'FOLDER'].includes(slip.location) || slip.written && j !== 0 || (slip.location === 'TRAY' || slip.location === 'FOLDER') && !slip.written) return false;
    }
    const written = allSlips(l).filter(slip => slip.written);
    if (written.length !== Number(x.recordSlipId !== null) || written.length && written[0]!.id !== x.recordSlipId) return false;
    if (!record(f) || !shape(f, ['folderId', 'folderLocation', 'recordSlipId', 'contactId', 'consented', 'handovers', 'returns', 'deliveredWeek', 'followUpDueWeek', 'followUpWeek', 'expected', 'observed']) || f.folderId !== 'DP4-FOLDER-1' || f.contactId !== 'DP4-CARE-CONTACT-1' || !['RACK', 'PLAYER'].includes(f.folderLocation) || typeof f.consented !== 'boolean' || !integer(f.handovers, 0, 2) || f.returns !== f.handovers || f.expected !== 'NO_AUTOMATIC_CURE' || !['NOT_CHECKED', 'FICTIONAL_SYMPTOMS_REMAIN'].includes(f.observed)) return false;
    if (f.recordSlipId !== null && (f.recordSlipId !== x.recordSlipId || written[0]?.location !== 'FOLDER') || f.recordSlipId === null && written[0]?.location === 'FOLDER') return false;
    if (f.deliveredWeek !== null && !integer(f.deliveredWeek, start, s.week) || f.followUpDueWeek !== (f.deliveredWeek === null ? null : f.deliveredWeek + 1) || f.followUpWeek !== null && (f.followUpDueWeek === null || !integer(f.followUpWeek, f.followUpDueWeek, s.week))) return false;
    if (f.handovers !== Number(f.deliveredWeek !== null) + Number(f.followUpWeek !== null) || (f.observed !== 'NOT_CHECKED') !== (f.followUpWeek !== null) || f.handovers > 0 && (!f.consented || f.recordSlipId === null)) return false;
    let open = 0, prepared = 0, resolved = 0;
    for (const [i, id] of DESPAIR_CASE_IDS.entries()) {
      const r = l.cases[id];
      if (!record(r) || !shape(r, ['status', 'method', 'attemptWeek', 'preparations', 'attempts', 'withdrawals', 'closes', 'contactOpen', 'taskComplete', 'lastOutcome']) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'WAITING', 'EXAMINED', 'RESOLVED'].includes(r.status) || ![null, 'ORDINARY'].includes(r.method) || !['NONE', 'SUCCESS', 'ERROR', 'WITHDRAWN'].includes(r.lastOutcome) || typeof r.contactOpen !== 'boolean' || typeof r.taskComplete !== 'boolean') return false;
      if (![r.preparations, r.attempts, r.withdrawals, r.closes].every(v => integer(v)) || r.attemptWeek !== null && !integer(r.attemptWeek, start, s.week) || (r.attemptWeek === null) !== (r.attempts === 0) || r.attempts > 0 && r.preparations === 0) return false;
      if (['PREPARED', 'ACTIVE', 'WAITING', 'EXAMINED', 'RESOLVED'].includes(r.status) && r.method !== 'ORDINARY' || ['EXAMINED', 'RESOLVED'].includes(r.status) && (!r.taskComplete || r.contactOpen) || r.taskComplete && r.lastOutcome !== 'SUCCESS' || r.status === 'ACTIVE' && !r.contactOpen || r.status === 'WAITING' && (id !== 'care-followup' || f.deliveredWeek === null || f.followUpWeek !== null)) return false;
      if (r.status === 'AVAILABLE' && stableStringify(r) !== stableStringify(emptyCase()) || i > 0 && r.status !== 'AVAILABLE' && l.cases[DESPAIR_CASE_IDS[i - 1]!].status !== 'RESOLVED') return false;
      if (s.seer.completedSources.filter(v => v === sourceFor(id)).length !== Number(r.status === 'RESOLVED')) return false;
      open += Number(r.contactOpen); prepared += Number(r.status === 'PREPARED'); resolved += Number(r.status === 'RESOLVED');
    }
    if (open > 1 || prepared > 1 || open && prepared) return false;
    const room = l.cases['room-clearance'], scenario = l.cases['stop-and-check'], care = l.cases['care-followup'];
    if (rm.consented !== (room.status !== 'AVAILABLE') || f.consented !== (care.status !== 'AVAILABLE') || rm.evacuations !== room.attempts) return false;
    if ((rm.boardLocation === 'CLEAR_EXIT') !== (room.status === 'PREPARED' || room.contactOpen) || room.taskComplete && (p.location === 'INNER_MARK' || rm.raviney.location !== 'OUTER_MARK' || rm.mara.location !== 'OUTER_MARK')) return false;
    if (x.paperBatches.length !== scenario.preparations || x.errors > scenario.attempts || scenario.attempts !== x.errors + Number(x.recordSlipId !== null) || scenario.taskComplete !== (x.recordSlipId !== null)) return false;
    const tableOpen = scenario.status === 'PREPARED' || scenario.contactOpen;
    if ((x.cardsLocation === 'TABLETOP') !== tableOpen || (x.currentBatchId !== null) !== tableOpen || (x.overlayLocation === 'TABLETOP') !== (tableOpen && !scenario.taskComplete)) return false;
    for (const b of x.paperBatches) for (const slip of b.slips) if ((slip.location === 'TABLETOP') !== (b.id === x.currentBatchId)) return false;
    if (care.attempts !== Number(f.deliveredWeek !== null) || care.taskComplete !== (f.followUpWeek !== null) || (f.folderLocation === 'PLAYER') !== (care.status === 'PREPARED' || care.contactOpen)) return false;
    if (p.location === 'CARE_DOORWAY' && !care.contactOpen || care.status !== 'AVAILABLE' && p.location === 'INNER_MARK' || care.status === 'WAITING' && !care.contactOpen && (p.location !== 'OUTER_MARK' || f.folderLocation !== 'RACK')) return false;
    if (hasDespairLifeLock(s) && (s.world.city !== 'BACKLUND' || s.status !== 'ACTIVE' || s.combat || s.activeEvent)) return false;
    if (s.seer.completedSources.filter(v => v === 'despair-reflection').length !== Number(l.reflected) || l.reflected && resolved !== 3) return false;
    return promoted(s) ? ((s.progression.sequence===3||s.progression.sequence===2)?s.unagingDemoness.despairActingAtPromotion:s.progression.acting) === resolved * 25 + Number(l.reflected) * 25 : true;
  } catch { return false; }
}
