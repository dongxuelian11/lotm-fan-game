import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import type { PublicResolutionTier } from '../../shared/contracts.js';
import { stableStringify } from '../canonical.js';
import type { MysticAbilityId } from './types.js';

export const MYSTIC_CASE_IDS = ['sealed-story', 'bell-test', 'shared-eye'] as const;
export type MysticCaseId = typeof MYSTIC_CASE_IDS[number];
export type MysticActivityCommand =
  | { type: 'OBSERVE' | 'PERFORM' | 'CLOSE' | 'REPORT' | 'WITHDRAW'; caseId: MysticCaseId }
  | { type: 'PREPARE'; caseId: MysticCaseId; method: 'ORDINARY' | 'ABILITY' }
  | { type: 'RETURN_ROUTE'; caseId: 'shared-eye' }
  | { type: 'PUBLISH_STORY'; confirmed: true }
  | { type: 'REFLECT' };
export interface MysticCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED';
  method: 'ORDINARY' | 'ABILITY' | null;
  observedWeek: number | null; observations: number; attemptWeek: number | null;
  preparations: number; attempts: number; withdrawals: number; closes: number;
  contactOpen: boolean; taskComplete: boolean; withdrawalPending: boolean;
  lastOutcome: 'NONE' | 'SUCCESS' | 'FAILURE' | 'WITHDRAWN';
}
interface Walker { location: 'ROOM' | 'MARK'; walks: number; distanceMetres: number }
export interface MysticLifeAttempt {
  caseId: MysticCaseId; week: number; method: 'ORDINARY' | 'ABILITY';
  kind: 'RESEARCH' | 'ECHO' | 'BELL_MECHANICS' | 'SHARED_SIGHT' | 'WALK_VIEW';
  outcome: PublicResolutionTier | 'ORDINARY'; spiritualitySpent: 0 | 3;
  sourceId: 'MY4-STORY-1' | 'MY4-MARKER-1'; audience: number; effectFactor: 0 | 0.15 | 1;
  closed: boolean; withdrawn: boolean;
}
export interface MysticLifeState {
  cases: Record<MysticCaseId, MysticCaseState>; reflected: boolean;
  echoLearned: boolean; publicDisclosed: boolean;
  story: {
    id: 'MY4-STORY-1'; incidentId: 'MY4-PAST-1'; incidentDate: '1349-06-20';
    custodianId: 'MY4-EDDA-NOLL'; source: 'IRE_CONFIDENTIAL_ARCHIVE_AND_LIVING_WITNESS';
    accessWeek: number | null; corroborated: boolean; learnedWeek: number | null;
    recordLocation: 'ARCHIVE' | 'TABLE'; notesId: 'MY4-NOTES-1'; notesLocation: 'FOLDER' | 'TABLE';
    readerIds: string[]; publicationWeek: number | null; publicationId: 'MY4-PUBLIC-COPY-1' | null;
    recipientGroup: 'MY4-READING-GROUP-1' | null;
  };
  bell: {
    id: 'MY4-BELL-1'; source: 'EDDA_ORIGINAL_INCIDENT_BELL'; location: 'RACK' | 'TABLE';
    clapper: 'STILL'; ordinaryRings: number; consentWeek: number | null;
    echoActive: boolean; remainingSeconds: 0 | 60; effectFactor: 0 | 0.15 | 1;
    lastPerception: 'NONE' | 'ORDINARY_RING' | 'DELAYED_SOUND' | 'FAINT_DELAYED_SOUND';
  };
  sight: {
    corridorId: 'MY4-CORRIDOR-1'; markerId: 'MY4-MARKER-1';
    markerSource: 'IRE_EXISTING_NEW_CORRIDOR_PROP'; markerLocation: 'MARK';
    participantId: 'DAPHNIE'; consentWeek: number | null; eyeActive: boolean;
    markerSeen: boolean; sharedViews: number; ordinaryViews: number; participant: Walker; player: Walker;
  };
  history: MysticLifeAttempt[];
}
export interface MysticLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: MysticActivityCommand }
export interface MysticLifeProjection {
  cases: { id: MysticCaseId; title: string; story: string; observations: string[]; preparation: string | null; result: string | null; status: string; contactOpen: string; closes: number }[];
  insideCase: boolean; environment: string;
  practice: { story: string; bell: string; sight: string; route: string; cost: string; history: string[] } | null;
}
const PRIVATE_READERS = ['SCROLL_PROFESSOR_GUIDE', 'MY4-EDDA-NOLL', 'DAPHNIE', 'MY4-LEN-ORR'] as const;
const PUBLIC_READERS = Array.from({ length: 100 }, (_, i) => `MY4-READING-GROUP-1-ADULT-${String(i + 1).padStart(3, '0')}`);
const MARKER = '原标牌上有一道蓝色横线，右下角刻着MY4-MARKER-1';
const CASES = [
  { id: 'sealed-story', title: '亲研封存的迟到钟声', story: '伊蕾允许你本人接触保管人、成年艾妲·诺尔的原保密记录MY4-STORY-1与同一原铃MY4-BELL-1。1349年6月20日，艾妲、达芙宁与成年档案员伦·奥尔亲历一件已发生的神秘事件：铃舌停止后，房中又出现一次迟来的听觉回声。伊蕾当时核验并封存记录；这是本作原创G真实往事，不是原著故事或玩家自编童话。', facts: ['本人查看原铃旧裂痕、原记录日期与签名，并听取原保管人艾妲的独立当面证词；两类来源共同约束研究。', '普通准备实际摆好原铃与原笔记；研究另需1行动、3灵性与知识18，失败照耗且下一真实周才能重试。', '真正成功才学会唯一原创G法术“迟钟回声”：短暂听觉与注意偏差，不是时间控制、任意故事成真或免费法术库。', '研究成功也须实际收好原物，才能报告；研究本身不加能力掌握。'] },
  { id: 'bell-test', title: '静止原铃与有限听觉回声', story: '同一成年达芙宁再次明确自愿参加原铃的短暂对照。你可以试用本人确实学会的迟钟回声，也可以普通拨动铃舌核对机械响声；后者不能冒领能力报告。（原创G）', facts: ['能力试验不会敲响原铃，铃舌实际仍静止；仅在本人感知中形成最多60秒的有限迟声，可能被抵抗而失败。', '能力实施1行动、3灵性、知识18；公开后的源效力为私密时的15%，不让人失聪、不控制思想、没有伤害。', '普通方法1行动、0灵性，真实轻拨原铃一次并等铃舌静止；可完成普通报告，但不增能力掌握。', '本人可以撤回同意，0行动立即终止听觉效果并收好原物；真实已付成本与既有研究保留。'] },
  { id: 'shared-eye', title: '同意后的六米共享视线', story: '同一成年达芙宁在伊蕾原教学室旁另一段现存净空走廊MY4-CORRIDOR-1明确同意有限共享视线。该走廊原标牌MY4-MARKER-1来自伊蕾自己的既有教学用品，始终在六米外MARK；不会挪用或改写旧星象师原标记、原薄布与庭院。（原创G）', facts: ['能力准备不移动任何人；实施时本人自愿从ROOM普通步行六米到MARK，你仍在ROOM。', '知识18成功才通过置于她身上的有限眼睛看见她此刻所见原标牌；失败照耗3灵性、没有视野，她仍可自由行走。', '普通方法由你本人花1行动步行六米看当前可见标牌；达芙宁留在ROOM，0灵性、不增能力掌握。', '必须另选0行动原路返回六米，再0行动撤下眼睛、结束同意并报告；撤回同意先关闭眼睛，实际返程前仍不能跨周或离场。'] },
] as const;
export const MYSTIC_LIFE_ENVIRONMENT = '三项原创G有限实践；观察、准备、实施、报告各1行动，每项真实报告扮演25，三项反思1行动另25。研究与两项能力实施各3灵性、知识18，失败下一真实周再试；普通铃和步行对照0灵性、不加掌握。原路返回、取消与收束0行动，安全准备可取消、关闭失败后可正常休养。只有一项本人亲研的迟钟回声；私密研究实际知情者5人，明确公开给100名原读书会成年人后105人、后续效力15%，不可撤销。没有任意故事成真、时间控制、神话形态、预言大师能力或血液施法。';
const emptyCase = (): MysticCaseState => ({ status: 'AVAILABLE', method: null, observedWeek: null, observations: 0, attemptWeek: null, preparations: 0, attempts: 0, withdrawals: 0, closes: 0, contactOpen: false, taskComplete: false, withdrawalPending: false, lastOutcome: 'NONE' });
const walker = (): Walker => ({ location: 'ROOM', walks: 0, distanceMetres: 0 });
export function createMysticLifeState(): MysticLifeState {
  return {
    cases: { 'sealed-story': emptyCase(), 'bell-test': emptyCase(), 'shared-eye': emptyCase() }, reflected: false, echoLearned: false, publicDisclosed: false,
    story: { id: 'MY4-STORY-1', incidentId: 'MY4-PAST-1', incidentDate: '1349-06-20', custodianId: 'MY4-EDDA-NOLL', source: 'IRE_CONFIDENTIAL_ARCHIVE_AND_LIVING_WITNESS', accessWeek: null, corroborated: false, learnedWeek: null, recordLocation: 'ARCHIVE', notesId: 'MY4-NOTES-1', notesLocation: 'FOLDER', readerIds: [...PRIVATE_READERS], publicationWeek: null, publicationId: null, recipientGroup: null },
    bell: { id: 'MY4-BELL-1', source: 'EDDA_ORIGINAL_INCIDENT_BELL', location: 'RACK', clapper: 'STILL', ordinaryRings: 0, consentWeek: null, echoActive: false, remainingSeconds: 0, effectFactor: 0, lastPerception: 'NONE' },
    sight: { corridorId: 'MY4-CORRIDOR-1', markerId: 'MY4-MARKER-1', markerSource: 'IRE_EXISTING_NEW_CORRIDOR_PROP', markerLocation: 'MARK', participantId: 'DAPHNIE', consentWeek: null, eyeActive: false, markerSeen: false, sharedViews: 0, ordinaryViews: 0, participant: walker(), player: walker() }, history: [],
  };
}
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const shape = (x: Record<string, unknown>, keys: readonly string[]) => Object.keys(x).length === keys.length && keys.every(k => Object.hasOwn(x, k));
const integer = (x: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): x is number => Number.isSafeInteger(x) && (x as number) >= min && (x as number) <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'hermit' && [4,3,2].includes(s.progression.sequence!);
const sourceFor = (id: MysticCaseId) => `mystic-case:${id}`;
const success = (outcome: MysticLifeAttempt['outcome']) => ['SUCCESS', 'GREAT_SUCCESS', 'ORDINARY'].includes(outcome);
const currentAttempt = (l: MysticLifeState, id: MysticCaseId) => l.history.filter(h => h.caseId === id).at(-1);
const consentWeek = (l: MysticLifeState, id: MysticCaseId) => id === 'bell-test' ? l.bell.consentWeek : id === 'shared-eye' ? l.sight.consentWeek : null;
const needsConsent = (id: MysticCaseId) => id !== 'sealed-story';
export function validateMysticActivityCommand(c: unknown): c is MysticActivityCommand {
  if (!record(c)) return false;
  if (c.type === 'REFLECT') return shape(c, ['type']);
  if (c.type === 'PUBLISH_STORY') return shape(c, ['type', 'confirmed']) && c.confirmed === true;
  if (!MYSTIC_CASE_IDS.includes(c.caseId as MysticCaseId)) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && (c.method === 'ORDINARY' || c.method === 'ABILITY' && c.caseId !== 'sealed-story');
  return shape(c, ['type', 'caseId']) && (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string) || c.type === 'RETURN_ROUTE' && c.caseId === 'shared-eye');
}
export function hasMysticLifeLock(s: SliceState): boolean {
  const l = s.mystic.life;
  return Object.values(l.cases).some(r => r.contactOpen) || l.sight.player.location !== 'ROOM' || l.sight.participant.location !== 'ROOM' || l.bell.echoActive || l.sight.eyeActive;
}
export function mysticActivityReason(s: SliceState, c: MysticActivityCommand): string | null {
  if (!validateMysticActivityCommand(c)) return '神秘学家命令无效；不接受自由故事、未知目标或未确认公开。';
  if (!promoted(s)||(s.progression.sequence!==4&&c.type!=='PUBLISH_STORY')) return '原神秘学家实践保留，当前阶段不重新开启；已学秘密仍可独立选择公开。';
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要回到贝克兰德原教学室与相邻原走廊。';
  const l = s.mystic.life, r = 'caseId' in c ? l.cases[c.caseId] : null;
  if (c.type === 'RETURN_ROUTE') return r?.contactOpen && (l.sight.player.location === 'MARK' || l.sight.participant.location === 'MARK') ? null : '目前没有人在本次六米外MARK，不能虚构返程。';
  if (c.type === 'CLOSE') return !r?.contactOpen ? '本次尚无需要收束的实际实施；可取消准备。' : c.caseId === 'shared-eye' && (l.sight.player.location !== 'ROOM' || l.sight.participant.location !== 'ROOM') ? '先另选0行动沿原六米路线实际返回；收束不能瞬移。' : null;
  if (c.type === 'WITHDRAW') return r && !r.withdrawalPending && (r.status === 'PREPARED' || r.contactOpen && (c.caseId !== 'sealed-story' || !r.taskComplete)) ? null : '没有可撤回的准备或本次同意；已完成的研究请安全收束。';
  if (hasMysticLifeLock(s)) return '先0行动结束当前效果、实际返程并收束。';
  if (s.mystic.ritual.sample.status === 'ANALYSIS') return '先安全关闭原血样分析。';
  if (s.actionsRemaining < 1) return '本次需要1行动；已实施与准备都可0行动安全退出。';
  if (s.health < 1 || s.mind < 1) return '先正常休养；安全收束不需要灵性或精神。';
  const prepared = MYSTIC_CASE_IDS.find(id => l.cases[id].status === 'PREPARED');
  if (prepared && (!('caseId' in c) || c.caseId !== prepared)) return '先完成或取消已摆好的那项原准备。';
  if (c.type === 'REFLECT') return l.reflected ? '三项反思已经完成。' : MYSTIC_CASE_IDS.every(id => l.cases[id].status === 'RESOLVED') ? null : '先完成三项真实报告。';
  if (c.type === 'PUBLISH_STORY') return l.publicDisclosed ? '原记录已经公开，无法收回既有读者知识。' : !l.echoLearned || l.cases['sealed-story'].status !== 'RESOLVED' ? '先亲自研究成功、收束并报告同一原故事。' : null;
  if (!r || r.status === 'RESOLVED') return '这项有限报告已经完成。';
  const index = MYSTIC_CASE_IDS.indexOf(c.caseId);
  if (index > 0 && l.cases[MYSTIC_CASE_IDS[index - 1]!].status !== 'RESOLVED') return '先完成上一项真实报告。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' || r.status === 'OBSERVED' && needsConsent(c.caseId) && consentWeek(l, c.caseId) !== s.week ? null : '原来源与本次同意已核对。';
  if (c.type === 'REPORT') return r.status === 'EXAMINED' && r.taskComplete ? null : '先取得实际成功结果并安全收束，再报告。';
  if (c.type === 'PREPARE') {
    if (r.status !== 'OBSERVED') return '先观察原现场并取得本人本次同意。';
    if (r.attemptWeek === s.week) return '本周已实际尝试，下一真实周再准备。';
    if (needsConsent(c.caseId) && consentWeek(l, c.caseId) !== s.week) return '先重新观察并核对本人这一真实周的同意。';
    if (c.caseId === 'bell-test' && c.method === 'ABILITY' && !l.echoLearned) return '必须先亲自研究学会同一迟钟回声；没有免费法术。';
    return null;
  }
  if (r.status !== 'PREPARED' || r.method === null) return '先准备本次有限方法。';
  if (r.attemptWeek === s.week) return '本周已经尝试，下一真实周才能重试。';
  if (needsConsent(c.caseId) && consentWeek(l, c.caseId) !== s.week) return '本次同意已跨周，请0行动取消准备，再重新观察核对。';
  if ((c.caseId === 'sealed-story' || r.method === 'ABILITY') && s.spirituality < 3) return '本次需要3灵性；可0行动取消准备后休养。';
  return null;
}
function walk(w: Walker, location: Walker['location']) {
  if (w.location !== location) { w.location = location; w.walks += 1; w.distanceMetres += 6; }
}
function endEffects(l: MysticLifeState, id: MysticCaseId) {
  if (id === 'bell-test') { l.bell.echoActive = false; l.bell.remainingSeconds = 0; l.bell.effectFactor = 0; l.bell.consentWeek = null; }
  if (id === 'shared-eye') { l.sight.eyeActive = false; l.sight.consentWeek = null; }
}
function storeProps(l: MysticLifeState, id: MysticCaseId) {
  if (id === 'sealed-story') { l.story.recordLocation = 'ARCHIVE'; l.story.notesLocation = 'FOLDER'; l.bell.location = 'RACK'; }
  if (id === 'bell-test') l.bell.location = 'RACK';
}
function closeSession(l: MysticLifeState, id: MysticCaseId) {
  const r = l.cases[id], h = currentAttempt(l, id);
  endEffects(l, id); storeProps(l, id);
  if (r.contactOpen) { r.closes += 1; if (h) h.closed = true; }
  r.contactOpen = false; r.withdrawalPending = false; r.status = r.taskComplete ? 'EXAMINED' : 'OBSERVED';
  if (!r.taskComplete) r.method = null;
}
export function applyMysticActivity(s: SliceState, c: MysticActivityCommand, ctx: SeerContext, award: (id: MysticAbilityId, amount?: number) => void): void {
  const reason = mysticActivityReason(s, c); if (reason) throw new Error(reason);
  const l = s.mystic.life;
  if (c.type === 'REFLECT') {
    s.actionsRemaining -= 1; l.reflected = true; s.seer.completedSources.push('mystic-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('把来源、效力与本人同意分开', '三份实际报告区分了真实神秘往事、有限感知再现和本人此刻共享的视线。G扮演+25；普通方法不补能力掌握，既有公开不撤回，不解锁其他故事、神话形态或预言。'); return;
  }
  if (c.type === 'PUBLISH_STORY') {
    s.actionsRemaining -= 1; l.publicDisclosed = true; l.story.publicationWeek = s.week; l.story.publicationId = 'MY4-PUBLIC-COPY-1'; l.story.recipientGroup = 'MY4-READING-GROUP-1'; l.story.readerIds.push(...PUBLIC_READERS);
    ctx.note('同一亲研故事已经实际公开', '你确认后用1行动将MY4-STORY-1的完整副本MY4-PUBLIC-COPY-1交给北桥成年读书会MY4-READING-GROUP-1，在场100位不同原成员按编号001至100实际读到原记录。知情者由原5人增至105人；此后迟钟回声效力从1降为0.15。公开不可逆，既有研究、原事件与掌握保留，无扮演或掌握奖励。'); return;
  }
  const id = c.caseId, r = l.cases[id], spec = CASES.find(p => p.id === id)!;
  if (c.type === 'RETURN_ROUTE') {
    const who = l.sight.participant.location === 'MARK' ? '达芙宁本人' : '你本人';
    walk(l.sight.participant, 'ROOM'); walk(l.sight.player, 'ROOM');
    ctx.note('沿同一原走廊实际返回六米', `${who}从MARK普通步行六米回到ROOM，实际累计距离保留。没有传送；下一步0行动收束当前眼睛、同意与现场。`); return;
  }
  if (c.type === 'WITHDRAW') {
    r.withdrawals += 1; r.taskComplete = false; r.lastOutcome = 'WITHDRAWN';
    const h = currentAttempt(l, id); if (r.contactOpen && h) h.withdrawn = true;
    endEffects(l, id);
    if (id === 'shared-eye' && r.contactOpen && (l.sight.player.location === 'MARK' || l.sight.participant.location === 'MARK')) {
      r.withdrawalPending = true;
      ctx.note('本人撤回同意，眼睛立即撤下', '0行动关闭本次共享眼睛并结束同意；原身体仍在六米外MARK，可以自由走回。须另选0行动真实返程与收束，不能靠撤回瞬移或跨周；不退成本、不加奖励。'); return;
    }
    closeSession(l, id);
    ctx.note('取消准备或结束本次自愿对照', '0行动实际收好同一原铃、原记录与笔记，关闭本次有限效果并结束同意。既有知识、已走距离、失败与已付成本保留，没有完成奖励。'); return;
  }
  if (c.type === 'CLOSE') {
    closeSession(l, id);
    ctx.note('实际结束有限接触', id === 'sealed-story' ? '同一原铃回架、原记录归伊蕾档案、原笔记归夹；研究成功与否据实保留，现在才可报告已验证结果。' : id === 'bell-test' ? '同一原铃归架，铃舌仍静止；迟声效果归零，本次同意结束。有限听觉不会延伸为永久失聪或控制。' : '你与同一达芙宁已实际都回到ROOM；原眼睛撤下，本次同意结束。原标牌仍在六米外，已亲见的历史事实保留。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'OBSERVE') {
    r.status = 'OBSERVED'; r.observedWeek = s.week; r.observations += 1;
    if (id === 'sealed-story') { l.story.accessWeek = s.week; l.story.corroborated = true; l.story.readerIds.push('PLAYER'); }
    if (id === 'bell-test') l.bell.consentWeek = s.week;
    if (id === 'shared-eye') l.sight.consentWeek = s.week;
    ctx.note(spec.title, spec.story + ' ' + spec.facts.join(' ') + (id === 'sealed-story' ? '你实际阅读后成为第五位知情者，但尚未研究成功或学会法术。' : '本人明确同意的仅是本次有限对照，可随时撤回。')); return;
  }
  if (c.type === 'PREPARE') {
    r.status = 'PREPARED'; r.method = c.method; r.preparations += 1;
    if (id === 'sealed-story') { l.story.recordLocation = 'TABLE'; l.story.notesLocation = 'TABLE'; l.bell.location = 'TABLE'; }
    if (id === 'bell-test') l.bell.location = 'TABLE';
    ctx.note(spec.title, id === 'sealed-story' ? '你用普通方法将同一原铃、原保密记录及一册原研究笔记MY4-NOTES-1实际摆到桌上；没有提前学会任何法术。' : id === 'bell-test' ? `将同一原铃从架上摆到桌面；本人同意${c.method === 'ABILITY' ? '对已学迟钟回声进行一次短暂试验' : '普通拨铃对照'}。尚无效果，也未敲铃。` : `确认同一净空六米路线与本人本次同意；准备${c.method === 'ABILITY' ? '有限共享视线' : '自己普通步行观察'}，双方仍在ROOM，没有在准备时移人或揭示未知标牌。`); return;
  }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.seer.completedSources.push(sourceFor(id)); s.progression.acting = Math.min(100, s.progression.acting + 25);
    if (r.method === 'ABILITY') award(id === 'bell-test' ? 'hermit.s4.mystical-reenactment' : 'hermit.s4.shared-sight', 8);
    ctx.note(spec.title, `${id === 'sealed-story' ? '本人已经核对原事件、物证与独立证词，真实研究成功并收好同一原物，只学会一项迟钟回声。' : id === 'bell-test' ? r.method === 'ABILITY' ? '报告真实发生且已经结束的有限迟声；原铃并未被能力敲响，抵抗边界与当时传播范围保留。' : '报告普通拨铃的机械结果；不是再现法术的能力成果。' : `报告已实际亲见的原标牌：“${MARKER}”。双方均沿原路返回，眼睛与本次同意已经关闭。`}G扮演+25；${r.method === 'ABILITY' ? '对应能力单项掌握+8，仅本报告一次。' : '不增加能力掌握。'}`); return;
  }
  r.attemptWeek = s.week; r.attempts += 1; r.contactOpen = true; r.status = 'ACTIVE';
  const usesPower = id === 'sealed-story' || r.method === 'ABILITY';
  if (usesPower) s.spirituality -= 3;
  if (id === 'shared-eye') walk(r.method === 'ABILITY' ? l.sight.participant : l.sight.player, 'MARK');
  const outcome = usesPower ? ctx.check('knowledge', 18).tier : 'ORDINARY';
  const ok = success(outcome);
  const factor = id === 'bell-test' && r.method === 'ABILITY' ? l.publicDisclosed ? 0.15 : 1 : 0;
  l.history.push({ caseId: id, week: s.week, method: r.method!, kind: id === 'sealed-story' ? 'RESEARCH' : id === 'bell-test' ? r.method === 'ABILITY' ? 'ECHO' : 'BELL_MECHANICS' : r.method === 'ABILITY' ? 'SHARED_SIGHT' : 'WALK_VIEW', outcome, spiritualitySpent: usesPower ? 3 : 0, sourceId: id === 'shared-eye' ? 'MY4-MARKER-1' : 'MY4-STORY-1', audience: l.story.readerIds.length, effectFactor: factor, closed: false, withdrawn: false });
  r.taskComplete = ok; r.lastOutcome = ok ? 'SUCCESS' : 'FAILURE';
  if (id === 'sealed-story') {
    if (ok) { l.echoLearned = true; l.story.learnedWeek = s.week; }
    ctx.note(spec.title, ok ? '知识18研究成功：你把原铃痕迹、原档案及艾妲独立证词相互核对，形成一项可复核的有限神秘结构，真实学会原创G“迟钟回声”。3灵性已耗；尚无能力掌握。先0行动把原铃、原档案与原笔记收好，再报告。' : '知识18研究失败，3灵性已经实际消耗；原记载与独立证词仍在，尚未学会任何再现法术。先0行动收好原物，下一真实周才能再准备研究。');
  } else if (id === 'bell-test') {
    if (r.method === 'ORDINARY') { l.bell.ordinaryRings += 1; l.bell.lastPerception = 'ORDINARY_RING'; }
    else if (ok) { l.bell.echoActive = true; l.bell.remainingSeconds = 60; l.bell.effectFactor = factor; l.bell.lastPerception = l.publicDisclosed ? 'FAINT_DELAYED_SOUND' : 'DELAYED_SOUND'; }
    else l.bell.lastPerception = 'NONE';
    ctx.note(spec.title, r.method === 'ORDINARY' ? '你实际轻拨同一原铃一次，双方听见真实机械铃声后等铃舌静止；0灵性，没有法术或能力掌握。先收好原铃、结束同意再报告。' : ok ? `实际支付3灵性并通过知识18抵抗核对；达芙宁本人此刻听见${l.publicDisclosed ? '公开源效力0.15的极弱' : '私密源效力1的有限'}迟声。原铃仍静止且没有真实声源改动；最多60秒G，0行动收束使效果归零。` : '3灵性已付，但知识18试验被抵抗，没有迟声、伤害或控制；原铃仍静止。0行动收束，下一真实周取得本人新同意后再试。');
  } else {
    if (ok) { l.sight.markerSeen = true; if (r.method === 'ABILITY') { l.sight.eyeActive = true; l.sight.sharedViews += 1; } else l.sight.ordinaryViews += 1; }
    ctx.note(spec.title, (r.method === 'ABILITY' ? '达芙宁本人自愿实际走到六米外MARK，你仍在ROOM。3灵性已付；' : '你本人实际走到六米外MARK，达芙宁仍在ROOM。0灵性；') + (ok ? `${r.method === 'ABILITY' ? '知识18成功，你通过她身上的有限眼睛共享她当前所见：' : '当前普通亲眼所见：'}${MARKER}。不读取思想、不控制身体，也不生成隐藏事实。` : '知识18失败，没有放置成功的眼睛或共享视野，不编造未知标牌；她仍可自由走动。') + '另选0行动实际沿六米原路返回，再0行动关闭现场。');
  }
}

export function mysticLifeActions(s: SliceState): MysticLifeAction[] {
  if (!promoted(s)) return [];
  const l = s.mystic.life, actions: MysticLifeAction[] = [];
  const add = (id: string, label: string, cost: string, command: MysticActivityCommand) => { const reason = mysticActivityReason(s, command); actions.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const spec of CASES) {
    const id = spec.id, r = l.cases[id];
    if (r.status === 'AVAILABLE' || r.status === 'OBSERVED' && needsConsent(id) && consentWeek(l, id) !== s.week) add(`${id}-observe`, id === 'sealed-story' ? '亲查原铃、原保密记录与独立证词' : '观察原现场并取得本人本次同意', '1行动 · 本人亲自核对 · 不提前施法', { type: 'OBSERVE', caseId: id });
    if (r.status === 'OBSERVED') {
      add(`${id}-ordinary`, id === 'sealed-story' ? '普通摆好原铃、原记录与研究笔记' : id === 'bell-test' ? '准备普通拨铃机械对照' : '准备自己普通步行六米观察', '1行动 · 0灵性 · 普通准备', { type: 'PREPARE', caseId: id, method: 'ORDINARY' });
      if (id !== 'sealed-story') add(`${id}-ability`, id === 'bell-test' ? '准备已学迟钟回声的本人同意试验' : '准备本人同意的有限共享视线', '1行动 · 尚不施法或移动身体', { type: 'PREPARE', caseId: id, method: 'ABILITY' });
    }
    if (r.status === 'PREPARED') add(`${id}-perform`, id === 'sealed-story' ? '实际研究同一真实神秘往事' : id === 'shared-eye' ? r.method === 'ABILITY' ? '本人步行六米并试放共享眼睛' : '自己实际步行六米看原标牌' : r.method === 'ABILITY' ? '对静止原铃试用已学迟钟回声' : '普通轻拨原铃并核对一次机械声', id === 'sealed-story' || r.method === 'ABILITY' ? `1行动 · 3灵性 · 知识18 · 失败照耗${id === 'bell-test' ? ` · 效力${l.publicDisclosed ? '15%' : '100%'}` : ''}` : '1行动 · 0灵性 · 真实普通动作 · 不增掌握', { type: 'PERFORM', caseId: id });
    if ((r.status === 'PREPARED' || r.contactOpen && (id !== 'sealed-story' || !r.taskComplete)) && !r.withdrawalPending) add(`${id}-withdraw`, '撤回本次同意或取消准备', '0行动 · 立即关效果 · 仍须实际返程 · 不退成本', { type: 'WITHDRAW', caseId: id });
    if (r.contactOpen) {
      if (id === 'shared-eye' && (l.sight.player.location === 'MARK' || l.sight.participant.location === 'MARK')) add(`${id}-return`, '本人沿原路实际返回六米', '0行动 · MARK → ROOM · 不瞬移', { type: 'RETURN_ROUTE', caseId: 'shared-eye' });
      add(`${id}-close`, id === 'sealed-story' ? '原铃归架、原档案与笔记归存' : id === 'bell-test' ? '终止有限迟声、原铃归架并结束同意' : '撤下原眼睛并结束本次同意', '0行动 · 真实收束 · 不退成本', { type: 'CLOSE', caseId: id });
    }
    if (r.status === 'EXAMINED') add(`${id}-report`, '报告亲自核验且已收束的有限结果', `1行动 · G扮演+25 · ${r.method === 'ABILITY' ? '对应能力掌握+8' : '不加能力掌握'}`, { type: 'REPORT', caseId: id });
  }
  if (l.echoLearned && !l.publicDisclosed) add('mystic-publish-story', '确认不可逆公开同一亲研故事给原读书会', '1行动 · 知情者5→105 · 后续迟钟回声效力降至15% · 无奖励', { type: 'PUBLISH_STORY', confirmed: true });
  if (!l.reflected) add('mystic-reflect', '反思真实来源、公开效力与本人同意', '1行动 · 三份报告后 · G扮演+25', { type: 'REFLECT' });
  return actions;
}
export function projectMysticLife(s: SliceState): MysticLifeProjection {
  if (!promoted(s)) return { cases: [], insideCase: false, environment: '', practice: null };
  const l = s.mystic.life, st = l.story, b = l.bell, v = l.sight;
  return {
    insideCase: hasMysticLifeLock(s), environment: MYSTIC_LIFE_ENVIRONMENT,
    cases: CASES.map(spec => { const r = l.cases[spec.id], h = currentAttempt(l, spec.id); return {
      id: spec.id, title: spec.title, story: spec.story, observations: r.status === 'AVAILABLE' ? [] : [...spec.facts], status: r.status, closes: r.closes,
      preparation: r.status === 'PREPARED' ? `${r.method === 'ABILITY' ? '能力' : '普通'}准备已真实完成；${spec.id === 'sealed-story' ? '同一原铃、原档案与原笔记在桌上，下一步付3灵性研究。' : spec.id === 'bell-test' ? '同一原铃在桌上，尚无试验效果。' : '双方仍在ROOM，尚未移动或揭示标牌。'}` : null,
      result: h ? `第${h.week}周第${r.attempts}次实际实施：${h.outcome}；已付${h.spiritualitySpent}灵性。${h.withdrawn ? '本次已撤回，不奖励。' : r.taskComplete ? h.closed ? '已真实收束，可以报告或已报告。' : '有限动作成功，尚须实际返程/收束才能报告。' : '没有可报告成功；安全收束后下一真实周重试。'}收束${r.closes}次，撤回${r.withdrawals}次。` : r.withdrawals ? '准备已撤回，成本保留。' : null,
      contactOpen: r.contactOpen ? r.withdrawalPending ? '同意已撤回、眼睛已关；本人仍须实际返回后收束' : '本次原现场未收束；0行动清理与真实返程可用' : '没有尚未收束的效果或远处身体',
    }; }),
    practice: {
      story: `${st.id}来自伊蕾原保密档案与成年艾妲·诺尔(${st.custodianId})独立证词；记载${st.incidentDate}实际往事${st.incidentId}，全为原创G。${st.accessWeek === null ? '你尚未亲阅，既有四位知情人保留。' : `你第${st.accessWeek}周亲阅并交叉核对原物与证词。`} ${l.echoLearned ? `第${st.learnedWeek}周本人研究成功，仅学会“迟钟回声”。` : '尚未学会任何再现法术。'}实际知情者${st.readerIds.length}人；${l.publicDisclosed ? `第${st.publicationWeek}周原副本交给北桥成年读书会100位成员，5→105人，效力1→0.15；不可逆。` : '尚未公开；完成研究时私密5人、效力1。'}同一原记录在${st.recordLocation}，原笔记${st.notesId}在${st.notesLocation}。`,
      bell: `唯一原铃${b.id}来自原保管人亲历事件，现于${b.location}，铃舌STILL。普通实际轻拨${b.ordinaryRings}次；能力不会敲铃。${b.consentWeek === null ? '没有本次听觉同意。' : `达芙宁第${b.consentWeek}周明确同意本次有限对照。`}${b.echoActive ? `当前迟声上限${b.remainingSeconds}秒G、源效力${b.effectFactor}；0行动可立即关闭。` : '当前没有仍生效的听觉再现。'}上次实际感知记录${b.lastPerception}。`,
      sight: `同一成年达芙宁(${v.participantId})，${v.consentWeek === null ? '本次共享同意未开放' : `第${v.consentWeek}周本次明确同意`}；${v.eyeActive ? '本人身上一只有限共享眼睛仍开着' : '没有仍开着的共享眼睛'}。成功共享${v.sharedViews}次，普通亲见${v.ordinaryViews}次。${v.markerSeen ? `已实际亲见的历史：${MARKER}。` : '尚未看见原标牌内容，不显示未知文字。'}不读取思想、不控制本人。`,
      route: `新原走廊${v.corridorId}单程6米，原标牌${v.markerId}来自伊蕾既有教学用品，始终在MARK。你在${v.player.location}，实际走过${v.player.distanceMetres}米；达芙宁在${v.participant.location}，实际走过${v.participant.distanceMetres}米。旧星象师眼镜、标记、薄布与原庭院历史不变。`,
      cost: `本切片已实施${l.history.length}次、累计实际消耗${l.history.reduce((n, h) => n + h.spiritualitySpent, 0)}灵性；观察、准备、实施、报告各1行动。失败照耗、下一真实周再试；原路返回、取消与收束0行动。没有新增金钱、血液消耗或免费法术。`,
      history: [`实际报告${MYSTIC_CASE_IDS.filter(id => l.cases[id].status === 'RESOLVED').length}/3，反思${l.reflected ? '已完成' : '未完成'}；有限总扮演100，不可重复领取。`, ...l.history.map(h => `第${h.week}周 ${h.caseId}/${h.kind}：${h.outcome}，${h.spiritualitySpent}灵性，源${h.sourceId}，当时知情${h.audience}人${h.kind === 'ECHO' ? `、效力${h.effectFactor}` : ''}；${h.closed ? '已收束' : '未收束'}${h.withdrawn ? '，本人已撤回' : ''}。`)],
    },
  };
}

/** Original identities, learned sources, real audience, actual movement and closure survive save/load. */
export function validateMysticLife(s: SliceState): boolean {
  try {
    const l = s.mystic.life, start = s.mystic.promotionWeek ?? s.week;
    if (!record(l) || !shape(l, ['cases', 'reflected', 'echoLearned', 'publicDisclosed', 'story', 'bell', 'sight', 'history']) || !record(l.cases) || !shape(l.cases, MYSTIC_CASE_IDS) || ![l.reflected, l.echoLearned, l.publicDisclosed].every(v => typeof v === 'boolean') || !Array.isArray(l.history)) return false;
    if (s.mystic.promotionWeek === null) return stableStringify(l) === stableStringify(createMysticLifeState());
    const st = l.story, b = l.bell, v = l.sight;
    if (!record(st) || !shape(st, ['id', 'incidentId', 'incidentDate', 'custodianId', 'source', 'accessWeek', 'corroborated', 'learnedWeek', 'recordLocation', 'notesId', 'notesLocation', 'readerIds', 'publicationWeek', 'publicationId', 'recipientGroup']) || st.id !== 'MY4-STORY-1' || st.incidentId !== 'MY4-PAST-1' || st.incidentDate !== '1349-06-20' || st.custodianId !== 'MY4-EDDA-NOLL' || st.source !== 'IRE_CONFIDENTIAL_ARCHIVE_AND_LIVING_WITNESS' || st.notesId !== 'MY4-NOTES-1' || !['ARCHIVE', 'TABLE'].includes(st.recordLocation) || !['FOLDER', 'TABLE'].includes(st.notesLocation) || typeof st.corroborated !== 'boolean' || !Array.isArray(st.readerIds)) return false;
    for (const week of [st.accessWeek, st.learnedWeek, st.publicationWeek]) if (week !== null && !integer(week, start, s.week)) return false;
    if (st.corroborated !== (st.accessWeek !== null) || l.echoLearned !== (st.learnedWeek !== null) || l.echoLearned && !st.corroborated) return false;
    const expectedReaders = [...PRIVATE_READERS, ...(st.accessWeek === null ? [] : ['PLAYER']), ...(l.publicDisclosed ? PUBLIC_READERS : [])];
    if (stableStringify(st.readerIds) !== stableStringify(expectedReaders) || l.publicDisclosed !== (st.publicationWeek !== null) || st.publicationId !== (l.publicDisclosed ? 'MY4-PUBLIC-COPY-1' : null) || st.recipientGroup !== (l.publicDisclosed ? 'MY4-READING-GROUP-1' : null) || l.publicDisclosed && (!l.echoLearned || st.publicationWeek! < st.learnedWeek! || l.cases['sealed-story'].status !== 'RESOLVED')) return false;
    if (!record(b) || !shape(b, ['id', 'source', 'location', 'clapper', 'ordinaryRings', 'consentWeek', 'echoActive', 'remainingSeconds', 'effectFactor', 'lastPerception']) || b.id !== 'MY4-BELL-1' || b.source !== 'EDDA_ORIGINAL_INCIDENT_BELL' || !['RACK', 'TABLE'].includes(b.location) || b.clapper !== 'STILL' || !integer(b.ordinaryRings) || typeof b.echoActive !== 'boolean' || !['NONE', 'ORDINARY_RING', 'DELAYED_SOUND', 'FAINT_DELAYED_SOUND'].includes(b.lastPerception)) return false;
    if (!record(v) || !shape(v, ['corridorId', 'markerId', 'markerSource', 'markerLocation', 'participantId', 'consentWeek', 'eyeActive', 'markerSeen', 'sharedViews', 'ordinaryViews', 'participant', 'player']) || v.corridorId !== 'MY4-CORRIDOR-1' || v.markerId !== 'MY4-MARKER-1' || v.markerSource !== 'IRE_EXISTING_NEW_CORRIDOR_PROP' || v.markerLocation !== 'MARK' || v.participantId !== 'DAPHNIE' || ![v.eyeActive, v.markerSeen].every(x => typeof x === 'boolean') || !integer(v.sharedViews) || !integer(v.ordinaryViews)) return false;
    for (const week of [b.consentWeek, v.consentWeek]) if (week !== null && !integer(week, start, s.week)) return false;
    for (const w of [v.player, v.participant]) if (!record(w) || !shape(w, ['location', 'walks', 'distanceMetres']) || !['ROOM', 'MARK'].includes(w.location) || !integer(w.walks) || w.distanceMetres !== w.walks * 6 || (w.walks % 2 === 0) !== (w.location === 'ROOM')) return false;
    let previousWeek = start;
    for (const h of l.history) {
      if (!record(h) || !shape(h, ['caseId', 'week', 'method', 'kind', 'outcome', 'spiritualitySpent', 'sourceId', 'audience', 'effectFactor', 'closed', 'withdrawn']) || !MYSTIC_CASE_IDS.includes(h.caseId) || !integer(h.week, previousWeek, s.week) || !['ORDINARY', 'ABILITY'].includes(h.method) || !['ORDINARY', 'SUCCESS', 'GREAT_SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(h.outcome) || typeof h.closed !== 'boolean' || typeof h.withdrawn !== 'boolean') return false;
      previousWeek = h.week;
      const power = h.caseId === 'sealed-story' || h.method === 'ABILITY';
      const kind = h.caseId === 'sealed-story' ? 'RESEARCH' : h.caseId === 'bell-test' ? h.method === 'ABILITY' ? 'ECHO' : 'BELL_MECHANICS' : h.method === 'ABILITY' ? 'SHARED_SIGHT' : 'WALK_VIEW';
      if (h.kind !== kind || h.sourceId !== (h.caseId === 'shared-eye' ? 'MY4-MARKER-1' : 'MY4-STORY-1') || h.caseId === 'sealed-story' && h.method !== 'ORDINARY' || h.spiritualitySpent !== (power ? 3 : 0) || (h.outcome === 'ORDINARY') === power || ![5, 105].includes(h.audience)) return false;
      if (h.audience === 105 && (!l.publicDisclosed || h.week < st.publicationWeek!) || h.audience === 5 && l.publicDisclosed && h.week > st.publicationWeek!) return false;
      if (h.effectFactor !== (h.kind === 'ECHO' ? h.audience === 105 ? 0.15 : 1 : 0) || h.kind === 'RESEARCH' && h.audience !== 5 || h.kind !== 'RESEARCH' && (!l.echoLearned || h.week < st.learnedWeek!)) return false;
      if (h.withdrawn && h.caseId === 'sealed-story' && success(h.outcome)) return false;
    }
    const research = l.history.filter(h => h.kind === 'RESEARCH' && success(h.outcome));
    if (research.length !== Number(l.echoLearned) || st.learnedWeek !== (research[0]?.week ?? null)) return false;
    let opened = 0, prepared = 0, resolved = 0;
    for (const [i, id] of MYSTIC_CASE_IDS.entries()) {
      const r = l.cases[id], hs = l.history.filter(h => h.caseId === id), h = hs.at(-1);
      if (!record(r) || !shape(r, ['status', 'method', 'observedWeek', 'observations', 'attemptWeek', 'preparations', 'attempts', 'withdrawals', 'closes', 'contactOpen', 'taskComplete', 'withdrawalPending', 'lastOutcome']) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || ![null, 'ORDINARY', 'ABILITY'].includes(r.method) || !['NONE', 'SUCCESS', 'FAILURE', 'WITHDRAWN'].includes(r.lastOutcome) || ![r.contactOpen, r.taskComplete, r.withdrawalPending].every(x => typeof x === 'boolean') || ![r.observations, r.preparations, r.attempts, r.withdrawals, r.closes].every(x => integer(x))) return false;
      if (r.observedWeek !== null && !integer(r.observedWeek, start, s.week) || (r.observedWeek === null) !== (r.observations === 0) || r.attemptWeek !== (h?.week ?? null) || r.attempts !== hs.length || r.closes !== hs.filter(x => x.closed).length || r.preparations < r.attempts || r.withdrawals < hs.filter(x => x.withdrawn).length) return false;
      if (hs.some((x, j) => j > 0 && x.week <= hs[j - 1]!.week) || hs.slice(0, -1).some(x => !x.closed) || r.contactOpen !== (r.status === 'ACTIVE') || Boolean(h && !h.closed) !== r.contactOpen) return false;
      if (r.status === 'AVAILABLE' && stableStringify(r) !== stableStringify(emptyCase()) || r.status !== 'AVAILABLE' && r.observations === 0 || i > 0 && r.status !== 'AVAILABLE' && l.cases[MYSTIC_CASE_IDS[i - 1]!].status !== 'RESOLVED') return false;
      if (['PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) && r.method === null || id === 'sealed-story' && r.method === 'ABILITY' || ['EXAMINED', 'RESOLVED'].includes(r.status) && (!r.taskComplete || !h?.closed) || r.taskComplete && (!h || !success(h.outcome) || h.withdrawn || r.lastOutcome !== 'SUCCESS') || r.withdrawalPending && (id !== 'shared-eye' || !r.contactOpen || !h?.withdrawn || r.taskComplete)) return false;
      if (s.seer.completedSources.filter(x => x === sourceFor(id)).length !== Number(r.status === 'RESOLVED')) return false;
      if (needsConsent(id)) {
        const cw = consentWeek(l, id);
        if (cw !== null && (cw !== r.observedWeek || !['OBSERVED', 'PREPARED', 'ACTIVE'].includes(r.status) || r.withdrawalPending)) return false;
        if (['PREPARED', 'ACTIVE'].includes(r.status) && !r.withdrawalPending && cw === null) return false;
      }
      opened += Number(r.contactOpen); prepared += Number(r.status === 'PREPARED'); resolved += Number(r.status === 'RESOLVED');
    }
    if (opened > 1 || prepared > 1 || opened && prepared) return false;
    const sr = l.cases['sealed-story'], br = l.cases['bell-test'], er = l.cases['shared-eye'];
    const storyOpen = sr.status === 'PREPARED' || sr.contactOpen, bellOpen = br.status === 'PREPARED' || br.contactOpen;
    if ((st.recordLocation === 'TABLE') !== storyOpen || (st.notesLocation === 'TABLE') !== storyOpen || (b.location === 'TABLE') !== (storyOpen || bellOpen) || (st.accessWeek !== null) !== (sr.status !== 'AVAILABLE')) return false;
    const bh = currentAttempt(l, 'bell-test');
    const activeEcho = br.contactOpen && br.taskComplete && br.method === 'ABILITY';
    if (b.echoActive !== activeEcho || b.remainingSeconds !== (activeEcho ? 60 : 0) || b.effectFactor !== (activeEcho ? bh!.effectFactor : 0) || b.ordinaryRings !== l.history.filter(h => h.kind === 'BELL_MECHANICS').length) return false;
    const perception = !bh || bh.kind === 'ECHO' && !success(bh.outcome) ? 'NONE' : bh.kind === 'BELL_MECHANICS' ? 'ORDINARY_RING' : bh.effectFactor === 0.15 ? 'FAINT_DELAYED_SOUND' : 'DELAYED_SOUND';
    if (b.lastPerception !== perception || v.eyeActive !== (er.contactOpen && er.taskComplete && er.method === 'ABILITY')) return false;
    const shared = l.history.filter(h => h.kind === 'SHARED_SIGHT'), ordinary = l.history.filter(h => h.kind === 'WALK_VIEW');
    if (v.sharedViews !== shared.filter(h => success(h.outcome)).length || v.ordinaryViews !== ordinary.length || v.markerSeen !== (v.sharedViews + v.ordinaryViews > 0) || v.participant.walks !== shared.length * 2 - Number(v.participant.location === 'MARK') || v.player.walks !== ordinary.length * 2 - Number(v.player.location === 'MARK')) return false;
    if (v.player.location === 'MARK' && (v.participant.location !== 'ROOM' || !er.contactOpen || er.method !== 'ORDINARY') || v.participant.location === 'MARK' && (!er.contactOpen || er.method !== 'ABILITY')) return false;
    if (hasMysticLifeLock(s) && (s.world.city !== 'BACKLUND' || s.status !== 'ACTIVE' || s.activeEvent || s.combat)) return false;
    if (s.seer.completedSources.filter(x => x === 'mystic-reflection').length !== Number(l.reflected) || l.reflected && resolved !== 3) return false;
    return !promoted(s) || ([3, 2].includes(s.progression.sequence ?? 0)?s.prophecyMaster.mysticActingAtPromotion:s.progression.acting) === resolved * 25 + Number(l.reflected) * 25;
  } catch { return false; }
}
