import { stableStringify } from '../canonical.js';
import { awardSeerMastery, type SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { applyProphetInheritedFlash, blockProphetInheritedFlash, mysticismMagisterCrafts } from '../mysticism-magister/life.js';

export const PROPHET_CASE_IDS = ['loose-shutter', 'blue-door', 'uncertain-helper'] as const;
export type ProphetCaseId = typeof PROPHET_CASE_IDS[number];
export const PROPHET_PERSON_IDS = ['PF4-NORA', 'PF4-EDWIN', 'PF4-JONAS'] as const;
export type ProphetPersonId = typeof PROPHET_PERSON_IDS[number];
export type ProphetHypothesis = 'HARD_DAMAGE' | 'LOOSE_FASTENER' | 'DELAYED_DELIVERY' | 'PERSON_HURT' | 'RECENT_CONTACT';
export type ProphetActivityCommand =
  | { type: 'OBSERVE'; caseId: ProphetCaseId } | { type: 'PERFORM'; caseId: ProphetCaseId }
  | { type: 'CLOSE'; caseId: ProphetCaseId } | { type: 'WITHDRAW'; caseId: ProphetCaseId }
  | { type: 'REPORT'; caseId: ProphetCaseId } | { type: 'STOP_EFFECT'; caseId: ProphetCaseId }
  | { type: 'VERIFY'; caseId: ProphetCaseId }
  | { type: 'PREPARE'; caseId: ProphetCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'INTERPRET'; caseId: ProphetCaseId; hypothesis: ProphetHypothesis }
  | { type: 'SECURE_SHUTTER' } | { type: 'RETURN_PAGES' } | { type: 'REFLECT' } | { type: 'MAKE_FLASH' }
  | { type: 'MEET_HELPER'; personId: ProphetPersonId } | { type: 'ASK_HELP'; personId: ProphetPersonId };
export interface ProphetCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'WAITING' | 'VERIFIED' | 'RESOLVED';
  observedWeek: number | null; attemptWeek: number | null; recordedWeek: number | null; verifiedWeek: number | null;
  method: 'ABILITY' | 'ORDINARY' | null; result: 'NONE' | 'ABILITY' | 'ORDINARY';
  hypothesis: ProphetHypothesis | null; actual: 'NONE' | 'STABLE' | 'RATTLED' | 'PARCEL_RECEIVED' | 'PIN_REPAIRED';
  contactOpen: boolean; effectActive: boolean; closes: number; withdrawals: number;
}
export interface ProphetPerson {
  id: ProphetPersonId; name: string; age: number; alive: boolean; willing: boolean; location: 'PF4-HALL' | 'POST';
  metWeek: number | null; askedWeek: number | null; reply: 'NONE' | 'PAPERS' | 'CARRYING' | 'REPAIR';
}
export interface ProphetLifeState {
  cases: Record<ProphetCaseId, ProphetCaseState>; hallId: 'PF4-HALL';
  playerLocation: 'OUTSIDE' | 'WORKAREA' | 'QUIET_ROOM';
  shutter: { id: 'PF4-SHUTTER'; owner: 'PF4-NORA'; pin: 'LOOSE' | 'SOUND'; openingWeek: number | null; repairWeek: number | null };
  pages: { id: 'PF4-PAGES'; owner: 'PF4-NORA'; location: 'TABLE' | 'FLOOR'; returns: number };
  strap: { id: 'PF4-STRAP-1'; owner: 'PF4-NORA'; location: 'NORA' | 'SHUTTER'; usedWeek: number | null };
  door: { id: 'PF4-BLUE-DOOR'; owner: 'PF4-NORA'; location: 'PF4-HALL' };
  parcel: { id: 'PF4-PARCEL'; owner: 'PF4-NORA'; sender: 'NORAS_COLLEAGUE'; location: 'POST' | 'NORA'; deliveredWeek: number | null; handovers: number };
  pliers: { id: 'PF4-PLIERS'; owner: 'PF4-JONAS'; location: 'JONAS'; uses: number };
  people: Record<ProphetPersonId, ProphetPerson>; reflected: boolean;
}
export interface ProphetLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: ProphetActivityCommand }
export interface ProphetLifeProjection {
  title: string; story: string; cases: { id: ProphetCaseId; title: string; story: string; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; effectActive: boolean; observations: string[]; forecast: string | null; hypothesis: string | null; actual: string | null; observedWeek: number | null; recordedWeek: number | null; verifiedWeek: number | null }[];
  objects: { shutter: string; pages: string; strap: string; parcel: string; door: string; pliers: string };
  people: { id: ProphetPersonId; name: string; age: number; alive: boolean; willing: boolean; location: string; interview: string | null; asked: boolean }[];
  crafts: ReturnType<typeof mysticismMagisterCrafts>; reflected: boolean; inside: boolean; actions: ProphetLifeAction[];
}
export const PROPHET_LIFE_STORY = '原著边界：预言与梦中图像是片段，需要解释、真实相遇和事后调查，不能保证避祸。以下三案、人物、物件及所有数值为原创G。观察、准备、实施、核实、报告各1行动；真实访谈每人1行动；解释、停止、加固、归还、结束、取消与反思0行动。能力4灵性/意志16，普通核对知识14。结束后至少跨一个真实周才能核实，等待期间普通生活开放。三案各扮演25，反思25；能力成功单项掌握5、能力报告8，普通方法无能力掌握。';
const CASES: readonly { id: ProphetCaseId; title: string; story: string; facts: string[]; fragment: string; ordinary: string; hypotheses: ProphetHypothesis[] }[] = [
  { id: 'loose-shutter', title: '木响与散页', story: '成年诺拉·海斯（38岁）在原会馆PF4-HALL同意你观察自己的原百叶窗PF4-SHUTTER。可见旧销松动，桌上只有她的一叠PF4-PAGES；一米内净空，没有旁观者。她提供唯一原扎带PF4-STRAP-1，是否先实际加固由你选择。稍后本人再来，看她按普通安排开窗。', facts: ['原窗旧销当前松动；原页在原桌，一米净空可手工捡回。', '加固只用掉诺拉同意提供的一条原扎带，不修复旧销，也不保证任何灾难预言。'], fragment: '木响与散页', ordinary: '当面检查了当前可见的旧松销，尚未发生后来的开窗。', hypotheses: ['HARD_DAMAGE', 'LOOSE_FASTENER'] },
  { id: 'blue-door', title: '蓝门框与迟来的脚步', story: '在同一会馆原安静房，你只记录自己的一段短梦。原蓝门PF4-BLUE-DOOR属于诺拉；她同事寄来的唯一包裹PF4-PARCEL现在还在邮局，预期由成年邮差埃德温·里德（43岁）普通步行送来。梦不进入他人头脑，不能宣布某人受伤。', facts: ['只读当前普通交接便条，或记录自己的短梦；不是窥视尚未发生的事实。', '能力后须明确STOP_EFFECT再CLOSE；之后普通等待，下一真实周本人回访才会实际交接。'], fragment: '蓝门框、迟来的脚步', ordinary: '读到当前普通交接便条：邮局存有诺拉同事寄来的那一件原包裹。', hypotheses: ['DELAYED_DELIVERY', 'PERSON_HURT'] },
  { id: 'uncertain-helper', title: '近日结识的人', story: '前两项报告完成后，回看有限片段与真实经历。会馆有三位有限原成年熟人可逐一当面交谈：诺拉、埃德温与乔纳斯·佩尔（57岁）。片段不会给出帮手姓名、技能或承诺；须实际听他们说愿意做什么，再询问是否帮助修同一个旧窗销。', facts: ['只有三位原成年人，各一次实际访谈；不从未知人群生成万能帮手。', '询问只针对本人真实技能和当下同意；原窗、原工具与所有权不因预言复制或转移。'], fragment: '近日结识的人可能帮得上忙', ordinary: '回看前两项实际报告，拟当面询问原熟人，而不是预知谁必定帮忙。', hypotheses: ['RECENT_CONTACT'] },
];
const HYPOTHESIS_TEXT: Record<ProphetHypothesis, string> = { HARD_DAMAGE: '猜测：窗体会严重损坏（未证实）', LOOSE_FASTENER: '猜测：可能只是旧销松动（未证实）', DELAYED_DELIVERY: '猜测：脚步可能指迟到的交付（未证实）', PERSON_HURT: '猜测：可能有人受伤（未证实）', RECENT_CONTACT: '猜测：近期熟人或许能帮忙，身份和能力仍未知' };
const REPLIES = { PAPERS: '诺拉当面说愿意整理纸页，没有修销手艺；这次不能承担修理。', CARRYING: '埃德温当面说愿意搬运，没有修销手艺；这次不能承担修理。', REPAIR: '乔纳斯当面说明自己是退休木匠，持有自己的PF4-PLIERS，愿意为诺拉修这一个松销。', NONE: '' };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'white-tower' && [4,3,2].includes(s.progression.sequence??0);
const freshCase = (): ProphetCaseState => ({ status: 'AVAILABLE', observedWeek: null, attemptWeek: null, recordedWeek: null, verifiedWeek: null, method: null, result: 'NONE', hypothesis: null, actual: 'NONE', contactOpen: false, effectActive: false, closes: 0, withdrawals: 0 });
export function createProphetLifeState(): ProphetLifeState {
  return { cases: { 'loose-shutter': freshCase(), 'blue-door': freshCase(), 'uncertain-helper': freshCase() }, hallId: 'PF4-HALL', playerLocation: 'OUTSIDE',
    shutter: { id: 'PF4-SHUTTER', owner: 'PF4-NORA', pin: 'LOOSE', openingWeek: null, repairWeek: null }, pages: { id: 'PF4-PAGES', owner: 'PF4-NORA', location: 'TABLE', returns: 0 },
    strap: { id: 'PF4-STRAP-1', owner: 'PF4-NORA', location: 'NORA', usedWeek: null }, door: { id: 'PF4-BLUE-DOOR', owner: 'PF4-NORA', location: 'PF4-HALL' },
    parcel: { id: 'PF4-PARCEL', owner: 'PF4-NORA', sender: 'NORAS_COLLEAGUE', location: 'POST', deliveredWeek: null, handovers: 0 }, pliers: { id: 'PF4-PLIERS', owner: 'PF4-JONAS', location: 'JONAS', uses: 0 },
    people: { 'PF4-NORA': { id: 'PF4-NORA', name: '诺拉·海斯', age: 38, alive: true, willing: true, location: 'PF4-HALL', metWeek: null, askedWeek: null, reply: 'NONE' }, 'PF4-EDWIN': { id: 'PF4-EDWIN', name: '埃德温·里德', age: 43, alive: true, willing: true, location: 'POST', metWeek: null, askedWeek: null, reply: 'NONE' }, 'PF4-JONAS': { id: 'PF4-JONAS', name: '乔纳斯·佩尔', age: 57, alive: true, willing: true, location: 'PF4-HALL', metWeek: null, askedWeek: null, reply: 'NONE' } }, reflected: false };
}
export const hasProphetLifeLock = (s: SliceState): boolean => Object.values(s.prophet.life.cases).some(r => r.contactOpen || r.effectActive) || s.prophet.life.playerLocation !== 'OUTSIDE';
export const prophetInside = hasProphetLifeLock;
export function validateProphetActivityCommand(v: unknown): v is ProphetActivityCommand {
  if (!record(v)) return false;
  if (['SECURE_SHUTTER', 'RETURN_PAGES', 'REFLECT', 'MAKE_FLASH'].includes(String(v.type))) return shape(v, ['type']);
  if (v.type === 'MEET_HELPER' || v.type === 'ASK_HELP') return shape(v, ['type', 'personId']) && PROPHET_PERSON_IDS.includes(v.personId as ProphetPersonId);
  if (!PROPHET_CASE_IDS.includes(v.caseId as ProphetCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  if (v.type === 'INTERPRET') return shape(v, ['type', 'caseId', 'hypothesis']) && CASES.find(p => p.id === v.caseId)!.hypotheses.includes(v.hypothesis as ProphetHypothesis);
  return ['OBSERVE', 'PERFORM', 'CLOSE', 'WITHDRAW', 'REPORT', 'STOP_EFFECT', 'VERIFY'].includes(String(v.type)) && shape(v, ['type', 'caseId']);
}
export const isProphetActivityCommand = validateProphetActivityCommand;
export const isProphetActivity = validateProphetActivityCommand;
const present = (p: ProphetPerson) => p.alive && p.willing && p.location === 'PF4-HALL';
export function blockProphetLife(s: SliceState, c: ProphetActivityCommand): string | null {
  if([3, 2].includes(s.progression.sequence ?? 0))return '旧预言家实践已只读，原片段、解释和后来事实保留。';
  if (!validateProphetActivityCommand(c)) return '预言家实践命令无效。';
  if (s.status !== 'ACTIVE' || !promoted(s)) return '须仍活着并已经成为预言家。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际来到贝克兰德原会馆。';
  if (['READY', 'FIGHTING'].includes(s.prophet.encounter.status) || s.prophet.ritual.playerLocation === 'HALL') return '先实际离开仪式或原遭遇。';
  const l = s.prophet.life, r = 'caseId' in c ? l.cases[c.caseId] : null;
  if (c.type === 'STOP_EFFECT') return r?.contactOpen && r.effectActive ? null : '没有本项仍待停止的自身短梦。';
  if (c.type === 'INTERPRET') return r?.contactOpen && r.result !== 'NONE' && r.hypothesis === null ? null : '须在本次成功记录后、结束前写一项尚未证实的解释，不能事后改写猜测。';
  if (c.type === 'SECURE_SHUTTER') return l.cases['loose-shutter'].contactOpen && l.strap.location === 'NORA' && present(l.people['PF4-NORA']) ? null : '须在原窗现场、诺拉当前同意且唯一原扎带尚未用掉。';
  if (c.type === 'CLOSE') return !r?.contactOpen ? '没有本项尚未结束的现场。' : r.effectActive ? '先0行动STOP_EFFECT结束自身短梦。' : r.result !== 'NONE' && r.hypothesis === null ? '先写明一项有限猜测；不能把图像直接当事实。' : null;
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '只可取消尚未实施的准备；已记录的安排须实际结束并稍后核实。';
  if (hasProphetLifeLock(s)) return '先停止短梦、写明有限解释并CLOSE实际结束当前现场。';
  if (Object.values(s.mysticismMagister.cases).some(v => v.contactOpen || v.status === 'PREPARED') || s.mysticismMagister.practice.dreamOpen || s.mysticismMagister.practice.token !== 'OWNER') return '旧秘术导师接触与原衣角尚未收束。';
  if (c.type === 'RETURN_PAGES') return l.pages.location === 'FLOOR' && present(l.people['PF4-NORA']) ? null : '须有实际落在一米内原地面的同一叠纸页和诺拉当前同意。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神。';
  if (Object.entries(l.cases).some(([id, v]) => v.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先实施或取消另一项准备。';
  if (c.type === 'REFLECT') return l.reflected ? '已经完成反思。' : PROPHET_CASE_IDS.some(id => l.cases[id].status !== 'RESOLVED') ? '先完成三个事后核实报告。' : null;
  if (c.type === 'MAKE_FLASH') return blockProphetInheritedFlash(s);
  if (c.type === 'MEET_HELPER' || c.type === 'ASK_HELP') {
    const helper = l.cases['uncertain-helper'], p = l.people[c.personId];
    if (helper.status !== 'WAITING' || helper.recordedWeek === null || s.week <= helper.recordedWeek) return '先结束帮手片段的记录，并跨一个真实周再实际访谈。';
    if (!present(p)) return '这位原成年人须当前活着、愿意且确实在原会馆；不能远程替他说话。';
    if (c.type === 'MEET_HELPER') return p.metWeek !== null ? '这位原人的实际访谈已保留，不重复刷同一回答。' : s.actionsRemaining < 1 ? '实际访谈需要1行动。' : null;
    if (p.metWeek === null || p.reply === 'NONE') return '先实际与这位原人当面访谈，不能由预言自动识别帮手。';
    if (p.askedWeek !== null) return '本人的这次答复与实际行动已经保留。';
    if (l.shutter.pin === 'SOUND') return '同一个原窗销已经实际修好。';
    return present(l.people['PF4-NORA']) ? null : '原物主人诺拉须当前在场同意修理。';
  }
  if (s.actionsRemaining < 1) return '本次需要1行动。';
  if (!r || !('caseId' in c)) return '未知原实践。';
  const index = PROPHET_CASE_IDS.indexOf(c.caseId);
  if (r.status === 'RESOLVED') return '本案已报告，不重置原物、猜测或成长。';
  if (index > 0 && l.cases[PROPHET_CASE_IDS[index - 1]!].status !== 'RESOLVED') return '先完成前一项实际报告。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' && present(l.people['PF4-NORA']) ? null : '须是尚未观察的原现场，诺拉当前在场并同意。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察原现场。' : r.attemptWeek === s.week ? '本周成本保留，下一真实周才能再试。' : null;
  if (c.type === 'REPORT') return r.status !== 'VERIFIED' || r.actual === 'NONE' ? '先在真实后续周回访核实。' : l.pages.location !== 'TABLE' ? '先手工捡回原纸页，不能用报告代替归还。' : null;
  if (c.type === 'VERIFY') {
    if (r.status !== 'WAITING' || r.recordedWeek === null || s.week <= r.recordedWeek) return '须先CLOSE，然后至少跨一个真实周再本人回访；等待不封锁普通生活。';
    if (!present(l.people['PF4-NORA'])) return '须实际回访仍活着、愿意且在原会馆的诺拉。';
    if (c.caseId === 'uncertain-helper') return l.shutter.pin === 'SOUND' && l.shutter.repairWeek !== null ? null : '须先真实访谈、询问并由有能力且自愿的原人实际完成修理。';
    if (c.caseId === 'blue-door') { const p = l.people['PF4-EDWIN']; return p.alive && p.willing && p.location === 'POST' && l.parcel.location === 'POST' ? null : '原邮差须活着、自愿并与那一件原包裹同在邮局，才能普通步行实际送达。'; }
    return null;
  }
  if (r.status !== 'PREPARED' || r.attemptWeek === s.week) return '先准备本次实践，不能同周反复实施。';
  if (!present(l.people['PF4-NORA'])) return '原物主人须仍在场同意本次观察。';
  return r.method === 'ABILITY' && s.spirituality < 4 ? '本次有限片段需要4灵性，失败也照耗；可以0行动取消。' : null;
}
export function applyProphetActivity(s: SliceState, c: ProphetActivityCommand, ctx: SeerContext): void {
  const reason = blockProphetLife(s, c); if (reason) throw new Error(reason);
  const l = s.prophet.life;
  if (c.type === 'MAKE_FLASH') { applyProphetInheritedFlash(s, ctx); return; }
  if (c.type === 'STOP_EFFECT') { l.cases[c.caseId].effectActive = false; ctx.note('结束自己的有限短梦', '0行动明确结束本次自身效果，原身体仍在原安静房；没有进入他人梦境或获得未来事实。'); return; }
  if (c.type === 'INTERPRET') { l.cases[c.caseId].hypothesis = c.hypothesis; ctx.note('记录尚未证实的解释', HYPOTHESIS_TEXT[c.hypothesis] + '。解释锁定于事前，后来的实际观察会另列，不倒改梦像或猜测。'); return; }
  if (c.type === 'SECURE_SHUTTER') { l.strap.location = 'SHUTTER'; l.strap.usedWeek = s.week; ctx.note('实际用掉唯一原扎带', '诺拉在场同意，你伸手在一米净空作业位把PF4-STRAP-1系在同一PF4-SHUTTER上；原扎带已用，旧销仍松，没有造出第二条或直接修复。'); return; }
  if (c.type === 'RETURN_PAGES') { l.pages.location = 'TABLE'; l.pages.returns++; ctx.note('本人捡回同一叠原纸页', '经诺拉同意，本人普通步行到一米内原地面，手工把PF4-PAGES捡回原桌再离开；不复制、传送或奖励新纸。'); return; }
  if (c.type === 'CLOSE') { const r = l.cases[c.caseId]; r.contactOpen = false; r.closes++; r.status = r.result === 'NONE' ? 'OBSERVED' : 'WAITING'; l.playerLocation = 'OUTSIDE'; ctx.note('结束观察并沿原路离开', r.result === 'NONE' ? '原成本保留，下一真实周才可再准备；普通生活开放。' : '片段与事前猜测保留，尚无后来事实。你普通步行离开，等待期间可工作、休养或推进真实周，稍后须实际回访核实。'); return; }
  if (c.type === 'WITHDRAW') { const r = l.cases[c.caseId]; r.status = 'OBSERVED'; r.method = null; r.withdrawals++; ctx.note('取消未实施准备', '0行动取消；观察和准备行动不退款，未生成片段或改变原物。'); return; }
  if (c.type === 'REFLECT') { l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('prophet-reflection'); ctx.note('片段、解释与事实各有边界', '三案事后事实已核实，G扮演+25。图像可能误读，帮忙来自实际相遇、本人技能与同意；没有全知未来、改写命运或更高阶新能力。'); return; }
  if (c.type === 'ASK_HELP') { const p = l.people[c.personId]; p.askedWeek = s.week;
    if (p.reply !== 'REPAIR') { ctx.note('本人有限答复', REPLIES[p.reply] + '原窗仍松，可以询问另一位实际访谈过的人；不强迫意愿。'); return; }
    l.shutter.pin = 'SOUND'; l.shutter.repairWeek = s.week; l.pliers.uses++;
    ctx.note('乔纳斯实际用自己的原钳修销', '你沿普通原路来到会馆作业位，当前自愿在场的乔纳斯经诺拉当面同意，用自己的PF4-PLIERS把同一PF4-SHUTTER旧松销复位修稳，再收回自己手中。本人沿原路离开；原窗仍属诺拉、原钳仍属乔纳斯，无新物品。还须另花1行动实际核实修理。'); return;
  }
  s.actionsRemaining--;
  if (c.type === 'MEET_HELPER') { const p = l.people[c.personId]; p.metWeek = s.week; p.reply = c.personId === 'PF4-NORA' ? 'PAPERS' : c.personId === 'PF4-EDWIN' ? 'CARRYING' : 'REPAIR'; ctx.note('本人实际到会馆访谈后返回', `你沿已知普通街道来到PF4-HALL，与在场的${p.name}当面交谈，再沿原路离开。${REPLIES[p.reply]}这是真实当面陈述，尚未代替请求或实际修理。`); return; }
  const p = CASES.find(p => p.id === c.caseId)!, r = l.cases[c.caseId];
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; r.observedWeek = s.week; ctx.note(p.title, p.story + ' ' + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = c.method; ctx.note(p.title, c.method === 'ABILITY' ? '选择自己的有限片段记录，实际实施还需4灵性、意志16，可失败。' : '选择当前普通观察或已发生记录对照，知识14，不授能力掌握。'); return; }
  if (c.type === 'VERIFY') {
    r.status = 'VERIFIED'; r.verifiedWeek = s.week;
    if (c.caseId === 'loose-shutter') { l.shutter.openingWeek = s.week; r.actual = l.strap.location === 'SHUTTER' ? 'STABLE' : 'RATTLED'; if (r.actual === 'RATTLED') l.pages.location = 'FLOOR'; ctx.note('后续真实开窗观察', '你沿原路回到会馆，亲眼看诺拉按普通安排打开同一原窗。' + (r.actual === 'STABLE' ? '已系原扎带发挥普通固定作用，窗稳定，原页留在桌上。' : '旧松销使原窗发出响动，普通气流把同一叠原页吹到一米内原地面。') + '没有人员受伤或严重窗体损坏；旧销仍松。此刻才形成实际观察，事前的强猜测不是事实。本人沿原路返回。'); }
    else if (c.caseId === 'blue-door') { const courier = l.people['PF4-EDWIN']; courier.location = 'PF4-HALL'; l.parcel.location = 'NORA'; l.parcel.deliveredWeek = s.week; l.parcel.handovers = 2; r.actual = 'PARCEL_RECEIVED'; ctx.note('迟到的原包裹实际交接', '你先沿已知普通街道到邮局，实际见到自愿的原埃德温领取PF4-PARCEL，再随他普通步行到PF4-BLUE-DOOR，见他亲手交给诺拉：POST→EDWIN→NORA两次真实交接。原包裹只此一件，归诺拉；埃德温留在会馆。没有实际伤人信息、犯罪指认或读心。蓝门图像可与这次迟到的交付对照，不能证明其他猜测。本人沿原路返回。'); }
    else { r.actual = 'PIN_REPAIRED'; ctx.note('当面复查同一个原销', '本人沿原路回到会馆，检查乔纳斯已实际修稳的同一旧销：当前SOUND。帮助已由真实访谈、同意、本人原技能和原钳兑现，并非片段自动挑选或制造帮手。复查后沿原路返回。'); }
    return;
  }
  if (c.type === 'REPORT') { r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); const source = `prophet-case:${p.id}`; if (r.result === 'ABILITY') awardSeerMastery(s, source, 8, ctx); else s.seer.completedSources.push(source); ctx.note(p.title, '分别报告事前记录、原猜测和后来独立观察，明确没有证实的过强推测。G扮演+25；' + (r.result === 'ABILITY' ? '有限能力报告单项掌握+8。' : '普通路线不授能力掌握。') + '不要求预言必然成真，不改写事前记录。'); return; }
  r.status = 'ACTIVE'; r.attemptWeek = s.week; r.contactOpen = true; r.effectActive = c.caseId === 'blue-door' && r.method === 'ABILITY'; r.result = 'NONE'; r.hypothesis = null; l.playerLocation = c.caseId === 'blue-door' ? 'QUIET_ROOM' : 'WORKAREA';
  const ability = r.method === 'ABILITY'; if (ability) s.spirituality -= 4;
  const check = ctx.check(ability ? 'will' : 'knowledge', ability ? 16 : 14), success = ['SUCCESS', 'GREAT_SUCCESS'].includes(check.tier);
  if (success) { r.result = r.method!; r.recordedWeek = s.week; if (ability) awardSeerMastery(s, `prophet-practice:${p.id}`, 5, ctx); }
  ctx.note(p.title, success ? ability ? `已付1行动、4灵性，得到自己的有限片段“${p.fragment}”。这不是未来事实或完整答案；先另写猜测，再结束等待真实核实。` : `${p.ordinary}这是普通记录，没有预言或能力掌握；先写有限解释、结束，再实际核实。` : '本次未形成充分记录，行动与实付灵性保留；先停止尚存短梦并实际结束，下一真实周再试，没有未来答案或失败补偿。');
}
export function prophetLifeActions(s: SliceState): ProphetLifeAction[] {
  if (!promoted(s) || s.progression.sequence === 2) return [];
  const out: ProphetLifeAction[] = [], l = s.prophet.life;
  const add = (id: string, label: string, cost: string, command: ProphetActivityCommand) => { const reason = blockProphetLife(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const p of CASES) { const r = l.cases[p.id];
    if (r.status === 'AVAILABLE') add(`${p.id}-observe`, '观察原现场与当前同意', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') for (const method of ['ABILITY', 'ORDINARY'] as const) add(`${p.id}-${method}`, method === 'ABILITY' ? '准备有限片段记录' : '准备普通事实对照', '1行动', { type: 'PREPARE', caseId: p.id, method });
    if (r.status === 'PREPARED') { add(`${p.id}-perform`, '实施本次记录', r.method === 'ABILITY' ? '1行动 · 4灵性 · 意志16' : '1行动 · 知识14 · 无能力掌握', { type: 'PERFORM', caseId: p.id }); add(`${p.id}-withdraw`, '取消未实施准备', '0行动 · 不退款', { type: 'WITHDRAW', caseId: p.id }); }
    if (r.contactOpen) { if (r.result !== 'NONE' && r.hypothesis === null) for (const hypothesis of p.hypotheses) add(`${p.id}-${hypothesis}`, HYPOTHESIS_TEXT[hypothesis], '0行动 · 仅是事前猜测', { type: 'INTERPRET', caseId: p.id, hypothesis }); if (r.effectActive) add(`${p.id}-stop`, '停止自己的有限短梦', '0行动', { type: 'STOP_EFFECT', caseId: p.id }); if (p.id === 'loose-shutter' && l.strap.location === 'NORA') add('prophet-secure', '经诺拉同意系上唯一原扎带', '0行动 · 实耗原扎带 · 旧销仍松', { type: 'SECURE_SHUTTER' }); add(`${p.id}-close`, '结束原现场并开放普通等待', '0行动 · 后续真实周另行核实', { type: 'CLOSE', caseId: p.id }); }
    if (r.status === 'WAITING') add(`${p.id}-verify`, '本人回访核实后来事实', '1行动 · 须跨真实周', { type: 'VERIFY', caseId: p.id });
    if (r.status === 'VERIFIED') add(`${p.id}-report`, '分别报告猜测与后来事实', '1行动 · G扮演25', { type: 'REPORT', caseId: p.id });
  }
  if (l.pages.location === 'FLOOR') add('prophet-pages', '本人手工捡回同一叠原纸页', '0行动 · 一米原路', { type: 'RETURN_PAGES' });
  if (l.cases['uncertain-helper'].status === 'WAITING') for (const personId of PROPHET_PERSON_IDS) { const p = l.people[personId]; if (p.metWeek === null) add(`meet-${personId}`, `实际访谈${p.name}`, '1行动 · 原会馆本人答复', { type: 'MEET_HELPER', personId }); else if (p.askedWeek === null) add(`ask-${personId}`, `询问${p.name}是否愿意修销`, '0行动 · 按真实技能与当前同意', { type: 'ASK_HELP', personId }); }
  if (!l.reflected) add('prophet-reflect', '反思片段、解释与独立事实', '0行动 · 三案后G扮演25', { type: 'REFLECT' });
  add('prophet-make-flash', '沿用原材料来源另制一枚弱微光', '1行动 · 160便士 · 4灵性 · 知识16 · 每真实周一次', { type: 'MAKE_FLASH' });
  return out;
}
const actualText = (r: ProphetCaseState): string | null => r.actual === 'NONE' ? null : r.actual === 'STABLE' ? '后来诺拉实际开窗：原扎带固定，窗稳定，原页仍在桌。旧销未修，不是严重损坏预言成真。' : r.actual === 'RATTLED' ? '后来诺拉实际开窗：原松销响动，原页落到一米内地面；没有受伤或严重损坏。' : r.actual === 'PARCEL_RECEIVED' ? '后来原埃德温普通步行送达，同一原包裹实际交给诺拉；没有人员受伤事实。' : '经过实际访谈和同意，乔纳斯用自己的原钳修了同一原销；本人又实际复查为SOUND。';
export function projectProphetLife(s: SliceState): ProphetLifeProjection {
  const l = s.prophet.life;
  return { title: '片段之后，仍须亲自生活', story: PROPHET_LIFE_STORY, cases: CASES.map(p => { const r = l.cases[p.id]; return { id: p.id, title: p.title, story: p.story, status: r.status, method: r.method, result: r.attemptWeek === null ? null : r.result === 'NONE' ? '本次记录失败；成本保留，结束后下周再试。' : r.result === 'ABILITY' ? '记录了一段有限自身片段；不等于未来已知。' : p.ordinary, contactOpen: r.contactOpen, effectActive: r.effectActive, observations: r.observedWeek === null ? [] : [...p.facts], forecast: r.result === 'ABILITY' ? p.fragment : null, hypothesis: r.hypothesis === null ? null : HYPOTHESIS_TEXT[r.hypothesis], actual: actualText(r), observedWeek: r.observedWeek, recordedWeek: r.recordedWeek, verifiedWeek: r.verifiedWeek }; }),
    objects: { shutter: `PF4-SHUTTER · 诺拉所有 · 原销${l.shutter.pin === 'LOOSE' ? '松动' : '已由乔纳斯实际修稳'}`, pages: `PF4-PAGES · 诺拉所有 · ${l.pages.location === 'TABLE' ? '原桌' : '一米内原地面'} · 实际捡回${l.pages.returns}次`, strap: `PF4-STRAP-1 · 唯一原扎带 · ${l.strap.location === 'NORA' ? '诺拉持有、未用' : '已实际系在原窗，一次用掉'}`, parcel: `PF4-PARCEL · 诺拉同事寄来、诺拉所有 · ${l.parcel.location === 'POST' ? '当前邮局' : '已实际交给诺拉'} · 实际交接${l.parcel.handovers}次`, door: 'PF4-BLUE-DOOR · 诺拉原蓝门 · PF4-HALL', pliers: l.people['PF4-JONAS'].metWeek === null ? '尚未实际访谈，未知谁能提供何种工具协助。' : `PF4-PLIERS · 乔纳斯本人持有 · 实际修销${l.pliers.uses}次` },
    people: PROPHET_PERSON_IDS.map(id => { const p = l.people[id]; return { id, name: p.name, age: p.age, alive: p.alive, willing: p.willing, location: p.location, interview: p.metWeek === null ? null : REPLIES[p.reply], asked: p.askedWeek !== null }; }), crafts: mysticismMagisterCrafts(s), reflected: l.reflected, inside: hasProphetLifeLock(s), actions: prophetLifeActions(s) };
}
export function validateProphetLife(s: SliceState): boolean {
  const l = s.prophet?.life, base = createProphetLifeState(), promotion = s.prophet?.promotionWeek;
  if (!record(l) || !shape(l, Object.keys(base)) || !record(l.cases) || !shape(l.cases, PROPHET_CASE_IDS) || !record(l.people) || !shape(l.people, PROPHET_PERSON_IDS)) return false;
  for (const k of ['shutter', 'pages', 'strap', 'door', 'parcel', 'pliers'] as const) if (!record(l[k]) || !shape(l[k], Object.keys(base[k]))) return false;
  if (promotion === null) return stableStringify(l) === stableStringify(base);
  if (!integer(promotion, 1, s.week) || !promoted(s) || l.hallId !== 'PF4-HALL' || !['OUTSIDE', 'WORKAREA', 'QUIET_ROOM'].includes(l.playerLocation)) return false;
  if (l.shutter.id !== base.shutter.id || l.shutter.owner !== 'PF4-NORA' || !['LOOSE', 'SOUND'].includes(l.shutter.pin) || l.pages.id !== base.pages.id || l.pages.owner !== 'PF4-NORA' || !['TABLE', 'FLOOR'].includes(l.pages.location) || !integer(l.pages.returns, 0, 1) || l.strap.id !== base.strap.id || l.strap.owner !== 'PF4-NORA' || !['NORA', 'SHUTTER'].includes(l.strap.location) || stableStringify(l.door) !== stableStringify(base.door) || l.parcel.id !== base.parcel.id || l.parcel.owner !== 'PF4-NORA' || l.parcel.sender !== 'NORAS_COLLEAGUE' || !['POST', 'NORA'].includes(l.parcel.location) || ![0, 2].includes(l.parcel.handovers) || l.pliers.id !== base.pliers.id || l.pliers.owner !== 'PF4-JONAS' || l.pliers.location !== 'JONAS' || !integer(l.pliers.uses, 0, 1)) return false;
  for (const w of [l.shutter.openingWeek, l.shutter.repairWeek, l.strap.usedWeek, l.parcel.deliveredWeek]) if (w !== null && !integer(w, promotion, s.week)) return false;
  let open = 0, prepared = 0, resolved = 0;
  for (const [index, id] of PROPHET_CASE_IDS.entries()) { const r = l.cases[id];
    if (!record(r) || !shape(r, Object.keys(freshCase())) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'WAITING', 'VERIFIED', 'RESOLVED'].includes(r.status) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result) || r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || typeof r.contactOpen !== 'boolean' || typeof r.effectActive !== 'boolean' || !integer(r.closes) || !integer(r.withdrawals)) return false;
    if (r.status === 'AVAILABLE') { if (stableStringify(r) !== stableStringify(freshCase())) return false; continue; }
    if (!integer(r.observedWeek, promotion, s.week) || [r.attemptWeek, r.recordedWeek, r.verifiedWeek].some(w => w !== null && !integer(w, r.observedWeek!, s.week)) || index > 0 && l.cases[PROPHET_CASE_IDS[index - 1]!].status !== 'RESOLVED') return false;
    if (r.hypothesis !== null && !CASES[index]!.hypotheses.includes(r.hypothesis) || r.result !== 'NONE' && r.result !== r.method || (r.result === 'NONE') !== (r.recordedWeek === null) || r.recordedWeek !== null && r.recordedWeek !== r.attemptWeek) return false;
    if (r.status === 'PREPARED') { prepared++; if (r.method === null || r.contactOpen || r.result !== 'NONE' || r.attemptWeek === s.week) return false; }
    if (r.status === 'OBSERVED' && (r.result !== 'NONE' || r.contactOpen || r.hypothesis !== null)) return false;
    if (r.contactOpen) { open++; if (r.status !== 'ACTIVE' || r.attemptWeek !== s.week || r.method === null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND' || s.combat || s.activeEvent || l.playerLocation !== (id === 'blue-door' ? 'QUIET_ROOM' : 'WORKAREA')) return false; }
    if ((r.status === 'ACTIVE') !== r.contactOpen || r.effectActive && (!r.contactOpen || id !== 'blue-door' || r.method !== 'ABILITY')) return false;
    if (['WAITING', 'VERIFIED', 'RESOLVED'].includes(r.status) && (r.result === 'NONE' || r.hypothesis === null || r.closes < 1 || r.contactOpen || r.effectActive)) return false;
    const verified = ['VERIFIED', 'RESOLVED'].includes(r.status);
    if (verified ? r.verifiedWeek === null || r.recordedWeek === null || r.verifiedWeek <= r.recordedWeek || r.actual === 'NONE' : r.verifiedWeek !== null || r.actual !== 'NONE') return false;
    if (r.status === 'RESOLVED') resolved++;
    if (s.seer.completedSources.filter(x => x === `prophet-case:${id}`).length !== (r.status === 'RESOLVED' ? 1 : 0) || s.seer.completedSources.filter(x => x === `prophet-practice:${id}`).length !== (r.result === 'ABILITY' ? 1 : 0)) return false;
  }
  const shutter = l.cases['loose-shutter'], blue = l.cases['blue-door'], helper = l.cases['uncertain-helper'];
  if (open > 1 || prepared > 1 || open && prepared || (l.playerLocation === 'OUTSIDE') !== (open === 0)) return false;
  if (s.progression.sequence === 2 && (open || prepared || resolved !== 3 || !l.reflected || l.pages.location !== 'TABLE' || s.insightScholar.prophetActingAtPromotion !== 100)) return false;
  if ((l.strap.location === 'SHUTTER') !== (l.strap.usedWeek !== null) || l.strap.usedWeek !== null && (shutter.attemptWeek === null || l.strap.usedWeek < shutter.observedWeek! || l.strap.usedWeek > shutter.attemptWeek)) return false;
  if (shutter.actual !== 'NONE' && shutter.actual !== (l.strap.location === 'SHUTTER' ? 'STABLE' : 'RATTLED') || l.shutter.openingWeek !== shutter.verifiedWeek) return false;
  if (l.pages.location === 'FLOOR' ? shutter.actual !== 'RATTLED' || l.pages.returns !== 0 : l.pages.returns !== (shutter.actual === 'RATTLED' ? 1 : 0)) return false;
  if (blue.actual !== 'NONE' && blue.actual !== 'PARCEL_RECEIVED' || l.parcel.deliveredWeek !== blue.verifiedWeek || (l.parcel.location === 'NORA') !== (blue.verifiedWeek !== null) || l.parcel.handovers !== (blue.verifiedWeek !== null ? 2 : 0)) return false;
  for (const id of PROPHET_PERSON_IDS) { const p = l.people[id], original = base.people[id];
    if (!record(p) || !shape(p, Object.keys(original)) || p.id !== id || p.name !== original.name || p.age !== original.age || typeof p.alive !== 'boolean' || typeof p.willing !== 'boolean' || p.location !== (id === 'PF4-EDWIN' && blue.verifiedWeek === null ? 'POST' : 'PF4-HALL') || !['NONE', 'PAPERS', 'CARRYING', 'REPAIR'].includes(p.reply)) return false;
    if (p.metWeek === null ? p.reply !== 'NONE' || p.askedWeek !== null : helper.recordedWeek === null || !integer(p.metWeek, helper.recordedWeek + 1, s.week) || p.reply !== (id === 'PF4-NORA' ? 'PAPERS' : id === 'PF4-EDWIN' ? 'CARRYING' : 'REPAIR')) return false;
    if (p.askedWeek !== null && (p.metWeek === null || !integer(p.askedWeek, p.metWeek, s.week))) return false;
  }
  if (l.shutter.repairWeek !== l.people['PF4-JONAS'].askedWeek || (l.shutter.pin === 'SOUND') !== (l.shutter.repairWeek !== null) || l.pliers.uses !== (l.shutter.repairWeek !== null ? 1 : 0) || helper.actual !== 'NONE' && (helper.actual !== 'PIN_REPAIRED' || l.shutter.repairWeek === null || helper.verifiedWeek! < l.shutter.repairWeek)) return false;
  return typeof l.reflected === 'boolean' && (!l.reflected || resolved === 3) && s.seer.completedSources.filter(x => x === 'prophet-reflection').length === (l.reflected ? 1 : 0) && ([3, 2].includes(s.progression.sequence ?? 0)?s.insightScholar.prophetActingAtPromotion:s.progression.acting) === resolved * 25 + (l.reflected ? 25 : 0);
}
