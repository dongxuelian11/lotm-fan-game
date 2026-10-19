import type { SliceState } from '../slice/types.js';
import { awardSeerMastery, type SeerContext } from '../seer/index.js';
import { stableStringify } from '../canonical.js';
import { applySpiritWarlockActivity } from '../spirit-warlock/life.js';

export const NIGHTWATCHER_CASE_IDS = ['uneven-cart', 'paired-dream', 'leaf-signal'] as const;
export type NightwatcherCaseId = typeof NIGHTWATCHER_CASE_IDS[number];
export type NightwatcherActivityCommand =
  | { type: 'OBSERVE'; caseId: NightwatcherCaseId }
  | { type: 'PREPARE'; caseId: NightwatcherCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: NightwatcherCaseId }
  | { type: 'REPORT'; caseId: NightwatcherCaseId }
  | { type: 'CLOSE'; caseId: NightwatcherCaseId }
  | { type: 'WITHDRAW'; caseId: NightwatcherCaseId }
  | { type: 'STOP_EFFECT'; caseId: NightwatcherCaseId }
  | { type: 'RETURN_CART' } | { type: 'RETURN_NOTE' } | { type: 'RECALL_SPIRIT' }
  | { type: 'INVITE_SPIRIT' } | { type: 'RELEASE_SPIRIT' } | { type: 'REFLECT' };
export interface NightwatcherCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED';
  observedWeek: number | null; attemptWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; effectActive: boolean; closes: number; withdrawals: number;
}
export interface NightwatcherPerson {
  id: 'SW5-MASON' | 'NW4-ILVA'; name: string; age: number; alive: boolean; willing: boolean; location: 'NW4-YARD';
  asleep: boolean; lastDream: 'NONE' | 'SLEPT' | 'RESISTED' | 'CONVERSATION';
}
export interface NightwatcherLifeState {
  cases: Record<NightwatcherCaseId, NightwatcherCaseState>;
  yardId: 'NW4-YARD';
  cart: { id: 'NW4-CART'; owner: 'MASON'; location: 'START' | 'SHORT' | 'END'; wheel: 'UNEVEN'; rolls: number; returns: number; finding: boolean };
  people: { mason: NightwatcherPerson; ilva: NightwatcherPerson };
  practice: { playerLocation: 'BODYCHAIR'; concentration: boolean; note: { id: 'NW4-NOTE-1'; owner: 'SELINE'; location: 'TABLE' | 'RECIPIENT' }; deliveries: number; returns: number };
  reflected: boolean;
}
export interface NightwatcherLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: NightwatcherActivityCommand }
export interface NightwatcherLifeProjection {
  title: string; story: string;
  cases: { id: NightwatcherCaseId; title: string; story: string; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; observations: string[] }[];
  yardId: 'NW4-YARD'; cart: NightwatcherLifeState['cart']; people: NightwatcherLifeState['people']; practice: NightwatcherLifeState['practice'];
  companion: SliceState['spiritWarlock']['companion']; reflected: boolean; inside: boolean; actions: NightwatcherLifeAction[];
}
export const NIGHTWATCHER_LIFE_STORY = '三项有限实践均为原创G：观察、准备、实施、报告各1行动，停止、召回、原物归还、结束及取消0行动。三案各扮演25，反思25；实际能力成功掌握5、能力报告掌握8，普通对照不授能力掌握。厄运可能失败，范围入梦逐人抵抗；梦中叙述只是当事人报告，不保证真话或提供精神治疗。没有免费灵体库、灵界旅行、复活、窃取、寄生或序列3恐惧攻击。';
const CASES = [
  { id: 'uneven-cart', title: '同一辆空车的两米短程', story: '原成年值班员梅森（34岁）自愿借出自己的普通空车NW4-CART。原练习院NW4-YARD地面安全、平整，只有车上一个已看见的不匀车轮。沿两米净空短程滚动时，有限厄运可能使既有车轮卡顿而停短；失败则照常到END，不制造损坏或伤人。普通方法亲手检查同一个车轴。', facts: ['能力4灵性、意志16；成功停在SHORT，失败到END，均须本人实际推回START。', '普通检查知识14、0灵性，记录原车轴观察，不把普通结果写成施法。'] },
  { id: 'paired-dream', title: '两张原长椅上的各自答复', story: '梅森34岁与伊尔瓦·雷恩29岁是两位原成年志愿者，分别坐在彼此四米范围内的原长椅。他们只同意本次短暂梦境，随时可停止。你本体固定在BODYCHAIR；对两人分别检验，可能只有一人入睡，也可能两人都抵抗。普通方法是两人清醒时的联合讨论。', facts: ['范围入梦5灵性、每位意志16独立检验；至少一人实际入睡才有有限能力结果。', 'STOP_EFFECT只唤醒本次实际对象；不抹记忆、不治疗。所有人清醒才能结束。'] },
  { id: 'leaf-signal', title: '同一个卷叶与新原纸条', story: '赛琳所有的新原轻纸NW4-NOTE-1放在原桌上，与旧SW5-NOTE-1是两张不同原物。你短暂维持自己的有限梦境专注，本体仍在原椅；只有早先实际取得并SEALED的同一个SW5-LEAF-1才能受托沿净空两米携这张新纸给自愿接收的梅森。普通方法由本人实际步行交付。', facts: ['能力3灵性、意志16；失败也实际派出原灵并记次数，但纸条仍在原桌。', '先停止梦境专注，再实际召回原灵、本人两米步行取回同一新纸；关闭按钮不移动人、灵或纸。', '旧SW5-NOTE-1及旧协作记录不变。原灵已释放时，可另花1行动3灵性、意志14再次邀请同一原灵，每真实周一次。'] },
] as const;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'darkness' && [4,3,2].includes(s.progression.sequence??0);
const freshCase = (): NightwatcherCaseState => ({ status: 'AVAILABLE', observedWeek: null, attemptWeek: null, method: null, result: 'NONE', contactOpen: false, effectActive: false, closes: 0, withdrawals: 0 });
export function createNightwatcherLifeState(): NightwatcherLifeState {
  return { cases: { 'uneven-cart': freshCase(), 'paired-dream': freshCase(), 'leaf-signal': freshCase() }, yardId: 'NW4-YARD',
    cart: { id: 'NW4-CART', owner: 'MASON', location: 'START', wheel: 'UNEVEN', rolls: 0, returns: 0, finding: false },
    people: { mason: { id: 'SW5-MASON', name: '梅森', age: 34, alive: true, willing: true, location: 'NW4-YARD', asleep: false, lastDream: 'NONE' }, ilva: { id: 'NW4-ILVA', name: '伊尔瓦·雷恩', age: 29, alive: true, willing: true, location: 'NW4-YARD', asleep: false, lastDream: 'NONE' } },
    practice: { playerLocation: 'BODYCHAIR', concentration: false, note: { id: 'NW4-NOTE-1', owner: 'SELINE', location: 'TABLE' }, deliveries: 0, returns: 0 }, reflected: false };
}
export const hasNightwatcherLifeLock = (s: SliceState): boolean => Object.values(s.nightwatcher.life.cases).some(r => r.contactOpen) || s.nightwatcher.life.cart.location !== 'START' || s.nightwatcher.life.practice.concentration || s.nightwatcher.life.practice.note.location !== 'TABLE' || Object.values(s.nightwatcher.life.people).some(p => p.asleep);
export const nightwatcherInside = hasNightwatcherLifeLock;
/** Only the original acquisition can own this deployment; this is not a registry or a spirit grant. */
export function nightwatcherOwnsOriginalLeafDeployment(s: SliceState): boolean {
  const c = s.spiritWarlock.companion, n = s.nightwatcher;
  if (!n || s.progression.pathwayId !== 'darkness' || s.progression.sequence !== 4 || c.source !== 'SW5-LEAF-1' || c.acquiredWeek === null || c.status !== 'DEPLOYED' || c.deployments !== c.recalls + 1) return false;
  const r = n.life.cases['leaf-signal'];
  return r.contactOpen && r.status === 'ACTIVE' && r.method === 'ABILITY' && r.attemptWeek === s.week && !s.combat ||
    n.encounter.status === 'FIGHTING' && s.combat?.encounterId === 'NIGHTWATCHER_DISPUTE' && n.encounter.attemptWeek === s.week;
}
export function validateNightwatcherActivityCommand(v: unknown): v is NightwatcherActivityCommand {
  if (!record(v)) return false;
  if (['RETURN_CART', 'RETURN_NOTE', 'RECALL_SPIRIT', 'INVITE_SPIRIT', 'RELEASE_SPIRIT', 'REFLECT'].includes(String(v.type))) return shape(v, ['type']);
  if (!NIGHTWATCHER_CASE_IDS.includes(v.caseId as NightwatcherCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  return ['OBSERVE', 'PERFORM', 'REPORT', 'CLOSE', 'WITHDRAW', 'STOP_EFFECT'].includes(String(v.type)) && shape(v, ['type', 'caseId']);
}
export const isNightwatcherActivityCommand = validateNightwatcherActivityCommand;
export const isNightwatcherActivity = validateNightwatcherActivityCommand;
const originalSealed = (s: SliceState) => s.spiritWarlock.companion.source === 'SW5-LEAF-1' && s.spiritWarlock.companion.acquiredWeek !== null && s.spiritWarlock.companion.status === 'SEALED';
export function blockNightwatcherLife(s: SliceState, c: NightwatcherActivityCommand): string | null {
  if([3,2].includes(s.progression.sequence??0))return '旧守夜人实践已只读，原人原物与同一卷叶的经历保留。';
  if (!validateNightwatcherActivityCommand(c)) return '守夜人实践命令无效。';
  if (s.status !== 'ACTIVE' || !promoted(s)) return '须仍活着并已经成为守夜人。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际回到贝克兰德原练习院。';
  if (['READY', 'FIGHTING'].includes(s.nightwatcher.encounter.status) || s.nightwatcher.ritual.playerLocation === 'HALL') return '先实际结束仪式现场或和平离开原遭遇。';
  const l = s.nightwatcher.life, f = l.practice, r = 'caseId' in c ? l.cases[c.caseId] : null;
  if (c.type === 'RETURN_CART') return l.cases['uneven-cart'].contactOpen && l.cart.location !== 'START' ? null : '没有仍需沿原两米路推回的同一辆原空车。';
  if (c.type === 'RETURN_NOTE') return l.cases['leaf-signal'].contactOpen && f.note.location === 'RECIPIENT' && !f.concentration ? null : '先停止自身梦境专注；须有实际交给梅森、尚待取回的新原纸。';
  if (c.type === 'RECALL_SPIRIT') return nightwatcherOwnsOriginalLeafDeployment(s) ? null : '本次没有实际派出的同一个原卷叶，不能凭空召回。';
  if (c.type === 'STOP_EFFECT') return r?.contactOpen && r.effectActive ? null : '没有本项仍待停止的实际效果。';
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW' && r?.contactOpen) return !r?.contactOpen ? '没有本项尚未结束的原现场。' : r.effectActive || f.concentration || l.cart.location !== 'START' || f.note.location !== 'TABLE' || Object.values(l.people).some(p => p.asleep) || nightwatcherOwnsOriginalLeafDeployment(s) ? '先实际停止效果、唤醒对象、召回原灵并归还原物；结束不会移动或治疗。' : null;
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚未实施的准备。';
  if (hasNightwatcherLifeLock(s)) return '先0行动实际停止效果、归还原物、召回原灵并结束当前现场。';
  if (Object.values(s.spiritWarlock.cases).some(v => v.contactOpen || v.status === 'PREPARED') || s.spiritWarlock.practice.dreamOpen || s.spiritWarlock.practice.note !== 'TABLE' || s.spiritWarlock.companion.status === 'DEPLOYED') return '旧灵巫现场或原灵派出尚未真实收束。';
  if (c.type === 'RELEASE_SPIRIT') return originalSealed(s) && !Object.values(l.cases).some(v => v.status === 'PREPARED') ? null : '仅可在无准备、无接触时释放实际SEALED的同一个原卷叶。';
  if (s.health <= 0 || s.mind <= 0) return '先休养身体与精神。';
  if (Object.entries(l.cases).some(([id, v]) => v.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先实施或取消另一项准备。';
  if (s.actionsRemaining < 1) return '本次需要1行动。';
  if (c.type === 'INVITE_SPIRIT') { const old = s.spiritWarlock.companion; return !['AVAILABLE', 'RELEASED'].includes(old.status) || old.source !== 'SW5-LEAF-1' || s.spiritWarlock.cases['listening-leaves']!.status === 'AVAILABLE' ? '须是早先亲自认识、现在自由活动的同一个原卷叶。' : old.invitedWeek === s.week ? '本周答复保留，下一真实周才可再邀请。' : s.spirituality < 3 ? '邀请需要3灵性。' : null; }
  if (c.type === 'REFLECT') return l.reflected ? '已经反思。' : NIGHTWATCHER_CASE_IDS.some(id => l.cases[id].status !== 'RESOLVED') ? '先完成三个真实报告。' : null;
  if (!r || !('caseId' in c)) return '未知原实践。';
  const index = NIGHTWATCHER_CASE_IDS.indexOf(c.caseId);
  if (r.status === 'RESOLVED') return '本项已报告，不能重置原物或重复成长。';
  if (index > 0 && l.cases[NIGHTWATCHER_CASE_IDS[index - 1]!].status !== 'RESOLVED') return '先完成前一项原实践报告。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '原现场已经观察。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察原现场。' : r.attemptWeek === s.week ? '本周成本和结果保留，下一真实周再准备。' : null;
  if (c.type === 'REPORT') return r.status === 'EXAMINED' && r.result !== 'NONE' ? null : '先取得真实结果并实际收束现场。';
  if (r.status !== 'PREPARED' || r.attemptWeek === s.week) return '先准备本次实践，不能同周重复实施。';
  const required = c.caseId === 'paired-dream' ? Object.values(l.people) : [l.people.mason];
  if (required.some(p => !p.alive || !p.willing || p.location !== 'NW4-YARD' || p.asleep)) return '原成年对象须仍活着、清醒、自愿且在原院；可以0行动取消。';
  if (r.method === 'ABILITY' && c.caseId === 'leaf-signal' && !originalSealed(s)) return '需要早先实际取得且仍封入的SW5-LEAF-1；没有免费替代灵，可取消选择普通步行。';
  const cost = c.caseId === 'uneven-cart' ? 4 : c.caseId === 'paired-dream' ? 5 : 3;
  return r.method === 'ABILITY' && s.spirituality < cost ? `本次需要${cost}灵性；可0行动取消。` : null;
}
const succeeded = (tier: string) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
export function applyNightwatcherActivity(s: SliceState, c: NightwatcherActivityCommand, ctx: SeerContext): void {
  const reason = blockNightwatcherLife(s, c); if (reason) throw new Error(reason);
  const l = s.nightwatcher.life, f = l.practice, spirit = s.spiritWarlock.companion;
  if (c.type === 'INVITE_SPIRIT' || c.type === 'RELEASE_SPIRIT') { applySpiritWarlockActivity(s, c, ctx, () => {}); return; }
  if (c.type === 'RETURN_CART') { l.cart.location = 'START'; l.cart.returns++; ctx.note('本人实际推回同一原空车', '0行动沿同一两米净空路把NW4-CART推回START，原不匀车轮仍在；不是传送、修复或重置原物。'); return; }
  if (c.type === 'RETURN_NOTE') { f.note.location = 'TABLE'; f.returns++; ctx.note('本人实际取回新原紙条', '停止梦境后本人沿两米原路步行，梅森亲手交还同一NW4-NOTE-1，再走回原椅与原桌；纸仍属赛琳，旧SW5-NOTE-1及旧记录不变。'); return; }
  if (c.type === 'RECALL_SPIRIT') { spirit.status = 'SEALED'; spirit.recalls++; ctx.note('同一个原卷叶实际回到牙齿休息', '0行动召回SW5-LEAF-1并记录一次真实召回；不取回纸、不停止梦境、不移动本体或免费增加灵。'); return; }
  if (c.type === 'STOP_EFFECT') { l.cases[c.caseId].effectActive = false; if (c.caseId === 'paired-dream') for (const p of Object.values(l.people)) p.asleep = false; if (c.caseId !== 'uneven-cart') f.concentration = false; ctx.note('实际停止本项有限效果', '0行动停止；本次实际睡着的志愿者在原椅醒来，本体仍在原BODYCHAIR。原物位置、付费、各自梦境答复保留，不抹记忆、不治疗。'); return; }
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW' && l.cases[c.caseId].contactOpen) { const r = l.cases[c.caseId]; r.contactOpen = false; r.closes++; r.status = r.result === 'NONE' ? 'OBSERVED' : 'EXAMINED'; ctx.note('实际结束原现场', '本人、对象、原物与原灵均已收束，成本和结果保留。失败须下一真实周再试；关闭不移动身体或补资源。'); return; }
  if (c.type === 'WITHDRAW') { const r = l.cases[c.caseId]; r.status = 'OBSERVED'; r.method = null; r.withdrawals++; ctx.note('取消尚未实施的准备', '0行动取消，已付观察与准备不退款；没有施法、派灵或搬动原物。'); return; }
  s.actionsRemaining--;
  if (c.type === 'REFLECT') { l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('nightwatcher-reflection'); ctx.note('守夜人的有限边界', '三案已真实收束，G扮演+25。厄运和梦境可以失败，帮助来自原人同意与实际取得的原灵，不是恐惧主教、免费旅行或复活。'); return; }
  const p = CASES.find(p => p.id === c.caseId)!, r = l.cases[c.caseId];
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; r.observedWeek = s.week; ctx.note(p.title, p.story + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = c.method; ctx.note(p.title, c.method === 'ABILITY' ? '已付1行动选择有限能力；实施仍要核对原成年对象的当前同意及实际资源，可0行动取消。' : '已付1行动选择普通真实对照；不把普通观察、谈话或步行记为能力成功。'); return; }
  if (c.type === 'REPORT') { r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); const source = `nightwatcher-case:${p.id}`; if (r.result === 'ABILITY') awardSeerMastery(s, source, 8, ctx); else s.seer.completedSources.push(source); ctx.note(p.title, '报告已收束的真实结果，G扮演+25；' + (r.result === 'ABILITY' ? '能力报告单项掌握+8。' : '普通方法无能力掌握。') + '不能再重置本案成长。'); return; }
  r.status = 'ACTIVE'; r.attemptWeek = s.week; r.contactOpen = true; r.result = 'NONE'; r.effectActive = false;
  const ability = r.method === 'ABILITY'; if (ability) s.spirituality -= c.caseId === 'uneven-cart' ? 4 : c.caseId === 'paired-dream' ? 5 : 3;
  let ok = false;
  if (c.caseId === 'uneven-cart') {
    ok = succeeded(ctx.check(ability ? 'will' : 'knowledge', ability ? 16 : 14).tier);
    if (ability) { l.cart.rolls++; l.cart.location = ok ? 'SHORT' : 'END'; r.effectActive = ok; } else if (ok) l.cart.finding = true;
    ctx.note(p.title, ability ? ok ? '既有不匀车轮这次卡顿，原空车在SHORT停短，须实际推回。' : '有限厄运失败，原空车正常滚到END，没有伤人或虚构损坏，仍须实际推回。' : ok ? '亲手检查原车轴并记录了可見的不匀，空车仍在START。' : '原车轴检查未形成充分记录，原空车仍在START。');
  } else if (c.caseId === 'paired-dream') {
    if (ability) { for (const key of ['mason', 'ilva'] as const) { const person = l.people[key]; person.asleep = succeeded(ctx.check('will', 16).tier); person.lastDream = person.asleep ? 'SLEPT' : 'RESISTED'; } ok = Object.values(l.people).some(person => person.asleep); r.effectActive = ok; f.concentration = ok; }
    else { for (const person of Object.values(l.people)) person.lastDream = 'CONVERSATION'; ok = succeeded(ctx.check('knowledge', 14).tier); }
    ctx.note(p.title, ability ? `梅森${l.people.mason.asleep ? '实际入睡' : '保持清醒、抵抗成功'}；伊尔瓦${l.people.ilva.asleep ? '实际入睡' : '保持清醒、抵抗成功'}。${ok ? '形成有限结果，须停止并唤醒实际睡着的人。' : '两人都未入睡，没有梦境结果。'}` : '两人始终清醒，进行普通联合讨论；没有施加梦境或治疗。');
  } else {
    if (ability) { spirit.status = 'DEPLOYED'; spirit.deployments++; f.concentration = true; r.effectActive = true; ok = succeeded(ctx.check('will', 16).tier); if (ok) { f.note.location = 'RECIPIENT'; f.deliveries++; } }
    else { f.note.location = 'RECIPIENT'; f.deliveries++; ok = succeeded(ctx.check('knowledge', 14).tier); }
    ctx.note(p.title, ability ? `同一个SW5-LEAF-1已实际派出，本人固定原椅维持自己的有限梦境专注。${ok ? '原灵沿两米路将NW4-NOTE-1交给梅森。' : '协作检验失败，新原纸仍在原桌；已派出的原灵仍须实际召回。'}须先停止专注、召回原灵，纸如已交付须本人实际取回。` : '本人已沿两米原路实际交付NW4-NOTE-1并回到原椅。普通核对即使失败，也不撤销交付，仍须本人实际取回。');
  }
  if (ok) { r.result = r.method!; if (ability) awardSeerMastery(s, `nightwatcher-practice:${p.id}`, 5, ctx); }
  ctx.note('本次实践成本与事实保留', ok ? '取得本次有限结果，先实际收束再报告。' : '已付行动和灵性不退款，无能力掌握；先实际收束，下一真实周才可重试。');
}
export function nightwatcherLifeActions(s: SliceState): NightwatcherLifeAction[] {
  if (s.progression.pathwayId !== 'darkness' || s.progression.sequence !== 4) return [];
  const out: NightwatcherLifeAction[] = [], l = s.nightwatcher.life;
  const add = (id: string, label: string, cost: string, command: NightwatcherActivityCommand) => { const reason = blockNightwatcherLife(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (['AVAILABLE', 'RELEASED'].includes(s.spiritWarlock.companion.status)) add('nightwatcher-invite', '再次邀请同一个原卷叶', '1行动 · 3灵性 · 意志14 · 每真实周一次', { type: 'INVITE_SPIRIT' });
  if (s.spiritWarlock.companion.status === 'SEALED') add('nightwatcher-release', '自愿释放同一个原卷叶', '0行动 · 原来源与历史保留', { type: 'RELEASE_SPIRIT' });
  if (nightwatcherOwnsOriginalLeafDeployment(s)) add('nightwatcher-recall', '实际召回同一个原卷叶', '0行动 · 不移动本体或原纸', { type: 'RECALL_SPIRIT' });
  if (l.cart.location !== 'START') add('nightwatcher-return-cart', '本人沿原路推回同一空车', '0行动 · 同一两米原路', { type: 'RETURN_CART' });
  if (l.practice.note.location === 'RECIPIENT') add('nightwatcher-return-note', '本人步行取回同一新原纸', '0行动 · 先停止自身梦境专注', { type: 'RETURN_NOTE' });
  for (const p of CASES) {
    const r = l.cases[p.id];
    if (r.status === 'AVAILABLE') add(`${p.id}-observe`, '观察原现场与本人同意', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') for (const method of ['ABILITY', 'ORDINARY'] as const) add(`${p.id}-${method}`, method === 'ABILITY' ? '准备有限能力实践' : '准备普通真实对照', '1行动 · 可以0行动取消', { type: 'PREPARE', caseId: p.id, method });
    if (r.status === 'PREPARED') { add(`${p.id}-perform`, '实际实施本次实践', `1行动 · ${r.method === 'ORDINARY' ? '0灵性 · 知识14' : p.id === 'uneven-cart' ? '4灵性 · 意志16' : p.id === 'paired-dream' ? '5灵性 · 两人各自意志16' : '3灵性 · 意志16 · 同一原卷叶实际派出'}`, { type: 'PERFORM', caseId: p.id }); add(`${p.id}-withdraw`, '取消尚未实施的准备', '0行动 · 不退款', { type: 'WITHDRAW', caseId: p.id }); }
    if (r.contactOpen) { if (r.effectActive) add(`${p.id}-stop`, '实际停止本项有限效果', '0行动 · 不移动原物 · 唤醒实际对象', { type: 'STOP_EFFECT', caseId: p.id }); add(`${p.id}-close`, '实际结束本次原现场', '0行动 · 先停止、召回与归还', { type: 'CLOSE', caseId: p.id }); }
    if (r.status === 'EXAMINED') add(`${p.id}-report`, '报告本次实际结果', '1行动 · G扮演25 · 普通方法无能力掌握', { type: 'REPORT', caseId: p.id });
  }
  if (!l.reflected) add('nightwatcher-reflect', '回看有限厄运、梦境与原灵', '1行动 · 三案报告后G扮演25', { type: 'REFLECT' });
  return out;
}
export function projectNightwatcherLife(s: SliceState): NightwatcherLifeProjection {
  const l = s.nightwatcher.life;
  return { title: '守夜人的有限原现场实践', story: NIGHTWATCHER_LIFE_STORY, cases: CASES.map(p => { const r = l.cases[p.id]; return { id: p.id, title: p.title, story: p.story, status: r.status, method: r.method, result: r.attemptWeek === null ? null : `实际尝试第${r.attemptWeek}周；${r.result === 'NONE' ? '未得充分结果，成本保留' : r.result === 'ABILITY' ? '有限能力实际成功' : '普通对照实际结果'}。`, contactOpen: r.contactOpen, observations: r.observedWeek === null ? [] : [...p.facts] }; }), yardId: l.yardId, cart: { ...l.cart }, people: { mason: { ...l.people.mason }, ilva: { ...l.people.ilva } }, practice: { ...l.practice, note: { ...l.practice.note } }, companion: { ...s.spiritWarlock.companion }, reflected: l.reflected, inside: hasNightwatcherLifeLock(s), actions: nightwatcherLifeActions(s) };
}
export function validateNightwatcherLife(s: SliceState): boolean {
  const l = s.nightwatcher?.life, initial = createNightwatcherLifeState(), promotion = s.nightwatcher?.promotionWeek;
  if (!record(l) || !shape(l, Object.keys(initial)) || !record(l.cases) || !shape(l.cases, NIGHTWATCHER_CASE_IDS) || !record(l.cart) || !shape(l.cart, Object.keys(initial.cart)) || !record(l.people) || !shape(l.people, ['mason', 'ilva']) || !record(l.practice) || !shape(l.practice, Object.keys(initial.practice)) || !record(l.practice.note) || !shape(l.practice.note, Object.keys(initial.practice.note))) return false;
  if (promotion === null) return stableStringify(l) === stableStringify(initial);
  if (!integer(promotion, 1, s.week) || l.yardId !== 'NW4-YARD') return false;
  const cart = l.cart, f = l.practice;
  if (cart.id !== 'NW4-CART' || cart.owner !== 'MASON' || cart.wheel !== 'UNEVEN' || !['START', 'SHORT', 'END'].includes(cart.location) || !integer(cart.rolls) || !integer(cart.returns, 0, cart.rolls) || cart.rolls - cart.returns !== (cart.location === 'START' ? 0 : 1) || typeof cart.finding !== 'boolean' || f.playerLocation !== 'BODYCHAIR' || typeof f.concentration !== 'boolean' || f.note.id !== 'NW4-NOTE-1' || f.note.owner !== 'SELINE' || !['TABLE', 'RECIPIENT'].includes(f.note.location) || !integer(f.deliveries) || !integer(f.returns, 0, f.deliveries) || f.deliveries - f.returns !== (f.note.location === 'TABLE' ? 0 : 1)) return false;
  for (const key of ['mason', 'ilva'] as const) { const p = l.people[key], base = initial.people[key]; if (!record(p) || !shape(p, Object.keys(base)) || p.id !== base.id || p.name !== base.name || p.age !== base.age || p.location !== 'NW4-YARD' || typeof p.alive !== 'boolean' || typeof p.willing !== 'boolean' || typeof p.asleep !== 'boolean' || !['NONE', 'SLEPT', 'RESISTED', 'CONVERSATION'].includes(p.lastDream) || p.asleep && (!p.alive || p.lastDream !== 'SLEPT')) return false; }
  let open = 0, prepared = 0, resolved = 0;
  for (const [index, id] of NIGHTWATCHER_CASE_IDS.entries()) {
    const r = l.cases[id];
    if (!record(r) || !shape(r, Object.keys(freshCase())) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result) || r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || !integer(r.closes) || !integer(r.withdrawals) || typeof r.contactOpen !== 'boolean' || typeof r.effectActive !== 'boolean') return false;
    if (r.status === 'AVAILABLE') { if (stableStringify(r) !== stableStringify(freshCase())) return false; continue; }
    if (!integer(r.observedWeek, promotion, s.week) || r.attemptWeek !== null && !integer(r.attemptWeek, r.observedWeek, s.week) || index > 0 && l.cases[NIGHTWATCHER_CASE_IDS[index - 1]!].status !== 'RESOLVED') return false;
    if (r.status === 'PREPARED') { prepared++; if (r.method === null || r.attemptWeek === s.week || r.contactOpen || r.result !== 'NONE') return false; }
    if (r.contactOpen) { open++; if (r.status !== 'ACTIVE' || r.attemptWeek !== s.week || r.method === null || s.activeEvent || s.combat || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND') return false; }
    if (r.effectActive && (!r.contactOpen || r.method !== 'ABILITY')) return false;
    if (r.status === 'ACTIVE' && !r.contactOpen || r.attemptWeek === null && (r.closes > 0 || r.result !== 'NONE') || r.result !== 'NONE' && r.result !== r.method) return false;
    if (['EXAMINED', 'RESOLVED'].includes(r.status) && (r.contactOpen || r.effectActive || r.result === 'NONE' || r.closes < 1)) return false;
    if (r.status === 'RESOLVED') resolved++;
    if (s.seer.completedSources.filter(x => x === `nightwatcher-case:${id}`).length !== (r.status === 'RESOLVED' ? 1 : 0) || s.seer.completedSources.filter(x => x === `nightwatcher-practice:${id}`).length !== (r.result === 'ABILITY' ? 1 : 0)) return false;
  }
  if (s.progression.pathwayId === 'darkness' && s.progression.sequence === 2 && (open || prepared || hasNightwatcherLifeLock(s))) return false;
  const cartCase = l.cases['uneven-cart'], dream = l.cases['paired-dream'], leaf = l.cases['leaf-signal'];
  if (open > 1 || prepared > 1 || open && prepared || cart.location !== 'START' && (!cartCase.contactOpen || cartCase.method !== 'ABILITY') || cart.rolls > cartCase.closes + (cartCase.contactOpen ? 1 : 0) || cart.finding !== (cartCase.result === 'ORDINARY') || f.deliveries > leaf.closes + (leaf.contactOpen ? 1 : 0) || f.note.location === 'RECIPIENT' && !leaf.contactOpen) return false;
  if (f.concentration !== (dream.effectActive || leaf.effectActive) || Object.values(l.people).some(p => p.asleep) !== dream.effectActive || dream.result === 'ABILITY' && !Object.values(l.people).some(p => p.lastDream === 'SLEPT') || dream.result === 'ORDINARY' && Object.values(l.people).some(p => p.lastDream !== 'CONVERSATION')) return false;
  if (leaf.attemptWeek !== null && leaf.method === 'ABILITY' && leaf.status !== 'PREPARED' && (s.spiritWarlock.companion.acquiredWeek === null || s.spiritWarlock.companion.acquiredWeek > leaf.attemptWeek || s.spiritWarlock.companion.deployments < 1) || leaf.result !== 'NONE' && f.deliveries < 1) return false;
  if (!leaf.contactOpen && nightwatcherOwnsOriginalLeafDeployment(s) && s.combat?.encounterId !== 'NIGHTWATCHER_DISPUTE') return false;
  return typeof l.reflected === 'boolean' && (!l.reflected || resolved === 3) && s.seer.completedSources.filter(x => x === 'nightwatcher-reflection').length === (l.reflected ? 1 : 0) && (!promoted(s) || ([3,2].includes(s.progression.sequence??0)?s.fearBishop.nightwatcherActingAtPromotion:s.progression.acting) === resolved * 25 + (l.reflected ? 25 : 0));
}
