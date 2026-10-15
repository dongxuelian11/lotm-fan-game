import { stableStringify } from '../canonical.js';
import { awardSeerMastery, type SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';

export const UNDYING_CASE_IDS = ['memory-ledger', 'willing-witness', 'bounded-seal'] as const;
export type UndyingCaseId = typeof UNDYING_CASE_IDS[number];
export type UndyingActivityCommand =
  | { type: 'OBSERVE'; caseId: UndyingCaseId } | { type: 'PERFORM'; caseId: UndyingCaseId }
  | { type: 'CLOSE'; caseId: UndyingCaseId } | { type: 'WITHDRAW'; caseId: UndyingCaseId }
  | { type: 'REPORT'; caseId: UndyingCaseId } | { type: 'STOP_EFFECT'; caseId: UndyingCaseId }
  | { type: 'PREPARE'; caseId: UndyingCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'RETURN_BOOK' } | { type: 'REFLECT' };
export interface UndyingCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED';
  observedWeek: number | null; attemptWeek: number | null; recordedWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null; result: 'NONE' | 'ABILITY' | 'ORDINARY';
  contactOpen: boolean; effectActive: boolean; closes: number; withdrawals: number; stripId: string | null;
}
export interface UndyingMemoryEntry { id: string; sourceId: string; text: string; recordedWeek: number }
export interface UndyingLifeState {
  archiveId: 'UDY4-ARCHIVE'; playerLocation: 'OUTSIDE' | 'DESK' | 'SEAL_BENCH';
  cases: Record<UndyingCaseId, UndyingCaseState>;
  book: { id: 'UDY4-BOOK-1'; owner: 'PLAYER'; location: 'PLAYER' | 'DESK' | 'CARE_CHEST'; blankPages: number; returns: number; placements: number; entries: UndyingMemoryEntry[] };
  witness: { id: 'EVELYN-VOSS'; name: '伊芙琳·沃斯'; age: 44; gender: 'FEMALE'; alive: boolean; willing: boolean; location: 'UDY4-ARCHIVE' | 'AWAY'; agreedWeek: number | null; entryIds: string[]; uncertainty: string | null };
  vessel: { id: 'UDY4-ECHO-VESSEL'; owner: 'ARCHIVE'; quantity: 1; nature: 'LOW_INTENSITY_LOCAL_ECHO'; status: 'ACTIVE' | 'QUIET' | 'CONTAINED' };
  box: { id: 'UDY4-SHIELD-BOX'; owner: 'ARCHIVE'; location: 'SEAL_BENCH'; closed: boolean };
  strips: { id: string; owner: 'PLAYER'; purchasedWeek: number; consumedWeek: number | null; status: 'PLAYER' | 'CONSUMED' }[];
  reflected: boolean;
}
export interface UndyingLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: UndyingActivityCommand }
export interface UndyingLifeProjection {
  title: string; story: string;
  cases: { id: UndyingCaseId; title: string; story: string; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; effectActive: boolean; observations: string[] }[];
  book: UndyingLifeState['book']; witness: UndyingLifeState['witness'];
  seal: { vessel: string; box: string; strips: string[] };
  reflected: boolean; inside: boolean; actions: UndyingLifeAction[];
}
export const UNDYING_LIFE_STORY = '不死者晋升后的记忆准备（原创G）：六十年周期尚未实际经历，登记日期和抄写记忆不等于已死而复生。首次周期可通过独立长期章节实际体验，三步只有限寻回原来源，不保证恢复完整人生记忆。前三项各G扮演25，反思25；观察、准备、实施、报告各1行动，归还、停止、关闭与反思0行动。普通记忆和证人核对只作知识16判定，无能力掌握；封印为有限G借力6灵性/意志18，原封条40便士，失败照耗，成功收束5掌握、报告8。没有任意复活、灵魂还原、永久封印或净化高位物品保证。';
const WITNESS_LIMIT = '伊芙琳仅在本次活着、愿意且在场时核对这三页；她未来的寿命、六十年后是否仍可联络与继续同意均无保证。此记录不重建、删除或保证恢复你的全部自我。';
const CASES: readonly { id: UndyingCaseId; title: string; story: string; facts: string[] }[] = [
  { id: 'memory-ledger', title: '给未来的自己留三页', story: '来到原档案室UDY4-ARCHIVE，亲手把自己唯一原记忆簿UDY4-BOOK-1放在原桌。仅抄录自己确已知道的创建身份、首案公开结果与原灰羽旧交接记录；没有魔法补全未知记忆。', facts: ['唯一原簿归玩家，初有三张空白页；准备时本人携到原桌，结束前须实际拿回。', '条目固定保留原来源、原文与实际记录周，不把未确认的事写成事实。'] },
  { id: 'willing-witness', title: '一个仍愿意作证的人', story: '同一位原独立殓房登记员伊芙琳·沃斯（本阶段登记44岁成年女性，G）当前在原档案室。她只在本人活着、愿意、在场时，把原三页与旧指导和已完成记录当面比较；并未因此变成更高序列或获得跨六十年的寿命保证。', facts: ['先取得原三页；再次亲手把同一本记忆簿放到原桌。', '当前同意可撤回，核对会失败；不是催眠、读心或永远有效的许诺。'] },
  { id: 'bounded-seal', title: '原容器的一次有限安静', story: '档案室原UDY4-ECHO-VESSEL本来装着一份低强度本地躁动回响，归档案室且数量始终1。这里只许可原台面短时核对，可用一次原封条借自己的体内小冥界有限封印，或普通关闭同一个原屏蔽盒。原灰羽不参与，也不会转成玩家新灵体。', facts: ['能力用原封条，6灵性/意志18可失败；不提取特性、净化神性或封印未知高位存在。', '能力停止后原回响重新ACTIVE；普通盒封存为CONTAINED，未使回响本身安静。必须主动STOP_EFFECT并沿普通原路离开。'] },
];
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'death' && [4,3,2,1].includes(s.progression.sequence??0);
const freshCase = (): UndyingCaseState => ({ status: 'AVAILABLE', observedWeek: null, attemptWeek: null, recordedWeek: null, method: null, result: 'NONE', contactOpen: false, effectActive: false, closes: 0, withdrawals: 0, stripId: null });
export function createUndyingLifeState(): UndyingLifeState {
  return { archiveId: 'UDY4-ARCHIVE', playerLocation: 'OUTSIDE', cases: { 'memory-ledger': freshCase(), 'willing-witness': freshCase(), 'bounded-seal': freshCase() },
    book: { id: 'UDY4-BOOK-1', owner: 'PLAYER', location: 'PLAYER', blankPages: 3, returns: 0, placements: 0, entries: [] },
    witness: { id: 'EVELYN-VOSS', name: '伊芙琳·沃斯', age: 44, gender: 'FEMALE', alive: true, willing: true, location: 'UDY4-ARCHIVE', agreedWeek: null, entryIds: [], uncertainty: null },
    vessel: { id: 'UDY4-ECHO-VESSEL', owner: 'ARCHIVE', quantity: 1, nature: 'LOW_INTENSITY_LOCAL_ECHO', status: 'ACTIVE' },
    box: { id: 'UDY4-SHIELD-BOX', owner: 'ARCHIVE', location: 'SEAL_BENCH', closed: false }, strips: [], reflected: false };
}
export const hasUndyingLifeLock = (s: SliceState): boolean => s.undying.life.playerLocation !== 'OUTSIDE' || s.undying.life.book.location !== 'PLAYER' || Object.values(s.undying.life.cases).some(r => r.contactOpen || r.effectActive || r.status === 'PREPARED');
export const undyingInside = hasUndyingLifeLock;
export function validateUndyingActivityCommand(v: unknown): v is UndyingActivityCommand {
  if (!record(v)) return false;
  if (v.type === 'RETURN_BOOK' || v.type === 'REFLECT') return shape(v, ['type']);
  if (!UNDYING_CASE_IDS.includes(v.caseId as UndyingCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  return ['OBSERVE', 'PERFORM', 'CLOSE', 'WITHDRAW', 'REPORT', 'STOP_EFFECT'].includes(String(v.type)) && shape(v, ['type', 'caseId']);
}
export const isUndyingActivityCommand = validateUndyingActivityCommand;
export const isUndyingActivity = validateUndyingActivityCommand;
export const hasUndyingOldPractice = (s: SliceState): boolean => Object.values(s.gatekeeper.cases).some(r => r.contactOpen || r.status === 'PREPARED') || s.gatekeeper.practice.gateOpen || s.gatekeeper.practice.marker !== 'DESK' || s.gatekeeper.companion.status === 'DEPLOYED' || s.gatekeeper.encounter.status === 'FIGHTING';
const present = (s: SliceState) => { const p = s.undying.life.witness; return p.id === 'EVELYN-VOSS' && p.alive && p.willing && p.location === 'UDY4-ARCHIVE'; };
const originalVessel = (s: SliceState) => { const l = s.undying.life; return l.vessel.id === 'UDY4-ECHO-VESSEL' && l.vessel.owner === 'ARCHIVE' && l.vessel.quantity === 1 && l.vessel.nature === 'LOW_INTENSITY_LOCAL_ECHO' && l.box.id === 'UDY4-SHIELD-BOX' && l.box.owner === 'ARCHIVE' && l.box.location === 'SEAL_BENCH'; };
const unusedStrip = (s: SliceState) => s.undying.life.strips.find(x => x.status === 'PLAYER');
/** Only public, already known character and completed history is eligible. No hidden world fields. */
function memoryFacts(s: SliceState): Omit<UndyingMemoryEntry, 'recordedWeek'>[] {
  const m = s.spiritGuide.messenger;
  return [
    { id: 'UDY4-ENTRY-1', sourceId: 'character:creation-identity', text: `我叫${s.character.name}；创建时的出身是${s.character.originName}，职业是${s.character.professionName}，出生地记为${s.character.birthplace.label}。` },
    { id: 'UDY4-ENTRY-2', sourceId: 'first-case:public-resolution', text: s.arc.stage === 'ENDED' ? `首案已公开结束：工人结果${s.arc.workers ?? '未确认'}；责任证据${s.arc.accountability ?? '未确认'}；危险物结果${s.arc.hazard ?? '未确认'}。只记当时公开结果，不补未查明的真相。` : '当前首案尚无公开完成结果；不能把未知结局写成记忆。' },
    { id: 'UDY4-ENTRY-3', sourceId: 'spirit-guide:SG6-GRAY-FEATHER:known-history', text: s.spiritGuide.guidanceKnown ? `旧获准记录中的原灰羽SG6-GRAY-FEATHER：原一次递信约定${m.recruited ? '曾实际自愿接受' : '尚未实际接受'}；旧原信实际交付${m.deliveries}次，原信在${m.letter === 'DESK' ? '原桌' : '原收信人处'}；旧实付${m.feePaid}便士。旧约定不自动延长。` : '尚未取得原灰羽的旧指导记录；不虚构招募或递信历史。' },
  ];
}
const intactEntries = (s: SliceState) => { const expected = memoryFacts(s), entries = s.undying.life.book.entries; return entries.length === 3 && entries.every((e, i) => e.id === expected[i]!.id && e.sourceId === expected[i]!.sourceId && e.text === expected[i]!.text); };
export function blockUndyingLife(s: SliceState, c: UndyingActivityCommand): string | null {
  if(s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))return '旧不死者实践已只读，原三页、原人及周期事实保留。';
  if (!validateUndyingActivityCommand(c)) return '不死者记忆准备命令无效。';
  if (s.status !== 'ACTIVE' || !promoted(s)) return '须仍活着并已经晋升不死者；本阶段不会自动复活。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须本人实际来到贝克兰德原档案室。';
  if (s.undying.ritual.playerLocation !== 'OUTSIDE' || ['READY', 'FIGHTING'].includes(s.undying.encounter.status) || hasUndyingOldPractice(s)) return '先实际收束原仪式、遭遇或旧看门人实践；原灰羽安静INSIDE本身不阻塞。';
  const l = s.undying.life, r = 'caseId' in c ? l.cases[c.caseId] : null;
  if (c.type === 'RETURN_BOOK') return l.book.id === 'UDY4-BOOK-1' && l.book.owner === 'PLAYER' && l.book.location === 'DESK' && l.playerLocation === 'DESK' ? null : '没有本人放在原桌、尚待实际拿回的同一本记忆簿。';
  if (c.type === 'STOP_EFFECT') return c.caseId === 'bounded-seal' && r?.status === 'ACTIVE' && r.contactOpen && r.effectActive && originalVessel(s) ? null : '没有本项尚待停止的有限封印或普通盒检查。';
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') {
    if (!r?.contactOpen || (c.type === 'WITHDRAW' ? r.status !== 'PREPARED' : r.status !== 'ACTIVE')) return '须有对应的本次原现场；未实施准备使用WITHDRAW。';
    if (r.effectActive) return '先0行动STOP_EFFECT实际停止本次封印或盒检查。';
    if (l.book.location !== 'PLAYER') return '先0行动RETURN_BOOK亲手拿回原簿，不能由关闭传送原物。';
    return c.caseId === 'bounded-seal' && !originalVessel(s) ? '原容器或原屏蔽盒来源已不符，不可把未知高位来源当成已收束。' : null;
  }
  if (c.type === 'PERFORM') {
    if (!r || r.status !== 'PREPARED' || !r.contactOpen || r.attemptWeek === s.week) return '须在本次原现场准备，失败下一真实周才能再试。';
    if (!present(s)) return '原伊芙琳须当前活着、愿意并确实在场；旧同意不能代替本人当前答复。';
    if (c.caseId !== 'bounded-seal' && (l.book.location !== 'DESK' || l.playerLocation !== 'DESK')) return '须本人已把唯一原簿放在原桌。';
    if (c.caseId === 'memory-ledger' && (l.book.entries.length || l.book.blankPages !== 3)) return '唯一原三页已被写入，不能覆盖或生成新原簿。';
    if (c.caseId === 'willing-witness' && (!intactEntries(s) || !s.corpsecollector.guidanceKnown || !s.spiritGuide.guidanceKnown)) return '须有可与旧指导和已知原记录实际核对的完整原三页；不把伪造内容变真。';
    if (c.caseId === 'bounded-seal' && (!originalVessel(s) || l.vessel.status !== 'ACTIVE' || l.box.closed)) return '只接受原档案室当前低强回响与原盒，不能替换或净化未知高位存在。';
    if (r.method === 'ABILITY' && (c.caseId !== 'bounded-seal' || !l.strips.some(x => x.id === r.stripId && x.status === 'PLAYER' && x.consumedWeek === null))) return '本次有限封印缺少已实际付款的原封条；记忆任务没有魔法方法。';
    if (r.method === 'ABILITY' && s.spirituality < 6) return '本次需要6灵性，失败照耗；可先取消保留未用原封条。';
  } else {
    if (hasUndyingLifeLock(s)) return '先亲手拿回原簿，或停止封印，再实际关闭并沿原路离开。';
    if (c.type === 'REFLECT') return l.reflected ? '已经完成反思。' : UNDYING_CASE_IDS.some(id => l.cases[id].status !== 'RESOLVED') ? '先完成三项有限报告。' : null;
    if (!r || !('caseId' in c)) return '未知原准备事项。';
    if (r.status === 'RESOLVED') return '原报告已完成，不能重复抄页、同意或成长。';
    const index = UNDYING_CASE_IDS.indexOf(c.caseId);
    if (index > 0 && l.cases[UNDYING_CASE_IDS[index - 1]!].status !== 'RESOLVED') return '先完成前一项真实报告。';
    if (c.type === 'OBSERVE' && r.status !== 'AVAILABLE') return '已经观察过这个原现场。';
    if (c.type === 'PREPARE') {
      if (r.status !== 'OBSERVED' || r.attemptWeek === s.week) return '先观察；失败成本保留，下一真实周才可再准备。';
      if (c.method === 'ABILITY' && c.caseId !== 'bounded-seal') return '原簿与证人只能普通知识核对；不死者没有已核定的魔法记忆恢复能力。';
      if (c.caseId === 'bounded-seal' && (!originalVessel(s) || l.vessel.status !== 'ACTIVE' || l.box.closed)) return '须是同一个仍ACTIVE的低强原回响与未关闭原盒。';
      if (c.method === 'ABILITY' && !unusedStrip(s) && s.cash < 40) return '须有40便士实际购买一条原封条，不能免费补给。';
    }
    if (c.type === 'REPORT' && r.status !== 'EXAMINED') return '先取得实际结果、拿回原簿或停止封印并沿原路离开。';
    if (!present(s)) return '原伊芙琳须当前活着、愿意并在场。';
  }
  return s.health <= 0 || s.mind <= 0 ? '先恢复身体与精神；归还、停止和退出仍为0行动。' : s.actionsRemaining < 1 ? '本次需要1行动。' : null;
}
export function applyUndyingActivity(s: SliceState, c: UndyingActivityCommand, ctx: SeerContext): void {
  const reason = blockUndyingLife(s, c); if (reason) throw new Error(reason);
  const l = s.undying.life;
  if (c.type === 'RETURN_BOOK') { l.book.location = 'PLAYER'; l.book.returns++; ctx.note('亲手拿回同一本原记忆簿', '你在原桌前把UDY4-BOOK-1拿回自己手中；旧三页和物权不变，没有副本或自动传送。'); return; }
  if (c.type === 'STOP_EFFECT') { const r = l.cases[c.caseId]; r.effectActive = false; if (r.method === 'ABILITY') l.vessel.status = 'ACTIVE'; ctx.note('实际停止本次有限作用', r.method === 'ABILITY' ? '撤去对原容器的有限借力，原回响重新ACTIVE；原封条仍已消耗，不是永久治愈。' : '停止普通盒检查；若原盒已实际关上，它仍CONTAINED，未让其中回响本身安静。'); return; }
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') { const r = l.cases[c.caseId]; r.contactOpen = false; l.playerLocation = 'OUTSIDE';
    if (c.type === 'WITHDRAW') { r.status = 'OBSERVED'; r.method = null; r.withdrawals++; r.stripId = null; }
    else { r.closes++; r.status = r.result === 'NONE' ? 'OBSERVED' : 'EXAMINED'; if (r.result === 'ABILITY') awardSeerMastery(s, `undying-practice:${c.caseId}`, 5, ctx); }
    ctx.note('本人沿原普通出口离开档案室', c.type === 'WITHDRAW' ? '取消未实施准备，已付行动与费用不退；未用的同一原封条留在本人手中供下次准备，原簿已实际取回。' : '原簿已实际取回、有限作用已停止，原物归属不变。失败须下一真实周重试，实际成本保留；没有任何死亡、失忆或复活在这次准备中发生。'); return;
  }
  if (c.type === 'REFLECT') { l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('undying-reflection'); ctx.note('记忆、证人与有限封印的边界', '原三页与当前见证保留，六十年周期尚未实际经历；未来遗忘和逐渐恢复仍待实现。G扮演+25，不保证他人永生、完整恢复自我、普通死亡后复活或高位物品净化。'); return; }
  s.actionsRemaining--;
  const r = l.cases[c.caseId], p = CASES.find(x => x.id === c.caseId)!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; r.observedWeek = s.week; ctx.note(p.title, p.story + ' ' + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') {
    r.status = 'PREPARED'; r.method = c.method; r.stripId = null; r.contactOpen = true; l.playerLocation = c.caseId === 'bounded-seal' ? 'SEAL_BENCH' : 'DESK';
    if (c.caseId !== 'bounded-seal') { l.book.location = 'DESK'; l.book.placements++; }
    if (c.method === 'ABILITY') { let strip = unusedStrip(s); if (!strip) { strip = { id: `UDY4-STRIP-${l.strips.length + 1}`, owner: 'PLAYER', purchasedWeek: s.week, consumedWeek: null, status: 'PLAYER' }; s.cash -= 40; l.strips.push(strip); } r.stripId = strip.id; }
    ctx.note(p.title, c.caseId !== 'bounded-seal' ? '本人沿原路到原桌，实际把唯一UDY4-BOOK-1放下；这次1行动尚未写入、作证或授予能力掌握。' : c.method === 'ABILITY' ? `本人走到原台，取用已实付40便士的唯一原封条${r.stripId}；实施才消耗，失败也不会归还。原灰羽保持原处。` : '本人走到原台，只准备使用档案室同一个普通屏蔽盒；没有封条费用或灵性消耗。'); return;
  }
  if (c.type === 'REPORT') { r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); const source = `undying-case:${c.caseId}`; if (r.result === 'ABILITY') awardSeerMastery(s, source, 8, ctx); else s.seer.completedSources.push(source); ctx.note(p.title, '报告已经实际完成且收束的有限结果，G扮演+25。' + (r.result === 'ABILITY' ? '能力报告单项掌握+8；只验证原低强回响一度安静，并非永久封印。' : '普通知识工作不授能力掌握，也不保证记忆永久完整或证人永远可联络。')); return; }
  r.status = 'ACTIVE'; r.attemptWeek = s.week; r.result = 'NONE'; r.recordedWeek = null;
  const ability = r.method === 'ABILITY';
  if (ability) { s.spirituality -= 6; const strip = l.strips.find(x => x.id === r.stripId)!; strip.status = 'CONSUMED'; strip.consumedWeek = s.week; }
  if (c.caseId === 'bounded-seal') r.effectActive = true;
  const result = ctx.check(ability ? 'will' : 'knowledge', ability ? 18 : 16), success = result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS';
  if (success) { r.result = r.method!; r.recordedWeek = s.week;
    if (c.caseId === 'memory-ledger') { l.book.entries = memoryFacts(s).map(x => ({ ...x, recordedWeek: s.week })); l.book.blankPages = 0; }
    if (c.caseId === 'willing-witness') { l.witness.agreedWeek = s.week; l.witness.entryIds = l.book.entries.map(x => x.id); l.witness.uncertainty = WITNESS_LIMIT; }
    if (c.caseId === 'bounded-seal') { l.vessel.status = ability ? 'QUIET' : 'CONTAINED'; l.box.closed = !ability; }
  }
  ctx.note(p.title, success ? c.caseId === 'memory-ledger' ? '三张原空白页已逐项写入真实已知来源与本周日期，文字保持固定；请亲手取回原簿再关闭。没有恢复未知记忆或保证完整自我。' : c.caseId === 'willing-witness' ? '当前本人把同一原三页与旧可见记录当面对照并同意本次见证。' + WITNESS_LIMIT + '请实际取回原簿再关闭。' : ability ? '已耗1行动、6灵性和同一原封条，原低强回响暂为QUIET。须明确停止后回到ACTIVE，不是永久净化；原灰羽未被调用。' : '知识核对后亲手关闭同一原盒，原容器现为CONTAINED，回响没有被能力安静。须停止检查再实际退出。' : '本次核对失败，没有生成条目、见证或安静结果。行动、实付灵性与原封条成本保留；先拿回原簿或停止作用并退出，下一真实周再试。');
}
export function undyingLifeActions(s: SliceState): UndyingLifeAction[] {
  if (!promoted(s) || (s.progression.sequence === 2||s.progression.sequence===1)) return [];
  const out: UndyingLifeAction[] = [], l = s.undying.life;
  const add = (id: string, label: string, cost: string, command: UndyingActivityCommand) => { const reason = blockUndyingLife(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const p of CASES) { const r = l.cases[p.id];
    if (r.status === 'AVAILABLE') add(`${p.id}-observe`, '观察原记录、本人同意与原物', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') { add(`${p.id}-ordinary`, p.id === 'bounded-seal' ? '准备原普通盒封存' : '携原簿到原桌，准备普通知识核对', '1行动 · 实施知识16 · 无能力掌握', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' }); if (p.id === 'bounded-seal') add(`${p.id}-ability`, '准备有限冥界借力封印', unusedStrip(s) ? '1行动 · 用本人未耗原封条 · 已付40便士' : '1行动 · 实付40便士买一条原封条', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' }); }
    if (r.status === 'PREPARED') { add(`${p.id}-perform`, '实际实施本次有限核对', r.method === 'ABILITY' ? '1行动 · 6灵性 · 意志18 · 实耗原封条' : '1行动 · 知识16 · 无能力掌握', { type: 'PERFORM', caseId: p.id }); add(`${p.id}-withdraw`, '取消准备并沿原路离开', '0行动 · 原簿须先取回 · 不退款', { type: 'WITHDRAW', caseId: p.id }); }
    if (r.effectActive) add(`${p.id}-stop`, '停止封印或普通盒检查', '0行动 · 不永久净化', { type: 'STOP_EFFECT', caseId: p.id });
    if (r.status === 'ACTIVE') add(`${p.id}-close`, '结束原现场并沿原路离开', '0行动 · 先取回原簿或停止效果', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'EXAMINED') add(`${p.id}-report`, '报告已收束的真实有限结果', '1行动 · G扮演25', { type: 'REPORT', caseId: p.id });
  }
  if (l.book.location === 'DESK') add('undying-return-book', '亲手拿回同一本原记忆簿', '0行动 · 原桌到本人手中', { type: 'RETURN_BOOK' });
  if (!l.reflected) add('undying-reflect', '反思原记忆、当前见证与周期未经历', '0行动 · 三案后G扮演25', { type: 'REFLECT' });
  return out;
}
export function projectUndyingLife(s: SliceState): UndyingLifeProjection {
  const l = s.undying.life;
  return { title: '为尚未来临的遗忘做准备', story: UNDYING_LIFE_STORY, cases: CASES.map(p => { const r = l.cases[p.id]; return { id: p.id, title: p.title, story: p.story, status: r.status, method: r.method, result: r.attemptWeek === null ? null : r.result === 'NONE' ? '本次失败，成本保留；实际退出后下一真实周可重试。' : p.id === 'memory-ledger' ? '同一本原簿三页已写入实际已知事实。' : p.id === 'willing-witness' ? '原伊芙琳当前亲自核对三页并作有限见证。' : r.result === 'ABILITY' ? '原低强回响曾暂时QUIET；停止封印后重新ACTIVE。' : '原普通盒实际CONTAINED，未使回响本身安静。', contactOpen: r.contactOpen, effectActive: r.effectActive, observations: r.observedWeek === null ? [] : [...p.facts] }; }), book: { ...l.book, entries: l.book.entries.map(x => ({ ...x })) }, witness: { ...l.witness, entryIds: [...l.witness.entryIds] }, seal: { vessel: `${l.vessel.id} · 档案室所有 · 原低强回响1份 · ${l.vessel.status}`, box: `${l.box.id} · 档案室原台面 · ${l.box.closed ? '已实际关闭，普通封存' : '原盒未关闭'}`, strips: l.strips.map(x => `${x.id} · 第${x.purchasedWeek}周实付40便士 · ${x.status === 'PLAYER' ? '本人持有未用原条' : `第${x.consumedWeek}周实际消耗`}`) }, reflected: l.reflected, inside: hasUndyingLifeLock(s), actions: undyingLifeActions(s) };
}
export function validateUndyingLife(s: SliceState): boolean {
  const l = s.undying?.life, base = createUndyingLifeState(), promotion = s.undying?.promotionWeek;
  if (!record(l) || !shape(l, Object.keys(base)) || !record(l.cases) || !shape(l.cases, UNDYING_CASE_IDS)) return false;
  for (const key of ['book', 'witness', 'vessel', 'box'] as const) if (!record(l[key]) || !shape(l[key], Object.keys(base[key]))) return false;
  if (!Array.isArray(l.book.entries) || !Array.isArray(l.witness.entryIds) || !Array.isArray(l.strips)) return false;
  if (promotion === null) return stableStringify(l) === stableStringify(base);
  if (!integer(promotion, 1, s.week) || !promoted(s) || l.archiveId !== 'UDY4-ARCHIVE' || !['OUTSIDE', 'DESK', 'SEAL_BENCH'].includes(l.playerLocation) || !originalVessel(s)) return false;
  const book = l.book, witness = l.witness;
  if (book.id !== 'UDY4-BOOK-1' || book.owner !== 'PLAYER' || !['PLAYER', 'DESK', 'CARE_CHEST'].includes(book.location) || !integer(book.returns) || !integer(book.placements) || book.placements - book.returns !== (book.location === 'DESK' ? 1 : 0) || ![0, 3].includes(book.blankPages)) return false;
  if (book.location === 'CARE_CHEST' && (!s.longChapter || s.longChapter.bookDeposits - s.longChapter.bookWithdrawals !== 1 || !['PREPARING', 'RESIDING', 'CYCLE_DEAD', 'AMNESIAC', 'PARTIAL_RECOVERY'].includes(s.longChapter.phase))) return false;
  if (witness.id !== 'EVELYN-VOSS' || witness.name !== '伊芙琳·沃斯' || witness.age !== 44 || witness.gender !== 'FEMALE' || typeof witness.alive !== 'boolean' || typeof witness.willing !== 'boolean' || !['UDY4-ARCHIVE', 'AWAY'].includes(witness.location) || typeof l.box.closed !== 'boolean' || !['ACTIVE', 'QUIET', 'CONTAINED'].includes(l.vessel.status)) return false;
  let open = 0, resolved = 0;
  for (const [i, id] of UNDYING_CASE_IDS.entries()) { const r = l.cases[id];
    if (!record(r) || !shape(r, Object.keys(freshCase())) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result) || r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || typeof r.contactOpen !== 'boolean' || typeof r.effectActive !== 'boolean' || !integer(r.closes) || !integer(r.withdrawals) || r.stripId !== null && typeof r.stripId !== 'string') return false;
    if (r.status === 'AVAILABLE') { if (stableStringify(r) !== stableStringify(freshCase())) return false; continue; }
    if (!integer(r.observedWeek, promotion, s.week) || [r.attemptWeek, r.recordedWeek].some(w => w !== null && !integer(w, r.observedWeek!, s.week)) || i > 0 && l.cases[UNDYING_CASE_IDS[i - 1]!].status !== 'RESOLVED') return false;
    if (id !== 'bounded-seal' && (r.method === 'ABILITY' || r.result === 'ABILITY' || r.effectActive || r.stripId !== null)) return false;
    if (r.result !== 'NONE' && r.result !== r.method || (r.result === 'NONE') !== (r.recordedWeek === null) || r.recordedWeek !== null && r.recordedWeek !== r.attemptWeek) return false;
    if ((r.status === 'PREPARED' || r.status === 'ACTIVE') !== r.contactOpen || r.effectActive && (id !== 'bounded-seal' || r.status !== 'ACTIVE')) return false;
    if (r.contactOpen) { open++; if (r.method === null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND' || s.activeEvent || s.combat || l.playerLocation !== (id === 'bounded-seal' ? 'SEAL_BENCH' : 'DESK')) return false; }
    if (r.status === 'PREPARED' && (r.result !== 'NONE' || r.attemptWeek === s.week) || r.status === 'ACTIVE' && r.attemptWeek !== s.week || r.status === 'OBSERVED' && r.result !== 'NONE') return false;
    if (['EXAMINED', 'RESOLVED'].includes(r.status) && (r.result === 'NONE' || r.closes < 1 || r.effectActive)) return false;
    if (r.status === 'RESOLVED') resolved++;
    if (s.seer.completedSources.filter(x => x === `undying-case:${id}`).length !== (r.status === 'RESOLVED' ? 1 : 0) || s.seer.completedSources.filter(x => x === `undying-practice:${id}`).length !== (r.result === 'ABILITY' && ['EXAMINED', 'RESOLVED'].includes(r.status) ? 1 : 0)) return false;
  }
  if (open > 1 || (l.playerLocation === 'OUTSIDE') !== (open === 0) || book.location === 'DESK' && l.playerLocation !== 'DESK') return false;
  const memory = l.cases['memory-ledger'], testimony = l.cases['willing-witness'], seal = l.cases['bounded-seal'];
  if (memory.result === 'NONE' ? book.entries.length !== 0 || book.blankPages !== 3 : !intactEntries(s) || book.blankPages !== 0) return false;
  if (book.entries.some(e => !record(e) || !shape(e, ['id', 'sourceId', 'text', 'recordedWeek']) || e.recordedWeek !== memory.recordedWeek)) return false;
  if (testimony.result === 'NONE' ? witness.agreedWeek !== null || witness.entryIds.length !== 0 || witness.uncertainty !== null : witness.agreedWeek !== testimony.recordedWeek || stableStringify(witness.entryIds) !== stableStringify(book.entries.map(e => e.id)) || witness.uncertainty !== WITNESS_LIMIT) return false;
  if (l.vessel.status !== (seal.result === 'ORDINARY' ? 'CONTAINED' : seal.result === 'ABILITY' && seal.effectActive ? 'QUIET' : 'ACTIVE') || l.box.closed !== (seal.result === 'ORDINARY')) return false;
  if (l.strips.filter(x => x.status === 'PLAYER').length > 1) return false;
  for (const [i, strip] of l.strips.entries()) { if (!record(strip) || !shape(strip, ['id', 'owner', 'purchasedWeek', 'consumedWeek', 'status']) || strip.id !== `UDY4-STRIP-${i + 1}` || strip.owner !== 'PLAYER' || !integer(strip.purchasedWeek, promotion, s.week) || !['PLAYER', 'CONSUMED'].includes(strip.status) || (strip.status === 'PLAYER' ? strip.consumedWeek !== null : !integer(strip.consumedWeek, strip.purchasedWeek, s.week)) || i > 0 && (l.strips[i - 1]!.consumedWeek === null || strip.purchasedWeek <= l.strips[i - 1]!.consumedWeek!)) return false; }
  if (seal.stripId !== null) { const strip = l.strips.find(x => x.id === seal.stripId); if (!strip || seal.method !== 'ABILITY' || (seal.status === 'PREPARED' ? strip.status !== 'PLAYER' : strip.status !== 'CONSUMED' || strip.consumedWeek !== seal.attemptWeek)) return false; }
  if (seal.method === 'ABILITY' && seal.stripId === null || l.strips.some(x => x.consumedWeek !== null && (seal.attemptWeek === null || x.consumedWeek > seal.attemptWeek))) return false;
  return typeof l.reflected === 'boolean' && (!l.reflected || resolved === 3) && s.seer.completedSources.filter(x => x === 'undying-reflection').length === (l.reflected ? 1 : 0) && ((s.progression.sequence===3||(s.progression.sequence===2||s.progression.sequence===1))?s.ferryman.undyingActingAtPromotion:s.progression.acting) === resolved * 25 + (l.reflected ? 25 : 0);
}
