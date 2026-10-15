import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { stableStringify } from '../canonical.js';
import { applyDemonActivity, demonInside } from '../demon/life.js';
import { desireApostleInside } from '../desire-apostle/life.js';
import type { DevilAbilityId } from './types.js';

export const DEVIL_CASE_IDS = ['stage-decision', 'returned-invitation', 'bounded-account'] as const;
export type DevilCaseId = typeof DEVIL_CASE_IDS[number];
export type DevilActivityCommand =
  | { type: 'OBSERVE' | 'PERFORM' | 'CLOSE' | 'REPORT' | 'WITHDRAW'; caseId: DevilCaseId }
  | { type: 'PREPARE'; caseId: DevilCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'CATALYZE' | 'WITHDRAW_CONSENT'; caseId: 'stage-decision' }
  | { type: 'RETURN_ROUTE'; caseId: 'returned-invitation' }
  | { type: 'CONFIRM_ACCOUNT'; caseId: 'bounded-account'; claim: 'LIMITED' | 'GUARANTEED' }
  | { type: 'REFLECT' }
  | { type: 'COMPOSE' };
export interface DevilLifeAttempt {
  week: number; method: 'ABILITY' | 'ORDINARY'; success: boolean;
  actionCost: 1; spiritualityCost: 0 | 4 | 7;
  seed: 'NONE' | 'FAILED' | 'PLANTED' | 'SPENT' | 'EXPIRED'; catalysis: boolean | null; consentWithdrawn: boolean;
}
export interface DevilCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'EXAMINED' | 'RESOLVED';
  method: 'ABILITY' | 'ORDINARY' | null; contactOpen: boolean;
  preparations: number; withdrawals: number; closes: number; attempts: DevilLifeAttempt[];
}
export interface DevilLifeState {
  cases: Record<DevilCaseId, DevilCaseState>; reflected: boolean;
  stage: {
    subjectId: 'MIREL'; programId: 'DV4-PROGRAM-1'; programHolder: 'MIREL';
    emotion: 'CALM' | 'STRONG'; consented: boolean; readings: number; consentWithdrawals: number;
    seed: 'NONE' | 'PLANTED' | 'SPENT' | 'EXPIRED'; pauseSeconds: 0 | 30; waitedSeconds: number;
  };
  invitation: {
    id: 'DV4-INVITATION-1'; subjectId: 'REINA'; emotion: 'CALM'; holder: 'GUIDE' | 'REINA' | 'PLAYER';
    declined: boolean; shelfPlacements: 0 | 1; playerNode: 'GUIDE' | 'SHELF'; walks: number; distanceMetres: number;
  };
  account: {
    id: 'DV4-NOTE-1'; holder: 'GUIDE' | 'PLAYER'; writings: string[];
    claim: 'LIMITED' | 'GUARANTEED' | null; accepted: boolean;
    claims: ('LIMITED' | 'GUARANTEED')[]; corrections: number; handovers: number;
  };
}
export interface DevilLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: DevilActivityCommand }
export interface DevilLifeProjection {
  cases: { id: DevilCaseId; title: string; story: string; observations: string[]; preparation: string | null; result: string | null; status: string; contactOpen: string; closes: number }[];
  insideCase: boolean; environment: string;
  practice: null | {
    emotion: string; seed: string; seedState: DevilLifeState['stage']['seed']; consent: string; program: string;
    invitation: string; route: string; account: string; history: string[];
  };
}
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const shape = (x: object, keys: readonly string[]) => Object.keys(x).length === keys.length && keys.every(k => Object.hasOwn(x, k));
const integer = (x: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): x is number => Number.isSafeInteger(x) && (x as number) >= min && (x as number) <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'abyss' && [4,3].includes(s.progression.sequence!);
const success = (tier: string) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const last = (r: DevilCaseState) => r.attempts.at(-1);
const completed = (r: DevilCaseState) => r.status === 'EXAMINED' || r.status === 'RESOLVED';
const source = (id: DevilCaseId) => `devil-case:${id}`;
const emptyCase = (): DevilCaseState => ({ status: 'AVAILABLE', method: null, contactOpen: false, preparations: 0, withdrawals: 0, closes: 0, attempts: [] });
const CASES = [
  { id: 'stage-decision', title: '米蕾尔自己选择的新短读', story: '原成年米蕾尔带着始终由自己保管的DV4-PROGRAM-1，自愿排练新选的短读。她当面说明期待、只允许本次有限试验，并保留随时停止的选择。这不是重做旧欲望使徒排练。（原创G）', facts: ['强烈兴奋须来自她实际开始的自主新朗读和当面表述，能力不会制造情绪或读取隐藏内心。', '有限G埋种1行动4灵性、知识18；成功只留下PLANTED，尚无催化效果。后续同次催化0额外行动、另3灵性、知识18，失败照耗并用尽同一种子。', '成功只出现30秒G可见迟疑，原节目始终在她手里；本人可明确撤回同意。0行动实际停止并等待60秒G窗口，不授予忠诚、健康损伤或物权。'], ability: '准备本人同意的单次新朗读试验，实施前再次当面确认。建议留7灵性，准备本身不埋种。', ordinary: '讨论她自己选定的原节目并等待她自己的回答；1行动0灵性、知识10。自愿回答不算能力控制。' },
  { id: 'returned-invitation', title: '蕾娜拒绝后的一米原路', story: '原成年蕾娜平静地接过新的同一张DV4-INVITATION-1。她有权拒绝，原架就在导师旁一米处；你可以普通取回并携原纸走回罗安面前。（原创G）', facts: ['蕾娜当前CALM，平静和拒绝不是隐蔽强烈情绪；没有能力入口，不能强迫她兴奋或答应。', '她实际选择拒绝并把同一原邀请放到一米外原架；本人普通走一米取起，即使知识10失败也保留已发生的拒绝与路线。', '另选0行动RETURN_ROUTE，实际携同一原纸走一米返回导师；失败下一真实周只核对已经拒绝的原记录，不重新邀请或复制纸张。'], ability: null, ordinary: '尊重她自己的选择，普通取回同一原邀请；知识10、0灵性。后来重试只核对既有拒绝记录。' },
  { id: 'bounded-account', title: '同一张原纸上的有限说法', story: '罗安持有新的原记录纸DV4-NOTE-1，请你记下前两件实际经历。旧DA5-LEDGER-1与DA5-NOTE-1仍按旧记录保管；这次不重开旧册。（原创G）', facts: ['实际书写与知识10核对都有结果；失败文字留在同一原纸上，下一真实周更正，不造一张无错新纸。', 'LIMITED只陈述可见现象、当事人选择和可能失败；GUARANTEED声称必然控制或安全消化时，罗安会明确拒绝，可0行动更正同一纸。', '导师按实际文本与经历作普通核对，此接受标准为G；不是超自然测谎、魔法契约或灵魂所有权。'], ability: null, ordinary: '在同一原纸写出已有结果与局限；1行动0灵性、知识10，再明确选择LIMITED或GUARANTEED说法。' },
] as const;
export const DEVIL_LIFE_ENVIRONMENT = '三项有限原创G故事：观察、准备、实施、报告各1行动，每份报告扮演25，三案后反思1行动另25。新4训练名与继承强化、原人新事件、物件、费用、难度、距离、30秒迟疑及60秒窗口均为G，不冒充已核原著新技能。强烈当前情绪仍是前提，平静、抵抗或撤回同意不自动受控。能力失败照实付费、下一真实周才可重试；停止、撤回同意、普通原路返回与文字更正均0行动。三案可普通完成的和平100只是有限有成本G替代，不保证原著无风险消化，不清除恶意、紧绷、良知变化或失控风险。原著可确认魔鬼4，呓语者的序列3为人物推断；完整配方、仪式与4新能力全表仍未知。不老泉骗局仅有仪式或消化推测，不设为必需屠杀；堕落长笛是物品，无免费契约、灵魂所有权、普遍降智、固定一两天预警或原初恶魔高位能力。';

export function createDevilLifeState(): DevilLifeState {
  return {
    cases: { 'stage-decision': emptyCase(), 'returned-invitation': emptyCase(), 'bounded-account': emptyCase() }, reflected: false,
    stage: { subjectId: 'MIREL', programId: 'DV4-PROGRAM-1', programHolder: 'MIREL', emotion: 'CALM', consented: false, readings: 0, consentWithdrawals: 0, seed: 'NONE', pauseSeconds: 0, waitedSeconds: 0 },
    invitation: { id: 'DV4-INVITATION-1', subjectId: 'REINA', emotion: 'CALM', holder: 'GUIDE', declined: false, shelfPlacements: 0, playerNode: 'GUIDE', walks: 0, distanceMetres: 0 },
    account: { id: 'DV4-NOTE-1', holder: 'GUIDE', writings: [], claim: null, accepted: false, claims: [], corrections: 0, handovers: 0 },
  };
}
export function validateDevilActivityCommand(c: unknown): c is DevilActivityCommand {
  if (!record(c)) return false;
  if (c.type === 'COMPOSE' || c.type === 'REFLECT') return shape(c, ['type']);
  if (!DEVIL_CASE_IDS.includes(c.caseId as DevilCaseId)) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  if (c.type === 'CONFIRM_ACCOUNT') return c.caseId === 'bounded-account' && shape(c, ['type', 'caseId', 'claim']) && ['LIMITED', 'GUARANTEED'].includes(c.claim as string);
  return shape(c, ['type', 'caseId']) && (['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string) || ['CATALYZE', 'WITHDRAW_CONSENT'].includes(c.type as string) && c.caseId === 'stage-decision' || c.type === 'RETURN_ROUTE' && c.caseId === 'returned-invitation');
}
export function hasDevilLifeLock(s: SliceState): boolean {
  const l = s.devil.life;
  return Object.values(l.cases).some(r => r.contactOpen) || l.stage.seed === 'PLANTED' || l.invitation.playerNode === 'SHELF' || l.invitation.holder === 'PLAYER' || l.account.holder === 'PLAYER';
}
export function devilActivityReason(s: SliceState, c: DevilActivityCommand): string | null {
  if (!validateDevilActivityCommand(c)) return '魔鬼实践命令无效。';
  if (!promoted(s)||s.progression.sequence!==4) return '原魔鬼实践与后果保留，当前阶段不重新开启。';
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  const l = s.devil.life, r = 'caseId' in c ? l.cases[c.caseId] : null;
  if (c.type === 'CLOSE') return !r?.contactOpen ? '没有尚待实际结束的本次接触。' : c.caseId === 'returned-invitation' && (l.invitation.playerNode !== 'GUIDE' || l.invitation.holder !== 'GUIDE') ? '先0行动携同一原纸沿一米原路实际返回导师。' : null;
  if (c.type === 'RETURN_ROUTE') return r?.contactOpen && l.invitation.playerNode === 'SHELF' && l.invitation.holder === 'PLAYER' ? null : '本人和同一原邀请已在导师旁，不虚构重复路线。';
  if (c.type === 'WITHDRAW_CONSENT') return r?.contactOpen && l.stage.consented && l.stage.seed === 'PLANTED' ? null : '须在尚未催化的同一次原试验中，由米蕾尔本人明确撤回。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' && !r.contactOpen ? null : '只可取消未实施的准备；已经实施须实际停止。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '先返回贝克兰德罗安的原练习室。';
  if (c.type === 'CONFIRM_ACCOUNT') return r?.status === 'RESOLVED' || !r?.attempts.length || !l.account.writings.length ? '先实际书写同一原纸；已经报告的结论不重复改写。' : l.account.claim === c.claim ? '同一句说法已经由导师核对，不重复记录。' : null;
  if (c.type === 'CATALYZE') {
    if (!r?.contactOpen || r.status !== 'PREPARED' || last(r)?.week !== s.week || l.stage.seed !== 'PLANTED' || !l.stage.consented || l.stage.emotion !== 'STRONG') return '须当前仍同意、仍有实际强烈情绪，且同次已经付费成功埋种。';
    return s.health <= 0 || s.mind <= 0 ? '身体或精神不足；仍可0行动停止。' : s.spirituality < 3 ? '后续催化另需3灵性，不能透支；仍可0行动停止或由本人撤回同意。' : null;
  }
  if (hasDevilLifeLock(s)) return '先0行动实际收束本次接触、原物与普通路线。';
  if (demonInside(s) || desireApostleInside(s) || s.demon.practice.body !== 'NORMAL' || s.demon.practice.flame === 'LIT') return '先结束原低阶现场，恢复原身体并熄灭原火盆。';
  if (Object.entries(l.cases).some(([id, value]) => value.status === 'PREPARED' && (!('caseId' in c) || c.caseId !== id))) return '先实施或0行动取消另一项准备。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神；0行动收束不受资源不足阻挡。';
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'COMPOSE') return s.demon.strain > 0 ? null : '当前原紧绷为0，无需白耗行动。';
  if (c.type === 'REFLECT') return l.reflected ? '已经反思三份原报告。' : DEVIL_CASE_IDS.some(id => l.cases[id].status !== 'RESOLVED') ? '先完成三份实际报告。' : null;
  if (!r || !('caseId' in c)) return '未知原现场。';
  if (r.status === 'RESOLVED') return '同一有限报告已完成，不能重复奖励。';
  const position = DEVIL_CASE_IDS.indexOf(c.caseId);
  if (position > 0 && l.cases[DEVIL_CASE_IDS[position - 1]!].status !== 'RESOLVED') return '先报告上一项实际结果。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '同一原现场已经观察。';
  if (c.type === 'REPORT') return r.status !== 'EXAMINED' ? '须真实判定成功并实际收束，不能把失败或埋种当报告完成。' : c.caseId === 'bounded-account' && !l.account.accepted ? '导师尚未接受有限说法；请在同一原纸明确更正为LIMITED。' : null;
  if (c.type === 'PREPARE' || c.type === 'PERFORM') {
    if (c.type === 'PREPARE' ? r.status !== 'OBSERVED' : r.status !== 'PREPARED') return c.type === 'PREPARE' ? '先观察原人和同一原物。' : '先准备本次方法。';
    if (last(r)?.week === s.week) return '本真实周已经实施，失败或停止须下一真实周才可重试。';
    const method = c.type === 'PREPARE' ? c.method : r.method;
    if (method === 'ABILITY' && c.caseId !== 'stage-decision') return c.caseId === 'returned-invitation' ? '蕾娜当前平静CALM且可拒绝，缺少强烈情绪入口；只有普通方法。' : '本项只普通书写与核对，没有魔法契约或测谎入口。';
    if (c.type === 'PERFORM' && method === 'ABILITY' && s.spirituality < 4) return '埋种需要4灵性；成功后的催化另需3灵性，也可0行动取消准备。';
    return null;
  }
  return '本命令不适用于当前现场。';
}

function reportText(s: SliceState, id: DevilCaseId): string {
  const l = s.devil.life, r = l.cases[id];
  if (id === 'stage-decision') return last(r)?.method === 'ABILITY' ? '米蕾尔自主新朗读产生当面可见强烈兴奋，在本人同意的同次付费埋种后，另付费催化曾出现30秒G可见迟疑；没有强制交出DV4-PROGRAM-1、忠诚或健康损伤。' : '普通讨论她自选的DV4-PROGRAM-1后，她明确回答“我就读这一段，不换节目”；选择和节目仍属于米蕾尔，没有施法效果或能力掌握。';
  if (id === 'returned-invitation') return `蕾娜自行拒绝同一DV4-INVITATION-1，情绪仍CALM。原纸已沿普通一米路线取回；累计实际行走${l.invitation.walks}次、${l.invitation.distanceMetres}米，拒绝从未被改成答应。`;
  return `同一DV4-NOTE-1保留实际成功、失败及普通替代。${l.account.accepted ? '导师已按有限可见结果接受LIMITED' : l.account.claim === 'GUARANTEED' ? '导师明确拒绝GUARANTEED，尚须同纸更正' : '尚须明确确认有限说法'}，不保证必然控制或安全消化；不是魔法契约、超自然测谎或灵魂转让。`;
}
export function applyDevilActivity(s: SliceState, c: DevilActivityCommand, ctx: SeerContext, award: (id: DevilAbilityId, amount?: number) => void): void {
  const reason = devilActivityReason(s, c); if (reason) throw new Error(reason);
  const l = s.devil.life;
  if (c.type === 'COMPOSE') { applyDemonActivity(s, { type: 'COMPOSE' }, ctx, () => {}); return; }
  if (c.type === 'RETURN_ROUTE') {
    l.invitation.playerNode = 'GUIDE'; l.invitation.holder = 'GUIDE'; l.invitation.walks += 1; l.invitation.distanceMetres += 1;
    ctx.note('携同一张已拒绝邀请沿一米原路返回', '你携DV4-INVITATION-1普通走一米回到罗安面前，亲手交给他。0行动、0灵性，实际路线保留；没有传送、退款或重新邀请蕾娜。'); return;
  }
  if (c.type === 'WITHDRAW_CONSENT') {
    const r = l.cases[c.caseId], a = last(r)!;
    l.stage.consented = false; l.stage.emotion = 'CALM'; l.stage.seed = 'EXPIRED'; l.stage.consentWithdrawals += 1;
    a.consentWithdrawn = true; a.seed = 'EXPIRED'; r.status = 'OBSERVED';
    ctx.note('米蕾尔本人撤回本次同意', '米蕾尔当面说：“这一次到这里，我不继续了。”她停止朗读、平复为CALM；同一次尚未催化种子到期，不可继续催化。DV4-PROGRAM-1仍在她手中，0行动0灵性，不退埋种成本；仍须另选CLOSE真正结束本次接触。'); return;
  }
  if (c.type === 'CLOSE') {
    const r = l.cases[c.caseId]; r.contactOpen = false; r.closes += 1;
    if (c.caseId === 'stage-decision') {
      if (l.stage.seed === 'PLANTED') { l.stage.seed = 'EXPIRED'; last(r)!.seed = 'EXPIRED'; r.status = 'OBSERVED'; }
      l.stage.consented = false; l.stage.emotion = 'CALM'; l.stage.pauseSeconds = 0; l.stage.waitedSeconds += 60;
      ctx.note('停止并实际等过本次六十秒G窗口', '双方实际停止试验并等过预付的60秒G有限窗口，未催化种子到期、迟疑结束；原节目仍由米蕾尔持有。0行动0灵性，不退款、不奖励或治疗。停止而未取得结果须下一真实周再询问她的新一次选择。');
    } else if (c.caseId === 'bounded-account') {
      l.account.holder = 'GUIDE'; l.account.handovers += 1;
      ctx.note('亲手交付同一张实际写过的原纸', '把DV4-NOTE-1亲手交给原导师罗安。失败文字和被拒说法都留在原纸，0行动0灵性，不另造正确纸张；有限说法仍可由双方在同一纸上更正。');
    } else ctx.note('实际结束与蕾娜的普通讨论', '本人和已拒绝的DV4-INVITATION-1均已在导师旁，结束本次讨论；0行动0灵性，不改变蕾娜的选择或情绪。');
    if (!completed(r)) r.method = null;
    return;
  }
  if (c.type === 'CONFIRM_ACCOUNT') {
    if (l.account.claim === 'GUARANTEED' && c.claim === 'LIMITED') l.account.corrections += 1;
    l.account.claim = c.claim; l.account.claims.push(c.claim); l.account.accepted = c.claim === 'LIMITED';
    ctx.note(c.claim === 'LIMITED' ? '在同一原纸确认有限说法' : '罗安明确拒绝保证说法', c.claim === 'LIMITED' ? '双方在同一DV4-NOTE-1注明：只支持已有可见结果、本人选择以及可能失败，不承诺必然控制或安全消化。若此前写成保证，原说法留下并明确更正。0行动，无额外奖励；知识核对失败仍须下一真实周重试。' : '你在同一DV4-NOTE-1写下“必然控制、保证安全消化”的GUARANTEED说法。罗安明确说：“这些经历支持不了这个保证。”本次不接受、不奖励，不发生精神控制或契约；可0行动把同一纸更正为LIMITED。'); return;
  }
  if (c.type === 'CATALYZE') {
    const r = l.cases[c.caseId], a = last(r)!;
    s.spirituality -= 3; a.spiritualityCost = 7; a.seed = 'SPENT'; l.stage.seed = 'SPENT';
    a.catalysis = success(ctx.check('knowledge', 18).tier); a.success = a.catalysis;
    r.status = a.success ? 'EXAMINED' : 'OBSERVED'; l.stage.pauseSeconds = a.success ? 30 : 0;
    ctx.note(a.success ? '另付费后本次有限催化成功' : '另付费后本次催化失败', a.success ? reportText(s, c.caseId) + '0额外行动、另3灵性已付，同一种子已用尽；尚须真实停止后才能报告。' : '0额外行动、另3灵性已付，知识18失败，同一种子已用尽，无可报告迟疑或奖励。0行动实际停止后，下一真实周才能重新准备。'); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = l.cases[c.caseId]; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    if (c.caseId === 'stage-decision') l.stage.consented = false;
    ctx.note('取消尚未实施的准备', '0行动，不开始新试验、不改变情绪、不移动原物，之前已付准备成本不退。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REFLECT') {
    l.reflected = true; s.seer.completedSources.push('devil-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('回看三种真实选择与有限结果', '分清已有强烈情绪、本人撤回、平静拒绝、普通路线与被更正的保证。G扮演+25；不把这组三案推广为原著无限安全消化，不修复旧良知或紧绷。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = l.cases[c.caseId];
  if (c.type === 'OBSERVE') {
    r.status = 'OBSERVED';
    if (c.caseId === 'stage-decision') l.stage.consented = true;
    if (c.caseId === 'returned-invitation') l.invitation.holder = 'REINA';
    ctx.note(p.title, p.story + (c.caseId === 'stage-decision' ? '你亲眼看到她翻选原节目、听到她说明期待并口头同意这一次；实际朗读开始时再核对当前情绪。' : c.caseId === 'returned-invitation' ? '你把同一原邀请递给蕾娜，她实际接过查看，当前神态和当面表述平静。' : '你与罗安实际核对前两件已发生的记录；尚未书写、签署或控制任何人。')); return;
  }
  if (c.type === 'PREPARE') {
    r.status = 'PREPARED'; r.method = c.method; r.preparations += 1;
    if (c.caseId === 'stage-decision') l.stage.consented = true;
    ctx.note('准备本次有限方法', (c.method === 'ABILITY' ? p.ability! : p.ordinary) + (c.caseId === 'stage-decision' ? '米蕾尔本人再次当面确认只同意本次、自主选择新短读，仍可撤回。' : '')); return;
  }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.seer.completedSources.push(source(c.caseId)); s.progression.acting = Math.min(100, s.progression.acting + 25);
    if (c.caseId === 'stage-decision' && r.method === 'ABILITY') { award('abyss.s4.desire-focus', 8); award('abyss.s4.catalytic-pressure', 8); }
    ctx.note(p.title, reportText(s, c.caseId) + '原现场已经实际收束。G扮演+25；' + (r.method === 'ABILITY' ? '本次真实成功催化报告使两项G训练掌握各+8，仅一次。' : '普通报告不增加能力掌握。')); return;
  }
  const a: DevilLifeAttempt = { week: s.week, method: r.method!, success: false, actionCost: 1, spiritualityCost: r.method === 'ABILITY' ? 4 : 0, seed: 'NONE', catalysis: null, consentWithdrawn: false };
  r.attempts.push(a); r.contactOpen = true;
  if (c.caseId === 'stage-decision') {
    l.stage.readings += 1; l.stage.consented = true; l.stage.emotion = 'STRONG'; l.stage.seed = 'NONE'; l.stage.pauseSeconds = 0;
    ctx.note('原米蕾尔实际开始自主新短读', '她手持自己的DV4-PROGRAM-1，实际朗读新选段并当面说出期待，语速与表情明显兴奋。当前强烈情绪来自这个真实自主事件，绝非能力制造、隐藏读心或强迫。');
  } else if (c.caseId === 'returned-invitation') {
    if (!l.invitation.declined) {
      l.invitation.declined = true; l.invitation.shelfPlacements = 1; l.invitation.holder = 'PLAYER'; l.invitation.playerNode = 'SHELF'; l.invitation.walks += 1; l.invitation.distanceMetres += 1;
      ctx.note('她自行拒绝，原纸已实际沿普通路线取起', '蕾娜说“我不参加”，把同一DV4-INVITATION-1放到一米外原架。你普通走一米并取起同一纸；即使随后知识10失败，拒绝、取起和距离也已实际发生，尚须另选0行动携纸原路返回。');
    } else ctx.note('只核对已经发生的原拒绝', '同一DV4-INVITATION-1仍由罗安保管。你核对原拒绝记录，不再向蕾娜发新邀请、不改她的CALM情绪、不重复虚构行走。');
  } else {
    l.account.holder = 'PLAYER'; l.account.claim = null; l.account.accepted = false;
    const failed = DEVIL_CASE_IDS.reduce((sum, id) => sum + l.cases[id].attempts.filter(x => !x.success).length, 0) - 1;
    l.account.writings.push(`W${s.week}：${reportText(s, 'stage-decision')} ${reportText(s, 'returned-invitation')} 此前实际未成尝试${failed}次；本次书写核对结果待记录。`);
    ctx.note('同一张原纸已经实际书写', '从罗安手中接过同一DV4-NOTE-1，按既有经历写下有限报告；此前失败文字保留，不动旧DA5记录。即使知识10失败，原纸已写过，仍须实际交回。');
  }
  s.spirituality -= a.spiritualityCost;
  const checked = success(ctx.check('knowledge', a.method === 'ABILITY' ? 18 : 10).tier);
  if (a.method === 'ABILITY') {
    a.seed = checked ? 'PLANTED' : 'FAILED'; l.stage.seed = checked ? 'PLANTED' : 'NONE'; r.status = checked ? 'PREPARED' : 'OBSERVED';
    ctx.note(checked ? '已付费埋种，尚未催化' : '已付费埋种失败', checked ? '1行动4灵性已付，知识18成功，只留下本次PLANTED种子；没有催化效果、报告或奖励。当前本人仍同意且强烈兴奋时可0额外行动另3灵性催化；也可由她撤回同意或实际停止。' : '1行动4灵性已付，知识18失败，无种子、效果或奖励；先0行动实际停止，下一真实周才可重试。');
  } else {
    a.success = checked; r.status = checked ? 'EXAMINED' : 'OBSERVED';
    if (c.caseId === 'bounded-account') l.account.writings[l.account.writings.length - 1] += checked ? ' 本次知识10核对成功，尚须确认有限说法。' : ' 本次知识10核对失败，原错误保留，未形成可报告结果。';
    ctx.note(checked ? '普通核对取得有限结果' : '普通核对失败，实际经过保留', checked ? reportText(s, c.caseId) + '1行动0灵性，尚须真实收束；记录纸另须明确有限说法。' : '1行动0灵性已付，未形成可报告结果。已发生的本人选择、普通路线和同纸书写保留；先0行动真实收束，下一真实周再核对，不退款。');
  }
}

export function devilLifeActions(s: SliceState): DevilLifeAction[] {
  if (!promoted(s)) return [];
  const out: DevilLifeAction[] = [], l = s.devil.life;
  const add = (id: string, label: string, cost: string, command: DevilActivityCommand) => { const reason = devilActivityReason(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  add('devil-compose', '花时间收束自己的原紧绷', '1行动 · 原紧绷−1 · 不恢复健康、精神、灵性或良知', { type: 'COMPOSE' });
  for (const p of CASES) {
    const r = l.cases[p.id];
    if (p.id === 'stage-decision' && l.stage.seed === 'PLANTED') {
      add(`${p.id}-catalyze`, '在同次付费种子上尝试有限催化', '0额外行动 · 另3灵性 · 知识18 · 失败照耗', { type: 'CATALYZE', caseId: p.id });
      add(`${p.id}-consent`, '听取米蕾尔本人撤回这次同意', '0行动 · 当前情绪平复 · 种子到期 · 仍须实际停止', { type: 'WITHDRAW_CONSENT', caseId: p.id });
    }
    if (p.id === 'returned-invitation' && l.invitation.playerNode === 'SHELF') add(`${p.id}-return`, '携同一原邀请普通走一米回到导师', '0行动 · 实际一米原路 · 不瞬移', { type: 'RETURN_ROUTE', caseId: p.id });
    if (p.id === 'bounded-account' && r.attempts.length && r.status !== 'RESOLVED') {
      add(`${p.id}-limited`, l.account.claim === 'GUARANTEED' ? '在同一原纸更正为有限说法LIMITED' : '确认只支持有限结果LIMITED', '0行动 · 普通文本核对 · 不改变实际判定', { type: 'CONFIRM_ACCOUNT', caseId: p.id, claim: 'LIMITED' });
      add(`${p.id}-guaranteed`, '声称必然控制与保证安全GUARANTEED', '0行动 · 导师会明确拒绝 · 无奖励', { type: 'CONFIRM_ACCOUNT', caseId: p.id, claim: 'GUARANTEED' });
    }
    if (r.contactOpen) add(`${p.id}-close`, p.id === 'stage-decision' ? '停止并实际等待六十秒G窗口' : p.id === 'bounded-account' ? '亲手交回同一张已写原纸' : '实际结束本次普通讨论', '0行动 · 0灵性 · 真实收束 · 不退款', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(`${p.id}-observe`, '当面核对原人和同一原物', '1行动 · 只看可见事实与本人表述', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED' && !r.contactOpen) {
      add(`${p.id}-ability`, p.id === 'stage-decision' ? '准备本人同意的一次埋种试验' : '查看本案缺少能力入口的原因', '1行动准备 · 非施法 · 能力条件必须实际存在', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(`${p.id}-ordinary`, '准备普通讨论、核对或书写', '1行动 · 不耗灵性', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED' && !r.contactOpen) {
      add(`${p.id}-perform`, r.method === 'ABILITY' ? '实际尝试本次有限埋种' : '实际实施本次普通方法', r.method === 'ABILITY' ? '1行动 · 4灵性 · 知识18 · 成功只埋种' : '1行动 · 0灵性 · 知识10 · 失败保留实际经过', { type: 'PERFORM', caseId: p.id });
      add(`${p.id}-withdraw`, '取消尚未实施的准备', '0行动 · 已付成本不退', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(`${p.id}-report`, '报告已经真实收束的有限结果', '1行动 · 扮演+25 · 同案仅一次', { type: 'REPORT', caseId: p.id });
  }
  if (!l.reflected) add('devil-reflect', '回看三种本人选择与有限结果', '1行动 · 三份原报告后 · 扮演+25', { type: 'REFLECT' });
  return out;
}
export function projectDevilLife(s: SliceState): DevilLifeProjection {
  if (!promoted(s)) return { cases: [], insideCase: false, environment: '', practice: null };
  const l = s.devil.life, f = l.stage, i = l.invitation, a = l.account;
  return {
    insideCase: hasDevilLifeLock(s), environment: DEVIL_LIFE_ENVIRONMENT,
    cases: CASES.map(p => {
      const r = l.cases[p.id], planted = p.id === 'stage-decision' && f.seed === 'PLANTED';
      const result = planted ? '1行动4灵性已付，PLANTED只代表成功埋种，尚未催化、报告或取得奖励。可另3灵性尝试，或本人撤回/0行动停止。' : completed(r) ? reportText(s, p.id) + (r.contactOpen ? '本次接触尚未实际结束。' : '本次接触已经实际结束。') : r.attempts.length ? `实际尝试${r.attempts.length}次，未成结果和已付费用保留；${r.contactOpen ? '须0行动真实停止或原路返回。' : '下一真实周可重新准备。'}` : r.withdrawals ? '尚未实施的准备已经取消，未取得奖励。' : null;
      return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts], preparation: r.status === 'PREPARED' && !r.contactOpen ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result, status: r.status, contactOpen: r.contactOpen ? '本次接触仍开着，须真实停止并完成原物交接' : '本次没有尚待结束的接触', closes: r.closes };
    }),
    practice: {
      emotion: f.emotion === 'STRONG' ? '当前原米蕾尔因本人自主新朗读而强烈兴奋，来源为实际表情、语速与当面表述' : '当前没有正在进行的强烈情绪试验；旧S5情绪与费兰历史不重开',
      seedState: f.seed,
      seed: f.seed === 'PLANTED' ? 'PLANTED：本次1行动4灵性已付，尚无催化效果；另3灵性知识18或0行动停止' : f.seed === 'SPENT' ? 'SPENT：同一种子已用于一次另付3灵性的催化，成功或失败保留' : f.seed === 'EXPIRED' ? 'EXPIRED：同一种子因撤回或实际等待到期，不能再催化' : 'NONE：没有本次可用种子',
      consent: `${f.consented ? '米蕾尔当面仅同意本次有限范围，仍可撤回' : '当前没有继续试验的同意'}；本人明确撤回${f.consentWithdrawals}次`,
      program: `同一DV4-PROGRAM-1始终由米蕾尔本人持有；实际新短读${f.readings}次，当前可见迟疑${f.pauseSeconds}秒，实际收束等待累计${f.waitedSeconds}秒G`,
      invitation: `同一DV4-INVITATION-1：${i.holder === 'GUIDE' ? '罗安保管' : i.holder === 'REINA' ? '蕾娜已实际接过查看' : '本人实际持有'}；${i.declined ? '蕾娜已自行拒绝，原拒绝永久保留' : '尚未作出本次选择'}；本人情绪CALM，无能力入口`,
      route: `本人在${i.playerNode === 'SHELF' ? '一米外原架旁' : '原导师旁'}；实际普通行走${i.walks}次、${i.distanceMetres}米；拒绝后须携同纸原路返回，重试只核对旧记录`,
      account: `同一DV4-NOTE-1由${a.holder === 'GUIDE' ? '罗安' : '本人'}持有；实际书写${a.writings.length}次、交回${a.handovers}次；${a.claim === 'GUARANTEED' ? 'GUARANTEED保证说法被明确拒绝，须在同纸更正' : a.accepted ? 'LIMITED有限说法已被普通核对接受' : '尚未确认有限说法'}，明确更正${a.corrections}次。没有魔法契约或灵魂所有权。`,
      history: [
        ...DEVIL_CASE_IDS.flatMap(id => l.cases[id].attempts.map(x => `${id} W${x.week}：${x.method === 'ABILITY' ? '能力试验' : '普通实践'}，实际${x.actionCost}行动/${x.spiritualityCost}灵性；${x.seed === 'PLANTED' ? '仅埋种未完成' : x.success ? '真实判定成功' : '未成结果'}${x.catalysis === null ? '' : x.catalysis ? '，催化成功' : '，催化失败'}${x.consentWithdrawn ? '，本人撤回同意' : ''}`)),
        ...a.writings,
        a.claims.length ? `同一纸说法历史：${a.claims.join(' → ')}；拒绝与更正均保留。` : '原记录纸尚无说法核对历史。',
        '旧犯罪/折翼/连环杀手/恶魔/欲望使徒状态、旧身体与费兰/莫顿结局保留；COMPOSE只以原规则1行动减少1原紧绷。',
        '新增4训练、窗口、距离和接受标准均为G；完整4能力表/配方/仪式未知，不把有限三案称为原著完整魔鬼或无风险消化。',
      ],
    },
  };
}

/** Save validation follows actual paid attempts, original object locations and explicit cleanup. */
export function validateDevilLife(s: SliceState): boolean {
  try {
    const l = s.devil.life, start = s.devil.promotionWeek ?? s.week;
    if (!record(l) || !shape(l, ['cases', 'reflected', 'stage', 'invitation', 'account']) || !record(l.cases) || !shape(l.cases, DEVIL_CASE_IDS) || typeof l.reflected !== 'boolean') return false;
    if (s.devil.promotionWeek === null) return stableStringify(l) === stableStringify(createDevilLifeState());
    let open = 0, prepared = 0, resolved = 0;
    for (const [index, id] of DEVIL_CASE_IDS.entries()) {
      const r = l.cases[id];
      if (!record(r) || !shape(r, ['status', 'method', 'contactOpen', 'preparations', 'withdrawals', 'closes', 'attempts']) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status) || ![null, 'ABILITY', 'ORDINARY'].includes(r.method) || typeof r.contactOpen !== 'boolean' || ![r.preparations, r.withdrawals, r.closes].every(x => integer(x)) || !Array.isArray(r.attempts)) return false;
      if (id !== 'stage-decision' && r.method === 'ABILITY') return false;
      let prev = start - 1;
      for (const [n, a] of r.attempts.entries()) {
        if (!record(a) || !shape(a, ['week', 'method', 'success', 'actionCost', 'spiritualityCost', 'seed', 'catalysis', 'consentWithdrawn']) || !integer(a.week, Math.max(start, prev + 1), s.week) || !['ABILITY', 'ORDINARY'].includes(a.method) || typeof a.success !== 'boolean' || a.actionCost !== 1 || ![0, 4, 7].includes(a.spiritualityCost) || !['NONE', 'FAILED', 'PLANTED', 'SPENT', 'EXPIRED'].includes(a.seed) || ![null, true, false].includes(a.catalysis) || typeof a.consentWithdrawn !== 'boolean') return false;
        if (a.method === 'ABILITY') {
          if (id !== 'stage-decision' || a.seed === 'NONE' || a.spiritualityCost !== (a.catalysis === null ? 4 : 7) || (a.seed === 'SPENT') !== (a.catalysis !== null) || a.success !== (a.catalysis === true) || a.consentWithdrawn && a.seed !== 'EXPIRED') return false;
          if (a.seed === 'PLANTED' && (n !== r.attempts.length - 1 || !r.contactOpen || r.status !== 'PREPARED')) return false;
        } else if (a.spiritualityCost !== 0 || a.seed !== 'NONE' || a.catalysis !== null || a.consentWithdrawn) return false;
        if (a.success && n !== r.attempts.length - 1) return false;
        prev = a.week;
      }
      const a = last(r), pending = a?.seed === 'PLANTED', ready = r.status === 'PREPARED' && !r.contactOpen;
      if (r.closes !== r.attempts.length - Number(r.contactOpen) || r.preparations !== r.attempts.length + r.withdrawals + Number(ready) || r.contactOpen && (!a || a.week !== s.week) || r.status === 'AVAILABLE' && stableStringify(r) !== stableStringify(emptyCase())) return false;
      if (completed(r) !== (a?.success ?? false) || (r.status === 'PREPARED' || completed(r) || r.contactOpen) && r.method === null || (r.contactOpen || completed(r)) && r.method !== a?.method || !r.contactOpen && ['AVAILABLE', 'OBSERVED'].includes(r.status) && r.method !== null || r.status === 'RESOLVED' && r.contactOpen || r.status === 'PREPARED' && r.contactOpen && !pending || ready && a?.week === s.week) return false;
      if (index > 0 && r.status !== 'AVAILABLE' && l.cases[DEVIL_CASE_IDS[index - 1]!].status !== 'RESOLVED') return false;
      if (s.seer.completedSources.filter(x => x === source(id)).length !== Number(r.status === 'RESOLVED')) return false;
      open += Number(r.contactOpen); prepared += Number(ready); resolved += Number(r.status === 'RESOLVED');
    }
    if (open > 1 || prepared > 1 || open && prepared) return false;
    const f = l.stage, i = l.invitation, a = l.account, stage = l.cases['stage-decision'], invite = l.cases['returned-invitation'], account = l.cases['bounded-account'], tail = last(stage);
    if (!record(f) || !shape(f, ['subjectId', 'programId', 'programHolder', 'emotion', 'consented', 'readings', 'consentWithdrawals', 'seed', 'pauseSeconds', 'waitedSeconds']) || f.subjectId !== 'MIREL' || f.programId !== 'DV4-PROGRAM-1' || f.programHolder !== 'MIREL' || typeof f.consented !== 'boolean' || f.readings !== stage.attempts.length || f.consentWithdrawals !== stage.attempts.filter(x => x.consentWithdrawn).length || f.waitedSeconds !== stage.closes * 60) return false;
    const expectedSeed = tail?.seed === 'FAILED' || !tail ? 'NONE' : tail.seed;
    if (f.seed !== expectedSeed || f.emotion !== (stage.contactOpen && !tail?.consentWithdrawn ? 'STRONG' : 'CALM') || f.pauseSeconds !== (stage.contactOpen && tail?.catalysis === true ? 30 : 0) || stage.contactOpen && f.consented !== !tail?.consentWithdrawn || stage.status === 'AVAILABLE' && f.consented || !stage.contactOpen && stage.attempts.length > 0 && stage.status !== 'PREPARED' && f.consented) return false;
    if (!record(i) || !shape(i, ['id', 'subjectId', 'emotion', 'holder', 'declined', 'shelfPlacements', 'playerNode', 'walks', 'distanceMetres']) || i.id !== 'DV4-INVITATION-1' || i.subjectId !== 'REINA' || i.emotion !== 'CALM' || !['GUIDE', 'REINA', 'PLAYER'].includes(i.holder) || !['GUIDE', 'SHELF'].includes(i.playerNode) || i.declined !== (invite.attempts.length > 0) || i.shelfPlacements !== Number(i.declined)) return false;
    if (!i.declined) {
      if (i.holder !== (invite.status === 'AVAILABLE' ? 'GUIDE' : 'REINA') || i.playerNode !== 'GUIDE' || i.walks !== 0) return false;
    } else if (i.playerNode === 'SHELF') {
      if (!invite.contactOpen || invite.attempts.length !== 1 || i.holder !== 'PLAYER' || i.walks !== 1) return false;
    } else if (i.holder !== 'GUIDE' || i.walks !== 2) return false;
    if (i.distanceMetres !== i.walks) return false;
    if (!record(a) || !shape(a, ['id', 'holder', 'writings', 'claim', 'accepted', 'claims', 'corrections', 'handovers']) || a.id !== 'DV4-NOTE-1' || a.holder !== (account.contactOpen ? 'PLAYER' : 'GUIDE') || !Array.isArray(a.writings) || a.writings.length !== account.attempts.length || a.writings.some(x => typeof x !== 'string' || !x.includes('DV4-PROGRAM-1') || !x.includes('DV4-INVITATION-1')) || ![null, 'LIMITED', 'GUARANTEED'].includes(a.claim) || a.accepted !== (a.claim === 'LIMITED') || !Array.isArray(a.claims) || a.claims.some(x => !['LIMITED', 'GUARANTEED'].includes(x)) || !integer(a.corrections, 0, a.claims.filter(x => x === 'LIMITED').length) || a.handovers !== account.closes) return false;
    if (!a.writings.length && (a.claim !== null || a.claims.length !== 0 || a.corrections !== 0) || a.claim !== null && a.claims.at(-1) !== a.claim || account.status === 'RESOLVED' && !a.accepted) return false;
    if (s.seer.completedSources.filter(x => x === 'devil-reflection').length !== Number(l.reflected) || l.reflected && resolved !== 3) return false;
    if (hasDevilLifeLock(s) && (s.world.city !== 'BACKLUND' || s.status !== 'ACTIVE' || !!s.activeEvent || !!s.combat)) return false;
    return !promoted(s) || (s.progression.sequence===3?s.blatherer.devilActingAtPromotion:s.progression.acting) === resolved * 25 + Number(l.reflected) * 25;
  } catch { return false; }
}
