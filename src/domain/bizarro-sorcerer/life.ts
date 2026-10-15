import type { PublicResolutionTier } from '../../shared/contracts.js';
import type { SliceState } from '../slice/types.js';
import { stableStringify } from '../canonical.js';
import { awardSeerMastery, type SeerContext } from '../seer/index.js';
import type { BizarroSorcererAction } from './types.js';
import { hasBizarroRitualLock } from './ritual.js';

export const BIZARRO_CASE_IDS = ['two-flames', 'one-way-gift', 'paired-positions'] as const;
export type BizarroCaseId = typeof BIZARRO_CASE_IDS[number];
export type BizarroActivityCommand =
  | { type: 'OBSERVE' | 'PERFORM' | 'CLOSE' | 'REPORT' | 'WITHDRAW'; caseId: BizarroCaseId }
  | { type: 'PREPARE'; caseId: BizarroCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'CAPTURE_MOUSE' | 'RELEASE_MOUSE' | 'BEGIN_MOUSE_CONTROL' | 'ASSIGN_WORM' | 'RECALL_WORM'
      | 'FLAME_OUT' | 'FLAME_BACK' | 'PUPPET_ILLUSION' | 'WALK_MOUSE_FAR' | 'SWAP_OUT' | 'SWAP_BACK' | 'RETURN_ORDINARY' | 'REFLECT' }
  | { type: 'COMPLETE_MOUSE_CONTROL'; confirmedDeath: true }
  | { type: 'DISMISS_MOUSE'; confirmedLoss: true };
export interface BizarroCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED';
  observedWeek: number | null; attemptWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; closes: number; withdrawals: number;
  outwardAttempted: boolean; returnAttempted: boolean; abilityUses: number; returned: boolean;
}
export interface BizarroPractice {
  activeCase: BizarroCaseId | null; ownerAt: 'NEAR' | 'FAR';
  tag: { id: 'BR4-TAG-1'; massGrams: 1; holder: 'CARRIER' | 'OWNER' | 'MOUSE' };
  carrier: { id: 'BR4-CARRIER-1'; holder: 'OWNER' };
  flamesLit: [boolean, boolean]; illusionActive: boolean;
}
export interface BizarroLifeState {
  mouse: { id: 'BR4-MOUSE-1'; nature: 'ORDINARY_WILD_MOUSE'; alive: boolean;
    status: 'WILD' | 'HELD' | 'INITIAL_CONTROL' | 'CONTROLLED' | 'RELEASED' | 'INERT';
    location: 'WILD' | 'CARRIER' | 'NEAR' | 'FAR' | 'RELEASE_SITE'; spirituality: number; illusionUses: 0 | 1;
    captureAttemptWeek: number | null; capturedWeek: number | null; elapsedSeconds: 0 | 3 | 15;
    initialOutcome: PublicResolutionTier | null; completeOutcome: PublicResolutionTier | null };
  worms: { capacity: 50; split: 0 | 1; assigned: 0 | 1; recalled: 0 | 1; lost: 0 | 1 };
  practice: BizarroPractice; cases: Record<BizarroCaseId, BizarroCaseState>; reflected: boolean;
}
export interface BizarroCaseProjection {
  id: string; title: string; story: string; observations: string[]; preparation: string | null;
  result: string | null; status: string; contactOpen: string; closes: number;
}
export interface BizarroLifeProjection {
  title: string; source: string; environment: string; insideCase: boolean;
  mouse: { id: string; status: string; alive: boolean; spirituality: number; elapsedSeconds: number; location: string; irreversibleWarning: string };
  worms: { capacity: number; split: number; assigned: number; recalled: number; lost: number; risk: string };
  positions: { owner: string; mouse: string; tag: string; ownerItem: string };
  practice: BizarroPractice; cases: BizarroCaseProjection[];
}
const CASES = [
  { id: 'two-flames', title: '十二米外的第二簇火',
    story: '修灯人梅芙把原院两只火盆放在相距12米的近端与远端。她等着你亲自核对远端的灯罩，再回近端告诉她结果；原地表小路全程畅通。（原创G）',
    facts: ['付费实施后实际点燃两只原火盆，只有真火之间才能尝试跳跃。', '能力去程与返程各3灵性、各自检定；实际步行往返也能完成核对。'],
    ability: '准备原火盆与净空小路；实施后分别选择真实去程和返程。',
    ordinary: '准备沿原12米小路亲自走到远端看灯罩，再原路走回。',
    result: '同一身体实际去回，原火盆已经熄灭，灯罩核对结果留给梅芙。' },
  { id: 'one-way-gift', title: '原纸签上的一抹蓝色',
    story: '梅芙要在原1克纸签上区分临时蓝光与真实颜料。桌边原活盆栽和原木块只是对照物。你可以普通手工核对，也可以让实际转化的原鼠携纸签，在真实灵之虫赋能后呈现有限幻象。（原创G）',
    facts: ['原鼠只负载这一张≤1克原纸签，不承载人或武器；活盆栽仍活着，木块仍是无生命物。', '实际分出一条虫沿真实灵体之线赋能：主人3灵性、精神−2；原鼠施幻象用自身3灵性、主人另2灵性。', '这是主人向秘偶单向赋能，主人不能取得鼠的本能；原纸签和虫须真实取回。'],
    ability: '准备同一鼠、原纸签与可见近端；分虫、幻象和召回必须分别实施。',
    ordinary: '准备亲手在同一原纸签上比较颜料与灯光，不使用秘偶或赋能。',
    result: '原纸签已亲手取回原携笼，短时视觉变化已结束；原盆栽与木块均未转化。' },
  { id: 'paired-positions', title: '两块垫子与同一身体',
    story: '梅芙在相距6米的两块净空垫旁等候收工。若选择换位，必须先让同一受控鼠沿原地面走到远端；若不使用秘偶，你就亲手带原纸签到远垫核对，再走回。（原创G）',
    facts: ['只有真实原秘偶在已知远垫时才能互换；空位置、木块和盆栽都不是秘偶。', '每次换位主人2灵性，身体及各自携物一起变位；主人携笼随主人，鼠携原签随鼠。', '成功去程后仍须明确选择换回或实际步行收鼠返回，不能用结束按钮瞬移。'],
    ability: '准备原6米近远垫；实施后先真实放鼠走到远端，再各自尝试去回换位。',
    ordinary: '准备由本人携同一原纸签走到远垫，核对后沿原路返回。',
    result: '主人回到近端，原鼠身体与同一原纸签收回原小携笼；现场没有第二个身体或副本。' },
] as const;
export const BIZARRO_ENVIRONMENT = '三处原场景、检定与费用为原创G。观察、准备、实施、报告各1行动；实施包已支付现场有限去回与收束时间，后续明确子步骤0行动，能力仍各自耗灵。失败当周不能重试，须实际收束后下周再准备。三报告各25扮演，反思25；只有实际完成能力结果才取得既有已知池单项掌握8，普通方式也能完成100扮演。仅一个原野鼠，可活捕放生；完整转化导致原鼠真正死亡、不可逆。50是新晋秘偶/分虫容量，不是50具身体或现成虫。本切片只实际分出1虫；召回花2灵性且不返精神，未召回就明确解除控制会失去这条虫、精神−10与污染+10。收束后原鼠和原纸签在主人手持BR4-CARRIER-1内随普通行程同行，未自动布置到任何战场。初控3秒与继续12秒只针对本作这一弱鼠，不是对所有目标的保证。没有历史投影、借用过去或让原多恩复活。';
export const BR_ENVIRONMENT = BIZARRO_ENVIRONMENT;
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const success = (v: PublicResolutionTier | null) => v === 'SUCCESS' || v === 'GREAT_SUCCESS';
const active = (s: SliceState) => s.progression.pathwayId === 'diviner' && s.progression.sequence === 4;
const freshCase = (): BizarroCaseState => ({ status: 'AVAILABLE', observedWeek: null, attemptWeek: null, method: null, result: 'NONE', contactOpen: false, closes: 0, withdrawals: 0, outwardAttempted: false, returnAttempted: false, abilityUses: 0, returned: false });
export function createBizarroLifeState(): BizarroLifeState {
  return { mouse: { id: 'BR4-MOUSE-1', nature: 'ORDINARY_WILD_MOUSE', alive: true, status: 'WILD', location: 'WILD', spirituality: 6, illusionUses: 0,
    captureAttemptWeek: null, capturedWeek: null, elapsedSeconds: 0, initialOutcome: null, completeOutcome: null },
    worms: { capacity: 50, split: 0, assigned: 0, recalled: 0, lost: 0 },
    practice: { activeCase: null, ownerAt: 'NEAR', tag: { id: 'BR4-TAG-1', massGrams: 1, holder: 'CARRIER' }, carrier: { id: 'BR4-CARRIER-1', holder: 'OWNER' }, flamesLit: [false, false], illusionActive: false },
    cases: { 'two-flames': freshCase(), 'one-way-gift': freshCase(), 'paired-positions': freshCase() }, reflected: false };
}
export const bizarroPractice = (s: SliceState): BizarroPractice => structuredClone(s.bizarroSorcerer.life.practice);
export const bizarroInside = (s: SliceState): boolean => {
  const l = s.bizarroSorcerer.life;
  return l.practice.activeCase !== null || l.practice.ownerAt !== 'NEAR' || ['HELD', 'INITIAL_CONTROL'].includes(l.mouse.status) || l.worms.assigned > 0;
};
const SIMPLE_COMMANDS = ['CAPTURE_MOUSE', 'RELEASE_MOUSE', 'BEGIN_MOUSE_CONTROL', 'ASSIGN_WORM', 'RECALL_WORM', 'FLAME_OUT', 'FLAME_BACK', 'PUPPET_ILLUSION', 'WALK_MOUSE_FAR', 'SWAP_OUT', 'SWAP_BACK', 'RETURN_ORDINARY', 'REFLECT'];
export function validateBizarroActivityCommand(v: unknown): v is BizarroActivityCommand {
  if (!record(v)) return false;
  if (SIMPLE_COMMANDS.includes(v.type as string)) return shape(v, ['type']);
  if (v.type === 'COMPLETE_MOUSE_CONTROL') return shape(v, ['type', 'confirmedDeath']) && v.confirmedDeath === true;
  if (v.type === 'DISMISS_MOUSE') return shape(v, ['type', 'confirmedLoss']) && v.confirmedLoss === true;
  if (!BIZARRO_CASE_IDS.includes(v.caseId as BizarroCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(v.method as string);
  return ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(v.type as string) && shape(v, ['type', 'caseId']);
}
export const isBizarroActivity = validateBizarroActivityCommand;
export function blockBizarroActivity(s: SliceState, c: BizarroActivityCommand): string | null {
  if (!validateBizarroActivityCommand(c)) return '诡法师生活命令无效，完整转化必须明确确认原鼠死亡。';
  if (s.status !== 'ACTIVE' || !active(s)) return '须在仍活着的诡法师阶段。';
  if (s.activeEvent || s.combat) return '先处理当前事件或真实战斗。';
  if (hasBizarroRitualLock(s)) return '先真实结束钟楼现场并按原路返回，不能同时展开生活实践。';
  if (s.world.city !== 'BACKLUND') return '先实际回到贝克兰德原练习点，不能从异地收束传回。';
  const l = s.bizarroSorcerer.life, f = l.practice, m = l.mouse, w = l.worms;
  const r = 'caseId' in c ? l.cases[c.caseId] : f.activeCase ? l.cases[f.activeCase] : null;
  if (c.type === 'RELEASE_MOUSE') return m.alive && ['HELD', 'INITIAL_CONTROL'].includes(m.status) ? null : '没有仍活着且尚可放生的原鼠。';
  if (c.type === 'DISMISS_MOUSE') return m.status === 'CONTROLLED' ? null : '没有仍受控的同一已死原鼠。';
  if (c.type === 'RETURN_ORDINARY') return f.activeCase ? null : '没有已经支付实施时间的原现场。';
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW' && r?.contactOpen) {
    if (!r?.contactOpen || f.activeCase !== c.caseId) return '没有这一项尚未收束的原现场。';
    if (!r.returned || f.ownerAt !== 'NEAR' || f.tag.holder !== 'CARRIER' || ['NEAR', 'FAR'].includes(m.location)) return '先明确沿原路实际返回并将原物收回携笼；CLOSE不能瞬移。';
    return w.assigned ? '先实际召回原虫，或明确承担丢失风险解除控制。' : null;
  }
  if (c.type === 'RECALL_WORM') return !w.assigned ? '没有尚在原鼠中的实际虫。' : s.spirituality < 2 ? '召回需要2灵性；可明确承担失虫风险解除控制。' : null;
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神，或使用明确的普通返程及释放。';
  if (c.type === 'BEGIN_MOUSE_CONTROL') return m.status !== 'HELD' ? '先普通活捕同一仍活着的原鼠。' : s.spirituality < 3 ? '初控需要3灵性。' : null;
  if (c.type === 'COMPLETE_MOUSE_CONTROL') return m.status !== 'INITIAL_CONTROL' || m.capturedWeek !== s.week ? '须同一周对仍活着的原鼠完成真实初控。' : s.spirituality < 8 ? '继续12秒需要8灵性，也可0行动放生。' : null;
  if (['ASSIGN_WORM', 'PUPPET_ILLUSION', 'WALK_MOUSE_FAR', 'FLAME_OUT', 'FLAME_BACK', 'SWAP_OUT', 'SWAP_BACK'].includes(c.type)) {
    if (!r?.contactOpen || r.method !== 'ABILITY' || r.returned) return '先实施对应的真实能力实践；已实际返程收物后不能再次展开。';
    if (c.type === 'ASSIGN_WORM') return f.activeCase !== 'one-way-gift' || m.status !== 'CONTROLLED' || m.location !== 'NEAR' ? '须原鼠受控且在原纸签近端现场。' : w.split ? '本切片只分出这一条实际虫，不再分裂或复制。' : s.spirituality < 3 || s.mind <= 2 ? '分虫需要3灵性且精神须高于2，实际精神−2。' : null;
    if (c.type === 'PUPPET_ILLUSION') return f.activeCase !== 'one-way-gift' || !w.assigned || m.status !== 'CONTROLLED' || f.tag.holder !== 'MOUSE' ? '须原虫已赋入同一原鼠，原纸签由它携带。' : r.outwardAttempted ? '本次幻象已经尝试，不能反复重刷。' : m.spirituality < 3 || s.spirituality < 2 ? '本次需要原鼠自身3灵性和主人2灵性。' : null;
    if (c.type === 'WALK_MOUSE_FAR') return f.activeCase !== 'paired-positions' || m.status !== 'CONTROLLED' || m.location !== 'NEAR' || r.outwardAttempted ? '须尚未换位的受控原鼠在近垫。' : null;
    if (c.type === 'FLAME_OUT' || c.type === 'FLAME_BACK') {
      if (f.activeCase !== 'two-flames' || !f.flamesLit.every(Boolean)) return '须同一原场地两簇真实火焰仍燃烧。';
      if (c.type === 'FLAME_OUT' ? r.outwardAttempted || f.ownerAt !== 'NEAR' : r.returnAttempted || r.abilityUses !== 1 || f.ownerAt !== 'FAR') return '本段已尝试或本人不在真实对应火盆旁。';
      return s.spirituality < 3 ? '本段需要3灵性；普通原路返程仍可0灵性选择。' : null;
    }
    if (f.activeCase !== 'paired-positions' || m.status !== 'CONTROLLED' || f.tag.holder !== 'MOUSE') return '须原6米现场同一受控鼠和它携带的原纸签。';
    if (c.type === 'SWAP_OUT' ? r.outwardAttempted || f.ownerAt !== 'NEAR' || m.location !== 'FAR' : r.returnAttempted || r.abilityUses !== 1 || f.ownerAt !== 'FAR' || m.location !== 'NEAR') return '真实两身体没有处于本段对应的近远垫，不能向空处换位。';
    return s.spirituality < 2 ? '本次换位需要主人2灵性；仍可选择普通返程。' : null;
  }
  if (bizarroInside(s)) return '先释放活鼠或实际返回、收物、召虫并结束当前现场。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚未实施的准备。';
  if (Object.entries(l.cases).some(([id, v]) => v.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先实施或取消当前准备。';
  if (s.actionsRemaining < 1) return '本次需要1行动。';
  if (c.type === 'CAPTURE_MOUSE') return m.status !== 'WILD' ? '原鼠已经捕获、放生或死亡，不补出第二只。' : m.captureAttemptWeek === s.week ? '本周活捕失败，下一真实周可再找同一原鼠。' : null;
  if (c.type === 'REFLECT') return l.reflected ? '已经反思这三项经历。' : BIZARRO_CASE_IDS.some(id => l.cases[id].status !== 'RESOLVED') ? '先完成三份实际报告。' : null;
  if (!r || !('caseId' in c)) return '未知生活事项。';
  if (r.status === 'RESOLVED') return '本项已经报告，不能重领奖励。';
  if (c.type === 'OBSERVE') {
    const previous = BIZARRO_CASE_IDS[BIZARRO_CASE_IDS.indexOf(c.caseId) - 1];
    return r.status !== 'AVAILABLE' ? '原观察已经保留。' : previous && l.cases[previous].status !== 'RESOLVED' ? '先完成上一项实际报告。' : null;
  }
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察同一原现场。' : r.attemptWeek === s.week ? '本周已实施，实际收束后下一真实周再准备。' : c.method === 'ABILITY' && c.caseId !== 'two-flames' && m.status !== 'CONTROLLED' ? '这项能力需要实际转化且仍受控的唯一原鼠；可以选择普通方式。' : c.method === 'ABILITY' && c.caseId === 'one-way-gift' && (w.split || m.spirituality < 3) ? '本切片这一条虫或原鼠灵性已用于实际尝试，可改普通方式。' : null;
  if (c.type === 'REPORT') return r.status === 'EXAMINED' && r.returned && r.result !== 'NONE' ? null : '须取得实际结果、真实返程并收束后报告。';
  if (c.type === 'PERFORM' && r.status === 'PREPARED') {
    if (r.method === 'ABILITY' && c.caseId !== 'two-flames' && m.status !== 'CONTROLLED') return '原鼠已不受控，不能把原尸体当作仍在工作的秘偶；可取消准备改普通方式。';
    return null;
  }
  return '先准备本次实践。';
}
export function applyBizarroActivity(s: SliceState, c: BizarroActivityCommand, ctx: SeerContext): void {
  const reason = blockBizarroActivity(s, c); if (reason) throw new Error(reason);
  const l = s.bizarroSorcerer.life, f = l.practice, m = l.mouse, w = l.worms;
  const r = 'caseId' in c ? l.cases[c.caseId] : f.activeCase ? l.cases[f.activeCase] : null;
  if (c.type === 'RELEASE_MOUSE') { m.status = 'RELEASED'; m.location = 'RELEASE_SITE'; ctx.note('同一活鼠实际放生', '停止初控并在原墙脚打开原携笼，同一活鼠自行离开；不退款，不补鼠，也没有死亡或秘偶。'); return; }
  if (c.type === 'DISMISS_MOUSE') {
    m.status = 'INERT'; f.illusionActive = false;
    if (w.assigned) { w.assigned = 0; w.lost = 1; s.mind = Math.max(0, s.mind - 10); s.seer.pollution = Math.min(100, s.seer.pollution + 10); }
    ctx.note('解除控制，保留同一原尸体', w.lost ? '原虫未召回便实际失去，G精神−10、污染+10。原鼠尸体仍在原位置，不复活；现场须实际取回原物后结束。' : '同一已死原鼠停止活动，原尸体与已召回虫的记录保留，不复活也不重新捕获。'); return;
  }
  if (c.type === 'BEGIN_MOUSE_CONTROL' || c.type === 'COMPLETE_MOUSE_CONTROL') {
    const initial = c.type === 'BEGIN_MOUSE_CONTROL'; s.spirituality -= initial ? 3 : 8; m.elapsedSeconds = initial ? 3 : 15;
    const result = ctx.check('will', initial ? 12 : 16);
    if (initial) m.initialOutcome = result.tier; else m.completeOutcome = result.tier;
    if (success(result.tier)) { m.status = initial ? 'INITIAL_CONTROL' : 'CONTROLLED'; if (!initial) m.alive = false; }
    else { m.status = 'RELEASED'; m.location = 'RELEASE_SITE'; }
    ctx.note(initial ? '同一弱鼠的真实3秒初控' : '继续12秒，原鼠死亡的不可逆选择', success(result.tier) ? initial ? '3灵性已付，原鼠仍活着，主人专注维持。完整转化另需确认原鼠真正死亡，也可立即放生。' : '8灵性已付，原鼠本人真正死亡，同一原身体成为秘偶并留在原携笼。不是木块变活，也不适用于任意强目标。' : '实际抗拒或联系中断，已付灵性保留。同一原鼠仍活着并从原墙脚离开，不能重复捕获它或制造新鼠。'); return;
  }
  if (c.type === 'ASSIGN_WORM') { s.spirituality -= 3; s.mind -= 2; w.split = 1; w.assigned = 1; ctx.note('实际分出并赋入一条虫', '主人3灵性、精神−2，一条真实灵之虫沿原鼠灵体之线进入原身体；只把主人的能力赋给它，不取得鼠本能，50容量没有变成50条现成虫。'); return; }
  if (c.type === 'RECALL_WORM') { s.spirituality -= 2; w.assigned = 0; w.recalled = 1; f.illusionActive = false; ctx.note('沿原线实际召回同一条虫', '主人另付2灵性，唯一实际分出的虫回归，原短时幻象结束；不返分虫精神、不补鼠灵性，也不增加可重复领奖的虫。'); return; }
  if (c.type === 'RETURN_ORDINARY') {
    f.ownerAt = 'NEAR'; if (['NEAR', 'FAR'].includes(m.location)) m.location = 'CARRIER'; f.tag.holder = 'CARRIER'; f.illusionActive = false; r!.returned = true;
    ctx.note('沿原地面实际返程并收回原物', '0行动、0灵性，时间含已付实践。主人沿始终畅通的原小路走回近端，必要时亲手拾回同一小鼠身体和≤1克原签，收进原手持携笼；不是瞬移、复活、治疗或退款。虫若还在鼠中，仍须明确召回或承担丢失风险。'); return;
  }
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') {
    if (r!.contactOpen) { r!.contactOpen = false; r!.closes++; r!.status = r!.result === 'NONE' ? 'OBSERVED' : 'EXAMINED'; f.activeCase = null; f.flamesLit = [false, false]; }
    else { r!.status = 'OBSERVED'; r!.method = null; }
    if (c.type === 'WITHDRAW') r!.withdrawals++;
    ctx.note('原现场实际收束', '主人、原携笼和原签均已回近端，火盆实际熄灭，能力效果已停止；原鼠若已死亡，仍是同一原尸体。保留真实费用、失败与精神损失。'); return;
  }
  if (c.type === 'WALK_MOUSE_FAR') { m.location = 'FAR'; ctx.note('同一原鼠沿地面走到六米远垫', '主人仍在近垫；同一受控鼠只携原1克纸签走到真实远垫，没有换位、复制或额外能力。'); return; }
  if (['FLAME_OUT', 'FLAME_BACK', 'SWAP_OUT', 'SWAP_BACK', 'PUPPET_ILLUSION'].includes(c.type)) {
    const illusion = c.type === 'PUPPET_ILLUSION', fire = c.type === 'FLAME_OUT' || c.type === 'FLAME_BACK', back = c.type === 'FLAME_BACK' || c.type === 'SWAP_BACK';
    s.spirituality -= fire ? 3 : 2; if (illusion) { m.spirituality -= 3; m.illusionUses = 1; }
    if (back) r!.returnAttempted = true; else r!.outwardAttempted = true;
    const result = ctx.check(fire ? 'perception' : 'will', 12);
    if (success(result.tier)) {
      r!.abilityUses++;
      if (illusion) { r!.result = 'ABILITY'; f.illusionActive = true; }
      else { f.ownerAt = back ? 'NEAR' : 'FAR'; if (!fire) m.location = back ? 'FAR' : 'NEAR'; r!.result = 'ABILITY'; }
    }
    ctx.note(illusion ? '原鼠实际使用主人赋予的有限幻象' : fire ? '同一身体在原两簇火之间跳跃' : '原两身体与各自携物真实互换', success(result.tier) ? illusion ? '主人2灵性和鼠自身3灵性已付，原1克纸签上出现短时蓝色视觉幻象；鼠没有人类负载能力，主人没有取得鼠的能力。现在须取回原签并召回实际虫。' : `本段能力真实成功，本人在${f.ownerAt === 'NEAR' ? '近端' : '远端'}。原携笼随主人，原签仍随其真实持有者；仍须实际返程、收物再结束。` : '本段尝试失败，灵性照付，原身体和携物保留在原先实际位置。本段不能重刷，原地面返程始终可用。'); return;
  }
  s.actionsRemaining--;
  if (c.type === 'CAPTURE_MOUSE') {
    m.captureAttemptWeek = s.week; const result = ctx.check('knowledge', 12);
    if (success(result.tier)) { m.status = 'HELD'; m.location = 'CARRIER'; m.capturedWeek = s.week; }
    ctx.note('原墙脚的唯一野鼠', success(result.tier) ? '1行动以普通活捕方式将BR4-MOUSE-1置于原小携笼。它仍活着，可0行动放生；若选择初控与完整转化，须分别操作并明确确认不可逆死亡。' : '1行动已付，普通活捕失败，原鼠仍在原墙脚活动。下一真实周才能再尝试，不新增第二只。'); return;
  }
  if (c.type === 'REFLECT') { l.reflected = true; s.seer.completedSources.push('bizarro-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25); ctx.note('把变化与代价记在一起', '你区分真实身体去回、单向赋能与位置互换，也保留原鼠生死和虫的实际代价。G扮演+25，普通比较同样能理解边界，不伪造能力掌握。'); return; }
  if (!('caseId' in c)) throw new Error('未知诡法师生活命令。');
  const p = CASES.find(v => v.id === c.caseId)!;
  if (c.type === 'OBSERVE') { r!.status = 'OBSERVED'; r!.observedWeek = s.week; ctx.note(p.title, p.story + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') { r!.status = 'PREPARED'; r!.method = c.method; ctx.note('准备原场景，尚未施术', c.method === 'ABILITY' ? p.ability : p.ordinary); return; }
  if (c.type === 'REPORT') {
    r!.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25);
    if (r!.result === 'ABILITY') awardSeerMastery(s, `bizarro-case:${c.caseId}`, 8, ctx);
    else s.seer.completedSources.push(`bizarro-case:${c.caseId}`);
    ctx.note(p.title, p.result + (r!.result === 'ABILITY' ? '真实能力结果：G扮演+25、既有已知池单项掌握8。' : '普通实际结果：G扮演+25，没有能力掌握奖励。')); return;
  }
  r!.status = 'ACTIVE'; r!.contactOpen = true; r!.attemptWeek = s.week; r!.result = 'NONE'; r!.returned = false;
  r!.outwardAttempted = false; r!.returnAttempted = false; r!.abilityUses = 0; f.activeCase = c.caseId;
  if (c.caseId === 'two-flames') f.flamesLit = [true, true];
  if (r!.method === 'ABILITY') {
    if (c.caseId !== 'two-flames') { m.location = 'NEAR'; f.tag.holder = 'MOUSE'; }
    ctx.note('实施预算已付，原场地现在开放', '1行动实际开始原现场；能力还须明确选择子步骤，各自耗灵并可失败。原地面0行动返程与实际收束始终保留。'); return;
  }
  f.tag.holder = 'OWNER'; if (c.caseId !== 'one-way-gift') f.ownerAt = 'FAR'; r!.outwardAttempted = true;
  const result = ctx.check('knowledge', 12); if (success(result.tier)) r!.result = 'ORDINARY';
  ctx.note(p.title, success(result.tier) ? '你以普通方式亲自核对原物，取得有限结果；本人和同一原签仍在实际实施位置，须明确原路返回收物再报告。' : '普通核对没有取得可靠结果，原位置和已付行动保留；须明确原路返回收束，下周再准备。');
}

export function bizarroActions(s: SliceState): BizarroSorcererAction[] {
  if (!active(s)&&!(s.progression.pathwayId==='diviner'&&(s.progression.sequence===3||s.progression.sequence===2))) return [];
  const l = s.bizarroSorcerer.life, out: BizarroSorcererAction[] = [];
  const add = (command: BizarroActivityCommand, label: string, cost: string) => { const reason = blockBizarroActivity(s, command); out.push({ id: `bizarro-${'caseId' in command ? command.caseId + '-' : ''}${command.type.toLowerCase()}${'method' in command ? '-' + command.method.toLowerCase() : ''}`, label, cost, command, enabled: reason === null, reason }); };
  if (l.mouse.status === 'WILD') add({ type: 'CAPTURE_MOUSE' }, '普通活捕唯一原野鼠', '1行动 · 知识12 · 可放生，不等于秘偶化');
  if (l.mouse.status === 'HELD') add({ type: 'BEGIN_MOUSE_CONTROL' }, '对仍活着的原鼠尝试3秒初控', '0行动 · 已付捕获事项 · 主人3灵性');
  if (l.mouse.status === 'INITIAL_CONTROL') add({ type: 'COMPLETE_MOUSE_CONTROL', confirmedDeath: true }, '继续12秒，确认原鼠真正死亡且不可逆', '0行动 · 主人8灵性 · 独立抗拒判定');
  if (['HELD', 'INITIAL_CONTROL'].includes(l.mouse.status)) add({ type: 'RELEASE_MOUSE' }, '释放并放生同一活鼠', '0行动 · 原鼠离开，不再捕获');
  if (l.mouse.status === 'CONTROLLED') add({ type: 'DISMISS_MOUSE', confirmedLoss: true }, l.worms.assigned ? '确认失去未召回的虫，并解除原鼠控制' : '解除原鼠控制，保留同一已死身体', l.worms.assigned ? '0行动 · 精神−10 · 污染+10 · 原虫实际丢失' : '0行动 · 不复活、不重连');
  if (l.worms.assigned) add({ type: 'RECALL_WORM' }, '沿原线召回实际分出的同一条虫', '0行动 · 主人2灵性 · 精神不返还');
  for (const p of CASES) {
    const r = l.cases[p.id];
    if (r.status === 'AVAILABLE') add({ type: 'OBSERVE', caseId: p.id }, `观察：${p.title}`, '1行动');
    if (r.status === 'OBSERVED') {
      add({ type: 'PREPARE', caseId: p.id, method: 'ABILITY' }, '准备真实能力方式', '1行动 · 尚未施术');
      add({ type: 'PREPARE', caseId: p.id, method: 'ORDINARY' }, '准备普通比较方式', '1行动 · 不必杀死原鼠');
    }
    if (r.status === 'PREPARED') { add({ type: 'PERFORM', caseId: p.id }, '实际实施原现场', '1行动 · 包含有限子步骤和普通返程时间'); add({ type: 'WITHDRAW', caseId: p.id }, '取消尚未实施的准备', '0行动 · 不退款'); }
    if (r.contactOpen) {
      if (r.method === 'ABILITY') {
        if (p.id === 'two-flames') { add({ type: 'FLAME_OUT' }, '从原近端火焰跳到12米远端火焰', '0行动 · 主人3灵性 · 感知12'); add({ type: 'FLAME_BACK' }, '从原远端火焰跳回近端火焰', '0行动 · 另付3灵性 · 独立感知12'); }
        if (p.id === 'one-way-gift') { add({ type: 'ASSIGN_WORM' }, '实际分出一虫沿原线赋入原鼠', '0行动 · 主人3灵性 · 精神−2'); add({ type: 'PUPPET_ILLUSION' }, '原鼠对原纸签施有限蓝色幻象', '0行动 · 主人2灵性 · 鼠自身3灵性 · 意志12'); }
        if (p.id === 'paired-positions') { add({ type: 'WALK_MOUSE_FAR' }, '让同一鼠携原签沿地面走到6米远垫', '0行动 · 不施术'); add({ type: 'SWAP_OUT' }, '与远垫同一原鼠真实互换', '0行动 · 主人2灵性 · 意志12'); add({ type: 'SWAP_BACK' }, '与近垫同一原鼠真实换回', '0行动 · 另付2灵性 · 独立意志12'); }
      }
      add({ type: 'RETURN_ORDINARY' }, '沿原路实际返回，并收同鼠及原签入原携笼', '0行动 · 0灵性 · 不施法、不退款');
      add({ type: 'CLOSE', caseId: p.id }, '实际收束原现场', '0行动 · 须原身体、原物与虫均已处理');
    }
    if (r.status === 'EXAMINED') add({ type: 'REPORT', caseId: p.id }, '报告已经实际完成的有限结果', '1行动 · 扮演25 · 只有真实能力结果才有掌握8');
  }
  if (!l.reflected) add({ type: 'REFLECT' }, '反思变化、往返与不可逆代价', '1行动 · 三报告完成后扮演25');
  return out;
}
export function bizarroCases(s: SliceState): BizarroCaseProjection[] {
  if (!active(s)&&!(s.progression.pathwayId==='diviner'&&(s.progression.sequence===3||s.progression.sequence===2))) return [];
  return CASES.map(p => { const r = s.bizarroSorcerer.life.cases[p.id]; return { id: p.id, title: p.title, story: p.story,
    observations: r.status === 'AVAILABLE' ? [] : [...p.facts], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null,
    result: r.result !== 'NONE' ? r.contactOpen ? '实际结果已发生，但原现场仍须真实返回、收物并结束。' : `${p.result}${r.result === 'ORDINARY' ? '普通比较，无能力掌握。' : '实际能力结果。'}` : r.attemptWeek !== null ? '尚无成功结果；实际费用、原位置和失败保留。' : null,
    status: r.status, contactOpen: r.contactOpen ? '原现场尚待真实收束' : '没有未结束的原现场', closes: r.closes }; });
}
export function projectBizarroLife(s: SliceState): BizarroLifeProjection {
  const l = s.bizarroSorcerer.life, f = l.practice;
  return { title: '有限生活：同一只鼠、同一条虫与原身体', source: '原著新晋范围、容量与单向赋能边界；具体原鼠、原物、检定、费用与场景为本作原创G。', environment: BIZARRO_ENVIRONMENT, insideCase: bizarroInside(s),
    mouse: { id: l.mouse.id, status: l.mouse.status, alive: l.mouse.alive, spirituality: l.mouse.spirituality, elapsedSeconds: l.mouse.elapsedSeconds, location: l.mouse.location, irreversibleWarning: '普通活捕可以放生。完整转化使同一原鼠真正死亡且不可逆；不会复活原多恩、补鼠或复制身体。' },
    worms: { ...l.worms, risk: '50是容量；本次实际最多分出1虫。分出精神−2，召回不退；未召回即解除控制会实际失虫、精神−10、污染+10。过量分裂有精神碎裂与失控风险，本切片不开放。' },
    positions: { owner: f.ownerAt, mouse: l.mouse.location, tag: `${f.tag.id} · ${f.tag.holder}${f.tag.holder === 'MOUSE' ? ` · ${l.mouse.location}` : ` · ${f.ownerAt}`}`, ownerItem: `${f.carrier.id}由本人手持，随本人原身体在${f.ownerAt}；仅容同鼠与≤1克原签` }, practice: bizarroPractice(s), cases: bizarroCases(s) };
}

export function validateBizarroLife(s: SliceState): boolean {
  const l = s.bizarroSorcerer?.life;
  if (!record(l) || !shape(l, ['mouse', 'worms', 'practice', 'cases', 'reflected']) || typeof l.reflected !== 'boolean') return false;
  const m = l.mouse, w = l.worms, f = l.practice;
  if (!record(m) || !shape(m, ['id', 'nature', 'alive', 'status', 'location', 'spirituality', 'illusionUses', 'captureAttemptWeek', 'capturedWeek', 'elapsedSeconds', 'initialOutcome', 'completeOutcome']) || m.id !== 'BR4-MOUSE-1' || m.nature !== 'ORDINARY_WILD_MOUSE' || typeof m.alive !== 'boolean') return false;
  if (!['WILD', 'HELD', 'INITIAL_CONTROL', 'CONTROLLED', 'RELEASED', 'INERT'].includes(m.status) || !['WILD', 'CARRIER', 'NEAR', 'FAR', 'RELEASE_SITE'].includes(m.location) || !integer(m.spirituality, 0, 6) || ![0, 3, 15].includes(m.elapsedSeconds)) return false;
  const week = (v: unknown) => v === null || integer(v, s.bizarroSorcerer.promotionWeek ?? 0, s.week);
  if (!week(m.captureAttemptWeek) || !week(m.capturedWeek) || m.capturedWeek !== null && m.captureAttemptWeek !== m.capturedWeek) return false;
  if (![null, 'GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(m.initialOutcome) || ![null, 'GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(m.completeOutcome)) return false;
  if (m.alive !== !['CONTROLLED', 'INERT'].includes(m.status) || m.status === 'WILD' && (m.location !== 'WILD' || m.capturedWeek !== null || m.elapsedSeconds !== 0) || m.status === 'RELEASED' && m.location !== 'RELEASE_SITE') return false;
  if (m.status !== 'WILD' && m.capturedWeek === null || m.status === 'HELD' && (m.elapsedSeconds !== 0 || m.location !== 'CARRIER' || m.capturedWeek !== s.week) || m.status === 'INITIAL_CONTROL' && (m.elapsedSeconds !== 3 || !success(m.initialOutcome) || m.location !== 'CARRIER' || m.capturedWeek !== s.week)) return false;
  if ((m.elapsedSeconds === 0) !== (m.initialOutcome === null) || (m.elapsedSeconds === 15) !== (m.completeOutcome !== null) || m.completeOutcome !== null && !success(m.initialOutcome)) return false;
  if (['CONTROLLED', 'INERT'].includes(m.status) && (m.elapsedSeconds !== 15 || !success(m.completeOutcome) || !['CARRIER', 'NEAR', 'FAR'].includes(m.location))) return false;
  if (m.status === 'RELEASED' && success(m.completeOutcome)) return false;
  if (!record(w) || !shape(w, ['capacity', 'split', 'assigned', 'recalled', 'lost']) || w.capacity !== 50 || ![w.split, w.assigned, w.recalled, w.lost].every(v => integer(v, 0, 1)) || w.split !== w.assigned + w.recalled + w.lost) return false;
  if (w.split && m.alive || w.assigned && m.status !== 'CONTROLLED' || w.lost && m.status !== 'INERT') return false;
  if (!record(f) || !shape(f, ['activeCase', 'ownerAt', 'tag', 'carrier', 'flamesLit', 'illusionActive']) || ![null, ...BIZARRO_CASE_IDS].includes(f.activeCase) || !['NEAR', 'FAR'].includes(f.ownerAt) || typeof f.illusionActive !== 'boolean') return false;
  if (!record(f.tag) || !shape(f.tag, ['id', 'massGrams', 'holder']) || f.tag.id !== 'BR4-TAG-1' || f.tag.massGrams !== 1 || !['CARRIER', 'OWNER', 'MOUSE'].includes(f.tag.holder)) return false;
  if (!record(f.carrier) || !shape(f.carrier, ['id', 'holder']) || f.carrier.id !== 'BR4-CARRIER-1' || f.carrier.holder !== 'OWNER' || !Array.isArray(f.flamesLit) || f.flamesLit.length !== 2 || f.flamesLit.some(v => typeof v !== 'boolean')) return false;
  if (f.tag.holder === 'MOUSE' && !['NEAR', 'FAR'].includes(m.location) || ['NEAR', 'FAR'].includes(m.location) && !['CONTROLLED', 'INERT'].includes(m.status)) return false;
  if (!record(l.cases) || !shape(l.cases, BIZARRO_CASE_IDS) || !Array.isArray(s.seer.completedSources)) return false;
  let open = 0, prepared = 0, resolved = 0;
  for (const [i, id] of BIZARRO_CASE_IDS.entries()) {
    const r = l.cases[id];
    if (!record(r) || !shape(r, ['status', 'observedWeek', 'attemptWeek', 'method', 'result', 'contactOpen', 'closes', 'withdrawals', 'outwardAttempted', 'returnAttempted', 'abilityUses', 'returned'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || ![null, 'ABILITY', 'ORDINARY'].includes(r.method) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result) || !integer(r.closes) || !integer(r.withdrawals) || !integer(r.abilityUses, 0, id === 'one-way-gift' ? 1 : 2)) return false;
    if (![r.contactOpen, r.outwardAttempted, r.returnAttempted, r.returned].every(v => typeof v === 'boolean') || !week(r.observedWeek) || !week(r.attemptWeek) || r.attemptWeek !== null && (r.observedWeek === null || r.attemptWeek < r.observedWeek)) return false;
    if (r.status === 'AVAILABLE' && stableStringify(r) !== stableStringify(freshCase())) return false;
    if (r.status !== 'AVAILABLE' && (r.observedWeek === null || s.bizarroSorcerer.promotionWeek === null) || i > 0 && r.status !== 'AVAILABLE' && l.cases[BIZARRO_CASE_IDS[i - 1]!].status !== 'RESOLVED') return false;
    if (r.status === 'PREPARED') { prepared++; if (r.method === null || r.contactOpen) return false; }
    if (r.contactOpen) { open++; if (r.status !== 'ACTIVE' || f.activeCase !== id || r.attemptWeek !== s.week || !active(s) || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND' || s.activeEvent || s.combat) return false; }
    if ((r.status === 'ACTIVE') !== r.contactOpen || r.result === 'ABILITY' && (r.method !== 'ABILITY' || r.abilityUses < 1) || r.abilityUses && (!r.outwardAttempted || r.method !== 'ABILITY') || r.returnAttempted && (!r.outwardAttempted || id === 'one-way-gift')) return false;
    if (r.abilityUses > 0 && r.result !== 'ABILITY' || r.abilityUses === 2 && !r.returnAttempted || r.returnAttempted && r.abilityUses < 1 || r.result === 'ORDINARY' && (r.method !== 'ORDINARY' || !r.outwardAttempted || r.abilityUses !== 0)) return false;
    if ((r.result !== 'NONE' || r.outwardAttempted || r.returnAttempted || r.abilityUses || r.returned || r.contactOpen) && r.attemptWeek === null) return false;
    if (['EXAMINED', 'RESOLVED'].includes(r.status) && (r.result === 'NONE' || !r.returned || r.closes < 1 || r.contactOpen)) return false;
    if (r.returned && r.contactOpen && (f.ownerAt !== 'NEAR' || f.tag.holder !== 'CARRIER' || ['NEAR', 'FAR'].includes(m.location))) return false;
    if (r.contactOpen && !r.returned) {
      if (r.method === 'ORDINARY' && (f.tag.holder !== 'OWNER' || f.ownerAt !== (id === 'one-way-gift' ? 'NEAR' : 'FAR'))) return false;
      if (r.method === 'ABILITY' && id === 'two-flames' && (f.tag.holder !== 'CARRIER' || f.ownerAt !== (r.abilityUses === 1 ? 'FAR' : 'NEAR'))) return false;
      if (r.method === 'ABILITY' && id === 'one-way-gift' && (f.tag.holder !== 'MOUSE' || f.ownerAt !== 'NEAR' || m.location !== 'NEAR')) return false;
      if (r.method === 'ABILITY' && id === 'paired-positions') {
        if (f.tag.holder !== 'MOUSE' || f.ownerAt !== (r.abilityUses === 1 ? 'FAR' : 'NEAR') || !['NEAR', 'FAR'].includes(m.location)) return false;
        if (r.abilityUses === 1 && m.location !== 'NEAR' || (r.outwardAttempted && r.abilityUses !== 1) && m.location !== 'FAR') return false;
      }
    }
    if (r.status === 'RESOLVED') resolved++;
    if (s.seer.completedSources.filter(v => v === `bizarro-case:${id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
  }
  if (open > 1 || prepared > 1 || open && prepared || (f.activeCase !== null) !== (open === 1)) return false;
  if (f.flamesLit.some(Boolean) !== (f.activeCase === 'two-flames') || f.flamesLit[0] !== f.flamesLit[1]) return false;
  if (f.activeCase === null && (f.ownerAt !== 'NEAR' || f.tag.holder !== 'CARRIER' || ['NEAR', 'FAR'].includes(m.location) || w.assigned)) return false;
  if (f.activeCase === 'two-flames' && f.tag.holder === 'MOUSE' || f.activeCase !== 'one-way-gift' && w.assigned) return false;
  if (f.activeCase !== null && ['HELD', 'INITIAL_CONTROL'].includes(m.status) || w.split && l.cases['one-way-gift'].attemptWeek === null) return false;
  if (f.illusionActive && (f.activeCase !== 'one-way-gift' || !w.assigned || m.status !== 'CONTROLLED' || f.tag.holder !== 'MOUSE' || l.cases['one-way-gift'].result !== 'ABILITY')) return false;
  if (!integer(m.illusionUses, 0, 1) || m.illusionUses > w.split || m.spirituality !== 6 - m.illusionUses * 3 || l.cases['one-way-gift'].method === 'ABILITY' && l.cases['one-way-gift'].outwardAttempted && m.illusionUses !== 1) return false;
  if (s.seer.completedSources.filter(v => v === 'bizarro-reflection').length !== (l.reflected ? 1 : 0) || l.reflected && resolved !== 3) return false;
  if (s.bizarroSorcerer.promotionWeek === null && stableStringify(l) !== stableStringify(createBizarroLifeState())) return false;
  return s.progression.pathwayId==='diviner'&&(s.progression.sequence===3||s.progression.sequence===2) ? s.ancientScholar.bizarroActingAtPromotion===resolved*25+(l.reflected?25:0) : !active(s) || s.progression.acting === resolved * 25 + (l.reflected ? 25 : 0);
}
