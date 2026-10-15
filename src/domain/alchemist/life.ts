import type { SliceState } from '../slice/types.js';
import { awardSeerMastery, type SeerContext } from '../seer/index.js';
import { stableStringify } from '../canonical.js';

export const ALCHEMIST_CASE_IDS = ['messenger-box', 'guard-frame', 'maker-account'] as const;
export type AlchemistCaseId = typeof ALCHEMIST_CASE_IDS[number];
export type AlchemistActivityCommand =
  | { type: 'OBSERVE' | 'PERFORM' | 'REPORT' | 'CLOSE' | 'WITHDRAW' | 'BUY_KIT' | 'ASSEMBLE' | 'MOVE_CREATION' | 'GUARD_CREATION' | 'STOP_CREATION' | 'RETURN_CREATION' | 'RETURN_MATERIAL'; caseId: AlchemistCaseId }
  | { type: 'PREPARE'; caseId: AlchemistCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'REFLECT' | 'RECHARGE_FRAME' };
export interface AlchemistCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED';
  observedWeek: number | null; attemptWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; closes: number; withdrawals: number;
  performed: boolean; used: boolean; returned: boolean;
}
export interface AlchemistCreation {
  id: 'AL4-BOX-1' | 'AL4-FRAME-1'; kind: 'MESSENGER_BOX' | 'GUARD_FRAME'; source: string;
  componentIds: string[]; madeBy: string; owner: 'PLAYER'; custodian: 'PLAYER';
  location: 'PLAYER' | 'BENCH_START' | 'BENCH_END' | 'GUARD_MARK' | 'YARD';
  durability: number; charge: number; active: boolean; manufacturedWeek: number;
}
export interface AlchemistMaterialKit {
  id: 'AL4-BOX-KIT-1' | 'AL4-FRAME-KIT-1'; source: string; status: 'SUPPLIER' | 'PLAYER' | 'CONSUMED';
  componentIds: string[]; purchasedWeek: number | null; price: 80 | 120;
}
export interface AlchemistLifeState {
  cases: Record<AlchemistCaseId, AlchemistCaseState>; creations: AlchemistCreation[]; materials: AlchemistMaterialKit[];
  parcel: { id: 'AL4-PARCEL-1'; owner: 'AL4-HELENA'; custodian: 'AL4-HELENA' | 'AL4-BOX-1'; location: 'OWNER' | 'BENCH_START' | 'BENCH_END'; weightGrams: 200 };
  entrustedMaterial: { id: 'AL4-BRASS-COUPON-1'; owner: 'AL4-HELENA'; custodian: 'AL4-HELENA' | 'PLAYER'; location: 'OWNER' | 'WORKBENCH' };
  workbenchId: 'AL4-WORKBENCH-1'; pieceRecords: string[]; rechargeCount: number; reflected: boolean;
}
export interface AlchemistLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: AlchemistActivityCommand }
export interface AlchemistLifeProjection {
  title: string; story: string;
  cases: { id: AlchemistCaseId; title: string; story: string; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; observations: string[] }[];
  creations: AlchemistCreation[]; materials: AlchemistMaterialKit[]; parcel: AlchemistLifeState['parcel'];
  entrustedMaterial: AlchemistLifeState['entrustedMaterial']; reflected: boolean; inside: boolean; actions: AlchemistLifeAction[];
}
const BOX_SOURCE = '原创G：贝克兰德沃德工坊出售的唯一80便士木板、黄铜轮轴与有限虚构灵性芯AL4-BOX-KIT-1，玩家亲手组装';
const FRAME_SOURCE = '原创G：贝克兰德沃德工坊出售的唯一120便士木材、钢片与有限虚构灵性芯AL4-FRAME-KIT-1，玩家亲手制造';
const KIT_COMPONENTS = [['AL4-WOOD-1', 'AL4-BRASS-AXLE-1', 'AL4-CELL-1'], ['AL4-WOOD-2', 'AL4-STEEL-1', 'AL4-CELL-2']];
const CASES = [
  { id: 'messenger-box', title: '亲手制造的小轮送件盒', story: '成年训练员海伦娜（36岁，AL4-HELENA）同意在原工作台上试送她唯一的200克测试包裹。先买真实木材、轮轴与有限灵性芯，再亲手装成原小轮盒；只走眼前标明起止点的2米路线。完成后停止赋灵，取回盒子并把原包裹还给她。场地、芯、寿命与数值为原创G。', facts: ['成品必须由本周目本人亲手制造，买来的现成物不能代替。', '能力实施3灵性、知识16，成功给原盒3次有限储能；移动真实消耗1次。普通方法亲手推动，不给能力掌握。'] },
  { id: 'guard-frame', title: '同一个小护架与安全摆锤', story: '在原工作台亲手用另一套木材、钢片与芯制造唯一小护架AL4-FRAME-1。海伦娜把原软垫摆锤AL4-PAD-1限位在一米标记前作一次安全负载。赋灵后还须明确指挥原护架承接它，随后停止并取回。这个原护架以后可随身带入真实冲突，储能与耐久仍是同一份，不生成队友。（原创G）', facts: ['能力实施3灵性、知识16，成功使原护架有3次有限储能；指挥另2灵性并耗1次储能，实际负载耐久−5。', '普通方法亲手用惰性原护架承接同一受控负载，不给能力掌握。工坊付费充能1行动、40便士及3灵性，只补同一原架储能至3，不修复耐久。'] },
  { id: 'maker-account', title: '原成品记录和受托黄铜片', story: '回到同一普通原工作台AL4-WORKBENCH-1，海伦娜把唯一受托黄铜片交你暂时比对。核对自己已完成的原盒、原架两张真实成品记录，比较有限用途、花费和取回责任，再归还原片。只作普通核账，不给惰性模型编造灵魂，不创造神圣生命。（原创G）', facts: ['必须已有AL4-BOX-1与AL4-FRAME-1的亲手制造记录，两者仍是原件。', '本案只有普通方法、知识14、0灵性；受托原黄铜片须亲手归还原主人。'] },
] as const;
export const ALCHEMIST_LIFE_STORY = '给自己制造的物品赋予一定生命属于本阶段边界；这里的有限储能、耐久、材料、距离和成本为本作原创G。观察、准备、实施、报告各1行动；采购与亲手组装属于已付观察/准备，移动、停止、取回及归还属于已付实施，均0行动。三案报告各扮演25，反思25；仅真正成功的能力实践报告抽取已有能力池单项掌握8。没有永久独立灵魂、免费队友、生命复制或高达。';
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const promoted = (s: SliceState) => s.progression.pathwayId === 'paragon' && [4,3,2].includes(s.progression.sequence??0);
const freshCase = (): AlchemistCaseState => ({ status: 'AVAILABLE', observedWeek: null, attemptWeek: null, method: null, result: 'NONE', contactOpen: false, closes: 0, withdrawals: 0, performed: false, used: false, returned: false });
export function createAlchemistLifeState(): AlchemistLifeState {
  return { cases: { 'messenger-box': freshCase(), 'guard-frame': freshCase(), 'maker-account': freshCase() }, creations: [],
    materials: [{ id: 'AL4-BOX-KIT-1', source: BOX_SOURCE, status: 'SUPPLIER', componentIds: [...KIT_COMPONENTS[0]!], purchasedWeek: null, price: 80 },
      { id: 'AL4-FRAME-KIT-1', source: FRAME_SOURCE, status: 'SUPPLIER', componentIds: [...KIT_COMPONENTS[1]!], purchasedWeek: null, price: 120 }],
    parcel: { id: 'AL4-PARCEL-1', owner: 'AL4-HELENA', custodian: 'AL4-HELENA', location: 'OWNER', weightGrams: 200 },
    entrustedMaterial: { id: 'AL4-BRASS-COUPON-1', owner: 'AL4-HELENA', custodian: 'AL4-HELENA', location: 'OWNER' },
    workbenchId: 'AL4-WORKBENCH-1', pieceRecords: [], rechargeCount: 0, reflected: false };
}
export const findAlchemistFrame = (s: SliceState) => s.alchemist.life.creations.find(x => x.id === 'AL4-FRAME-1');
const creationFor = (s: SliceState, id: AlchemistCaseId) => s.alchemist.life.creations.find(x => x.id === (id === 'messenger-box' ? 'AL4-BOX-1' : 'AL4-FRAME-1'));
export const hasAlchemistLifeLock = (s: SliceState): boolean => Object.values(s.alchemist.life.cases).some(r => r.contactOpen);
export const alchemistInside = hasAlchemistLifeLock;
export function validateAlchemistActivityCommand(v: unknown): v is AlchemistActivityCommand {
  if (!record(v)) return false;
  if (['REFLECT', 'RECHARGE_FRAME'].includes(String(v.type))) return shape(v, ['type']);
  if (!ALCHEMIST_CASE_IDS.includes(v.caseId as AlchemistCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  return ['OBSERVE', 'PERFORM', 'REPORT', 'CLOSE', 'WITHDRAW', 'BUY_KIT', 'ASSEMBLE', 'MOVE_CREATION', 'GUARD_CREATION', 'STOP_CREATION', 'RETURN_CREATION', 'RETURN_MATERIAL'].includes(String(v.type)) && shape(v, ['type', 'caseId']);
}
export const isAlchemistActivityCommand = validateAlchemistActivityCommand;
export const isAlchemistActivity = validateAlchemistActivityCommand;
function readyToClose(s: SliceState, id: AlchemistCaseId): string | null {
  const l = s.alchemist.life, r = l.cases[id], x = id === 'maker-account' ? null : creationFor(s, id);
  if (!r.contactOpen) return '没有这一项尚未结束的原现场。';
  if (x?.active) return '先明确停止原造物的赋灵。';
  if (!r.returned || x && x.location !== 'PLAYER' || id === 'messenger-box' && l.parcel.location !== 'OWNER' || id === 'maker-account' && l.entrustedMaterial.location !== 'OWNER') return '先实际取回原造物并归还同一受托原物；结束按钮不能搬动物品。';
  return null;
}
export function blockAlchemistLife(s: SliceState, c: AlchemistActivityCommand): string | null {
  if (!validateAlchemistActivityCommand(c)) return '炼金术士实践命令无效。';
  if (s.status !== 'ACTIVE' || !promoted(s) || s.progression.sequence!==4) return '须仍活着并已成为通识者途径炼金术士。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际回到贝克兰德原工坊。';
  if (['READY', 'FIGHTING'].includes(s.alchemist.encounter.status)) return '先沿原出口收束当前院内遭遇。';
  const l = s.alchemist.life, r = 'caseId' in c ? l.cases[c.caseId] : null;
  const x = 'caseId' in c && c.caseId !== 'maker-account' ? creationFor(s, c.caseId) : null;
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW' && r?.contactOpen) return readyToClose(s, c.caseId);
  if (c.type === 'STOP_CREATION') return r?.contactOpen && x?.active ? null : '没有本次正在赋灵的原造物。';
  if (c.type === 'RETURN_CREATION') return !r?.contactOpen || !x || x.location === 'PLAYER' ? '没有本次仍在原标记处的造物需要取回。' : x.active ? '先明确停止原造物，再亲手取回。' : null;
  if (c.type === 'RETURN_MATERIAL') return c.caseId === 'maker-account' && r?.contactOpen && l.entrustedMaterial.custodian === 'PLAYER' ? null : '没有本次仍由本人暂持的受托原黄铜片。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚未实施的准备。';
  if (s.health <= 0 || s.mind <= 0) return '先休养身体与精神，已有停止、取回和退出仍可0行动完成。';
  if (c.type === 'MOVE_CREATION' || c.type === 'GUARD_CREATION') {
    if (!r?.contactOpen || r.status !== 'ACTIVE' || !r.performed || r.used || r.returned || !x) return '须已成功实施本次原造物实践，且尚未取回或完成本次用途。';
    if (c.type === 'MOVE_CREATION' && (c.caseId !== 'messenger-box' || x.location !== 'BENCH_START')) return '仅原送件盒可沿原工作台起点移动2米。';
    if (c.type === 'GUARD_CREATION' && (c.caseId !== 'guard-frame' || x.location !== 'GUARD_MARK')) return '仅原小护架可在原一米标记承接受控摆锤。';
    if (r.method === 'ABILITY' && (!x.active || x.charge < 1)) return '原造物须仍在有限赋灵中且至少剩1次储能；仍可停止、取回和退出。';
    return c.type === 'GUARD_CREATION' && r.method === 'ABILITY' && s.spirituality < 2 ? '实际指挥原护架需要2灵性；仍可停止、取回和退出。' : null;
  }
  if (hasAlchemistLifeLock(s)) return '先停止当前原造物、取回还物并实际结束现场。';
  if (Object.entries(l.cases).some(([id, v]) => v.status === 'PREPARED' && (!('caseId' in c) || c.caseId !== id))) return '先实施或取消另一项已经支付的准备。';
  if (c.type === 'RECHARGE_FRAME') {
    const f = findAlchemistFrame(s);
    return l.cases['guard-frame'].status !== 'RESOLVED' || !f || f.location !== 'PLAYER' || f.active || f.durability <= 0 ? '须已报告原护架实践并随身持有停止且未损坏的同一原架。' : f.charge >= 3 ? '原护架储能已满3次，不重复付费。' : s.actionsRemaining < 1 || s.spirituality < 3 || s.cash < 40 ? '工坊充能需要1行动、40便士和3灵性，不修复耐久。' : null;
  }
  if (c.type === 'REFLECT') return l.reflected ? '已经完成反思。' : ALCHEMIST_CASE_IDS.some(id => l.cases[id].status !== 'RESOLVED') ? '先完成三个真实报告。' : s.actionsRemaining < 1 ? '需要1行动。' : null;
  if (!r || !('caseId' in c)) return '未知原实践。';
  const index = ALCHEMIST_CASE_IDS.indexOf(c.caseId), kit = l.materials[index];
  if (r.status === 'RESOLVED') return '本项已报告，不能再次领取成长。';
  if (index > 0 && l.cases[ALCHEMIST_CASE_IDS[index - 1]!].status !== 'RESOLVED') return '先完成前一项原成品的实践报告。';
  if (c.type === 'BUY_KIT') return !kit || r.status !== 'OBSERVED' ? '先观察对应原工坊材料；第三案没有新套件。' : kit.status !== 'SUPPLIER' ? '同一套原材料已经购入，不生成另一套。' : s.cash < kit.price ? `需要${kit.price}便士购买实物套件。` : null;
  if (c.type === 'ASSEMBLE') return !kit || r.status !== 'PREPARED' || kit.status !== 'PLAYER' || x ? '须已付准备并实际持有未用的对应材料，只能亲手制造一次。' : null;
  if (s.actionsRemaining < 1) return '本次需要1行动。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '原现场与许可已经观察。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察对应原现场。' : r.attemptWeek === s.week ? '本周已尝试，下一真实周才能再准备。' : c.caseId === 'maker-account' && c.method === 'ABILITY' ? '核账只有普通方法，不能把惰性模型伪称新灵魂。' : kit && kit.status === 'SUPPLIER' ? '先实际购买这一套原材料。' : null;
  if (c.type === 'REPORT') return r.status === 'EXAMINED' && r.result !== 'NONE' && r.returned ? null : '先取得真实用途结果、停止取回并实际结束现场。';
  if (c.type === 'PERFORM') return r.status !== 'PREPARED' ? '先准备本次实践。' : c.caseId !== 'maker-account' && (!x || x.madeBy !== s.runId || x.location !== 'PLAYER' || x.durability <= 0 || x.active) ? '须先亲手制造，并持有未损坏、未赋灵的同一原造物。' : c.caseId === 'maker-account' && l.pieceRecords.length !== 2 ? '须先有两个本人真实制造的原成品记录。' : r.method === 'ABILITY' && s.spirituality < 3 ? '实际赋灵需要3灵性，可以0行动取消准备。' : null;
  return '本次原实践条件尚未具备。';
}
export const blockAlchemistActivity = blockAlchemistLife;
export function applyAlchemistActivity(s: SliceState, c: AlchemistActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void = (source, amount) => awardSeerMastery(s, source, amount, ctx)): void {
  const reason = blockAlchemistLife(s, c); if (reason) throw new Error(reason);
  const l = s.alchemist.life, r = 'caseId' in c ? l.cases[c.caseId] : null;
  const x = 'caseId' in c && c.caseId !== 'maker-account' ? creationFor(s, c.caseId) : null;
  if (c.type === 'STOP_CREATION') { x!.active = false; ctx.note('停止同一原造物的赋灵', `原件${x!.id}明确停止，储能余${x!.charge}/3、耐久${x!.durability}/100；不退灵性，不取回、不重置寿命。`); return; }
  if (c.type === 'RETURN_CREATION') {
    x!.location = 'PLAYER'; r!.returned = true;
    if (c.caseId === 'messenger-box') { l.parcel.custodian = 'AL4-HELENA'; l.parcel.location = 'OWNER'; }
    ctx.note('亲手取回原造物并归还原包裹', `本人沿眼前原路线走到原件旁，取回${x!.id}随身携带；${c.caseId === 'messenger-box' ? '将同一200克测试包裹亲手还给仍在场的海伦娜。' : '原软垫摆锤仍在工坊原限位架。'}0行动的收束时间已含在实施中，没有瞬移、充能或修复。`); return;
  }
  if (c.type === 'RETURN_MATERIAL') { l.entrustedMaterial.custodian = 'AL4-HELENA'; l.entrustedMaterial.location = 'OWNER'; r!.returned = true; ctx.note('归还同一受托黄铜片', '本人在原工作台把AL4-BRASS-COUPON-1交回原主人海伦娜；原片没有消耗、复制或变成自己的材料。'); return; }
  if (c.type === 'CLOSE' || c.type === 'WITHDRAW') {
    if (r!.contactOpen) { r!.contactOpen = false; r!.closes++; r!.status = r!.result === 'NONE' ? 'OBSERVED' : 'EXAMINED'; }
    else { r!.status = 'OBSERVED'; r!.method = null; }
    if (c.type === 'WITHDRAW') r!.withdrawals++;
    ctx.note('实际结束原工坊现场', '本人已停止、实际取回并归还原物后退出；原件、花费、储能和耐久保留。失败须下一真实周再准备，没有原地重刷。'); return;
  }
  if (c.type === 'BUY_KIT') {
    const kit = l.materials[c.caseId === 'messenger-box' ? 0 : 1]!; s.cash -= kit.price; kit.status = 'PLAYER'; kit.purchasedWeek = s.week;
    ctx.note('购入真实原材料', `${kit.price}便士已支付，${kit.componentIds.join('、')}从原工坊交到本人手中；仍是材料，没有买到现成有生命的造物。`); return;
  }
  if (c.type === 'ASSEMBLE') {
    const box = c.caseId === 'messenger-box', kit = l.materials[box ? 0 : 1]!;
    const made: AlchemistCreation = { id: box ? 'AL4-BOX-1' : 'AL4-FRAME-1', kind: box ? 'MESSENGER_BOX' : 'GUARD_FRAME', source: kit.source,
      componentIds: [...kit.componentIds], madeBy: s.runId, owner: 'PLAYER', custodian: 'PLAYER', location: 'PLAYER', durability: 100, charge: 0, active: false, manufacturedWeek: s.week };
    kit.status = 'CONSUMED'; l.creations.push(made); l.pieceRecords.push(made.id);
    ctx.note('本人亲手完成原成品', `在原工作台亲手切合、装配${kit.componentIds.join('、')}成${made.id}。原材料已实际用入成品，不能再用；本人制造者记录为当前周目，储能0、耐久100、未赋灵。组装时间来自已经支付的准备。`); return;
  }
  if (c.type === 'MOVE_CREATION' || c.type === 'GUARD_CREATION') {
    if (r!.method === 'ABILITY') { x!.charge--; if (c.type === 'GUARD_CREATION') s.spirituality -= 2; }
    if (c.type === 'MOVE_CREATION') { x!.location = 'BENCH_END'; l.parcel.location = 'BENCH_END'; }
    else x!.durability = Math.max(0, x!.durability - 5);
    r!.used = true; r!.result = r!.method!;
    if (x!.charge === 0 || x!.durability === 0) x!.active = false;
    ctx.note(c.type === 'MOVE_CREATION' ? '同一原盒沿标记实际移动2米' : '同一原护架实际承接受控负载', `${r!.method === 'ABILITY' ? c.type === 'MOVE_CREATION' ? '原盒消耗1次储能，携带唯一200克测试包裹移动到原终点。' : '本人支付2灵性指挥原护架，在原1米标记消耗1次储能承接原软垫摆锤，耐久实际−5。' : c.type === 'MOVE_CREATION' ? '本人亲手推动惰性原盒与同一包裹到原终点，没有非凡移动。' : '本人亲手用惰性原护架承接受控摆锤，原架耐久实际−5，没有非凡指挥。'}原件储能${x!.charge}/3、耐久${x!.durability}/100，仍须停止并亲手取回。`); return;
  }
  s.actionsRemaining--;
  if (c.type === 'RECHARGE_FRAME') { const f = findAlchemistFrame(s)!; s.cash -= 40; s.spirituality -= 3; f.charge = 3; l.rechargeCount++; ctx.note('在工坊为同一原架补充有限储能', `1行动、40便士工坊耗材和本人3灵性已支付；AL4-FRAME-1储能恢复3次，仍未赋灵，耐久${f.durability}不变。战斗不免费补充，也没有制造第二个护架。`); return; }
  if (c.type === 'REFLECT') { l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('alchemist-reflection'); ctx.note('制造者对原物的责任', '三项已完成实践：亲手制造、有限赋灵、实际用途与归还。扮演+25，有限生命不是永久独立灵魂；原材料与制造结果都有责任。'); return; }
  if (!('caseId' in c)) throw new Error('本次实践缺少原事项。');
  const p = CASES.find(p => p.id === c.caseId)!;
  if (c.type === 'OBSERVE') { r!.status = 'OBSERVED'; r!.observedWeek = s.week; ctx.note(p.title, p.story + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') { r!.status = 'PREPARED'; r!.method = c.method; ctx.note(p.title, `${c.method === 'ABILITY' ? '准备有限赋灵，实施另付3灵性、知识16；指挥护架还须另2灵性。' : '准备普通知识与亲手操作，实施知识14、0灵性。'}尚无原成品时须先亲手组装；准备本身不给物品生命。`); return; }
  if (c.type === 'REPORT') {
    r!.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25);
    if (r!.result === 'ABILITY') award(`alchemist-case:${c.caseId}`, 8);
    ctx.note(p.title, `同一原物已停止、取回或归还并结束现场；报告扮演+25。${r!.result === 'ABILITY' ? '真正成功的能力实践获得已有能力池单项掌握8。' : '普通结果不增加能力掌握。'}原成品和实际成本保留。`); return;
  }
  r!.attemptWeek = s.week; r!.contactOpen = true; r!.status = 'ACTIVE'; r!.performed = false; r!.used = false; r!.returned = false; r!.result = 'NONE';
  if (x) { x.location = c.caseId === 'messenger-box' ? 'BENCH_START' : 'GUARD_MARK'; if (c.caseId === 'messenger-box') { l.parcel.custodian = 'AL4-BOX-1'; l.parcel.location = 'BENCH_START'; } }
  else { l.entrustedMaterial.custodian = 'PLAYER'; l.entrustedMaterial.location = 'WORKBENCH'; }
  if (r!.method === 'ABILITY') s.spirituality -= 3;
  const result = ctx.check('knowledge', r!.method === 'ABILITY' ? 16 : 14);
  r!.performed = result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS';
  if (r!.performed) {
    if (r!.method === 'ABILITY' && x) { x.charge = 3; x.active = true; }
    if (c.caseId === 'maker-account') { r!.used = true; r!.result = 'ORDINARY'; }
    ctx.note(p.title, `${r!.method === 'ABILITY' ? `本人3灵性已付，对自己制造的${x!.id}赋予本次有限生命，原件储能3次。` : '普通知识检验成功，没有非凡赋灵或灵魂制造。'}${c.caseId === 'maker-account' ? '同一原工作台两张原成品记录已核对，现在须归还受托原片。' : '还须选择实际移动或承接负载，再停止、取回与还物。'}`);
  } else ctx.note(p.title, '本次知识检验失败，行动与已付灵性照耗，没有伪造成功或补充储能。原物确实已放在原标记或工作台；仍可0行动停止、取回、还物和退出，下一真实周重试。');
}
export function alchemistLifeActions(s: SliceState): AlchemistLifeAction[] {
  if (!promoted(s)||s.progression.sequence!==4) return [];
  const out: AlchemistLifeAction[] = [], l = s.alchemist.life;
  const add = (label: string, cost: string, command: AlchemistActivityCommand) => { const reason = blockAlchemistLife(s, command); out.push({ id: `alchemist-${command.type}${'caseId' in command ? `-${command.caseId}` : ''}${'method' in command ? `-${command.method}` : ''}`, label, cost, enabled: reason === null, reason, command }); };
  for (const p of CASES) {
    const r = l.cases[p.id], x = p.id === 'maker-account' ? null : creationFor(s, p.id);
    if (r.contactOpen) {
      if (r.performed && !r.used && !r.returned && x) add(p.id === 'messenger-box' ? '让原盒实际沿标记移动2米' : '让原护架承接受控摆锤', r.method === 'ABILITY' ? p.id === 'messenger-box' ? '0行动 · 原储能1次' : '0行动 · 2灵性 · 原储能1次 · 耐久−5' : '0行动 · 普通手工 · 护架负载耐久−5', { type: p.id === 'messenger-box' ? 'MOVE_CREATION' : 'GUARD_CREATION', caseId: p.id });
      if (x?.active) add('明确停止同一原造物', '0行动 · 不退款', { type: 'STOP_CREATION', caseId: p.id });
      if (x && x.location !== 'PLAYER') add(p.id === 'messenger-box' ? '亲手取回原盒并归还原包裹' : '亲手取回同一原护架', '0行动 · 沿原路线', { type: 'RETURN_CREATION', caseId: p.id });
      if (p.id === 'maker-account' && l.entrustedMaterial.custodian === 'PLAYER') add('亲手归还同一受托黄铜片', '0行动', { type: 'RETURN_MATERIAL', caseId: p.id });
      add('实际结束本次原工坊现场', '0行动 · 先停止取回还物', { type: 'CLOSE', caseId: p.id });
      add('退出本次尝试并保留成本', '0行动 · 先停止取回还物', { type: 'WITHDRAW', caseId: p.id });
    } else if (r.status === 'AVAILABLE') add(`观察：${p.title}`, '1行动', { type: 'OBSERVE', caseId: p.id });
    else if (r.status === 'OBSERVED') {
      const kit = l.materials[p.id === 'messenger-box' ? 0 : 1];
      if (p.id !== 'maker-account' && kit?.status === 'SUPPLIER') add('购买这套实际原材料', `0行动 · ${kit.price}便士 · 已付观察内采购`, { type: 'BUY_KIT', caseId: p.id });
      if (p.id !== 'maker-account') add('准备有限赋灵实践', '1行动 · 实施另3灵性', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add('准备普通手工或核账', '1行动 · 实施0灵性', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    } else if (r.status === 'PREPARED') {
      if (p.id !== 'maker-account' && !x) add('用持有的原材料亲手制造', '0行动 · 已付准备内组装 · 原料消耗', { type: 'ASSEMBLE', caseId: p.id });
      add('实际实施本次有限实践', r.method === 'ABILITY' ? '1行动 · 3灵性 · 知识16' : '1行动 · 知识14', { type: 'PERFORM', caseId: p.id });
      add('取消尚未实施的准备', '0行动 · 成品与花费保留', { type: 'WITHDRAW', caseId: p.id });
    } else if (r.status === 'EXAMINED') add('报告原成品有限用途与归还', '1行动 · 扮演25', { type: 'REPORT', caseId: p.id });
  }
  if (!l.reflected) add('回看三个原物实践', '1行动 · 扮演25', { type: 'REFLECT' });
  if (findAlchemistFrame(s)) add('在工坊为同一原护架充能', '1行动 · 40便士 · 3灵性 · 不修耐久', { type: 'RECHARGE_FRAME' });
  return out;
}
export function projectAlchemistLife(s: SliceState): AlchemistLifeProjection {
  const l = s.alchemist.life;
  return { title: '制造者与有限生命', story: ALCHEMIST_LIFE_STORY,
    cases: CASES.map(p => { const r = l.cases[p.id]; return { id: p.id, title: p.title, story: p.story, status: r.status, method: r.method, contactOpen: r.contactOpen,
      result: r.result === 'NONE' ? r.attemptWeek === null ? null : '已实际尝试，尚无完成用途的结果；原成本保留。' : `${r.result === 'ABILITY' ? '有限赋灵用途' : '普通用途'}已实际完成；${r.returned ? '原件已取回或归还' : '仍须停止取回归还'}。`, observations: r.status === 'AVAILABLE' ? [] : [...p.facts] }; }),
    creations: structuredClone(l.creations), materials: structuredClone(l.materials), parcel: { ...l.parcel }, entrustedMaterial: { ...l.entrustedMaterial }, reflected: l.reflected, inside: hasAlchemistLifeLock(s), actions: alchemistLifeActions(s) };
}
export function validateAlchemistLife(s: SliceState): boolean {
  const l = s.alchemist?.life; if (!record(l) || !shape(l, ['cases', 'creations', 'materials', 'parcel', 'entrustedMaterial', 'workbenchId', 'pieceRecords', 'rechargeCount', 'reflected']) || !record(l.cases) || !shape(l.cases, ALCHEMIST_CASE_IDS) || !Array.isArray(l.creations) || !Array.isArray(l.materials) || !Array.isArray(l.pieceRecords) || typeof l.reflected !== 'boolean' || !integer(l.rechargeCount) || !record(l.parcel) || !record(l.entrustedMaterial) || l.workbenchId !== 'AL4-WORKBENCH-1') return false;
  if (!promoted(s)) return stableStringify(l) === stableStringify(createAlchemistLifeState());
  const knowledgeCase = s.progression.pathwayId==='paragon' && s.progression.sequence===2 && !!s.knowledgeMentor?.life && Object.values(s.knowledgeMentor.life.cases).some(c=>c.status==='ACTIVE');
  const knowledgeYard = s.progression.pathwayId==='paragon' && s.progression.sequence===2 && !!s.knowledgeMentor?.encounter && ['READY','FIGHTING','LOST'].includes(s.knowledgeMentor.encounter.status);
  const promotion = s.alchemist.promotionWeek; if (promotion === null) return false;
  if (l.materials.length !== 2 || l.creations.length > 2 || new Set(l.creations.map(x => x.id)).size !== l.creations.length || new Set(l.pieceRecords).size !== l.pieceRecords.length || l.pieceRecords.length !== l.creations.length) return false;
  const fresh = createAlchemistLifeState();
  for (let i = 0; i < 2; i++) {
    const kit = l.materials[i]!, origin = fresh.materials[i]!;
    if (!record(kit) || !shape(kit, Object.keys(origin)) || kit.id !== origin.id || kit.source !== origin.source || kit.price !== origin.price || stableStringify(kit.componentIds) !== stableStringify(origin.componentIds) || !['SUPPLIER', 'PLAYER', 'CONSUMED'].includes(kit.status)) return false;
    if (kit.status === 'SUPPLIER' ? kit.purchasedWeek !== null : !integer(kit.purchasedWeek, promotion, s.week)) return false;
    const x = l.creations.find(x => x.id === (i === 0 ? 'AL4-BOX-1' : 'AL4-FRAME-1'));
    if ((kit.status === 'CONSUMED') !== !!x) return false;
    if (x && (!record(x) || !shape(x, ['id', 'kind', 'source', 'componentIds', 'madeBy', 'owner', 'custodian', 'location', 'durability', 'charge', 'active', 'manufacturedWeek']) || x.kind !== (i === 0 ? 'MESSENGER_BOX' : 'GUARD_FRAME') || x.source !== kit.source || stableStringify(x.componentIds) !== stableStringify(kit.componentIds) || x.madeBy !== s.runId || x.owner !== 'PLAYER' || x.custodian !== 'PLAYER' || !integer(x.manufacturedWeek, kit.purchasedWeek!, s.week) || !integer(x.durability, 0, 100) || !integer(x.charge, 0, 3) || typeof x.active !== 'boolean' || !l.pieceRecords.includes(x.id) || !['PLAYER', i === 0 ? 'BENCH_START' : 'GUARD_MARK', i === 0 ? 'BENCH_END' : 'YARD',...(s.progression.sequence===3||knowledgeYard?['YARD']:[])].includes(x.location) || x.active && (x.charge === 0 || x.durability === 0 || x.location === 'PLAYER'))) return false;
  }
  if (l.creations.some(x => !['AL4-BOX-1', 'AL4-FRAME-1'].includes(x.id))) return false;
  const p = l.parcel, m = l.entrustedMaterial;
  if (!shape(p, Object.keys(fresh.parcel)) || p.id !== fresh.parcel.id || p.owner !== 'AL4-HELENA' || p.weightGrams !== 200 || !['AL4-HELENA', 'AL4-BOX-1'].includes(p.custodian) || !['OWNER', 'BENCH_START', 'BENCH_END'].includes(p.location) || (p.location === 'OWNER') !== (p.custodian === 'AL4-HELENA') || !shape(m, Object.keys(fresh.entrustedMaterial)) || m.id !== fresh.entrustedMaterial.id || m.owner !== 'AL4-HELENA' || !['AL4-HELENA', 'PLAYER'].includes(m.custodian) || !['OWNER', 'WORKBENCH'].includes(m.location) || (m.location === 'OWNER') !== (m.custodian === 'AL4-HELENA')) return false;
  let open = 0;
  for (const id of ALCHEMIST_CASE_IDS) {
    const r = l.cases[id]; if (!record(r) || !shape(r, Object.keys(fresh.cases[id])) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result) || (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method)) || !integer(r.closes) || !integer(r.withdrawals) || ['contactOpen', 'performed', 'used', 'returned'].some(k => typeof (r as unknown as Record<string, unknown>)[k] !== 'boolean') || [r.observedWeek, r.attemptWeek].some(n => n !== null && !integer(n, promotion, s.week))) return false;
    if (r.contactOpen) { open++; if (r.status !== 'ACTIVE' || r.attemptWeek === null) return false; }
    else if (r.status === 'ACTIVE') return false;
    if (r.status === 'AVAILABLE' && stableStringify(r) !== stableStringify(fresh.cases[id])) return false;
    if (r.status !== 'AVAILABLE' && r.observedWeek === null || r.attemptWeek !== null && r.attemptWeek < r.observedWeek!) return false;
    if (['PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) && r.method === null) return false;
    if (r.result !== 'NONE' && (!r.performed || !r.used || r.attemptWeek === null || r.result !== r.method)) return false;
    if (['EXAMINED', 'RESOLVED'].includes(r.status) && (r.result === 'NONE' || !r.returned || r.contactOpen || r.closes < 1)) return false;
    if (id === 'maker-account' && (r.method === 'ABILITY' || r.result === 'ABILITY')) return false;
    const i = ALCHEMIST_CASE_IDS.indexOf(id); if (r.status !== 'AVAILABLE' && i > 0 && l.cases[ALCHEMIST_CASE_IDS[i - 1]!].status !== 'RESOLVED') return false;
    const x = id === 'maker-account' ? null : creationFor(s, id);
    if (r.contactOpen && id !== 'maker-account' && (!x || x.location === 'YARD')) return false;
    if (x && ['BENCH_START', 'BENCH_END', 'GUARD_MARK'].includes(x.location) && !r.contactOpen && !(s.progression.sequence===3&&s.arcaneScholar?.life&&Object.values(s.arcaneScholar.life.cases).some(c=>c.contactOpen)) && !knowledgeCase) return false;
    if (r.returned && r.contactOpen && x?.location !== undefined && x.location !== 'PLAYER') return false;
    if (id === 'messenger-box' && (p.location !== 'OWNER' && (!r.contactOpen || !x || x.location !== p.location) || r.contactOpen && !r.returned && p.location === 'OWNER')) return false;
    if (id === 'maker-account' && (m.location !== 'OWNER' && !r.contactOpen || r.contactOpen && !r.returned && m.location === 'OWNER')) return false;
    const rewards = s.seer.completedSources.filter(source => source === `alchemist-case:${id}`).length;
    if (rewards !== (r.status === 'RESOLVED' && r.result === 'ABILITY' ? 1 : 0)) return false;
  }
  const frame = findAlchemistFrame(s);
  if (frame?.location === 'YARD' && !['FIGHTING', 'LOST'].includes(s.alchemist.encounter.status) && !(s.progression.sequence===3&&['READY','FIGHTING','LOST'].includes(s.arcaneScholar.encounter.status)) && !knowledgeYard) return false;
  if (open > 1 || l.reflected && ALCHEMIST_CASE_IDS.some(id => l.cases[id].status !== 'RESOLVED') || s.seer.completedSources.filter(id => id === 'alchemist-reflection').length !== (l.reflected ? 1 : 0)) return false;
  return true;
}
