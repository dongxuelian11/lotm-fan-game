import type { PublicCheckResult } from '../../shared/contracts.js';
import type { PerfecterBudget } from './source.js';
/** One already recorded archive fault. Only its measured nonliving signal can
 * enter the temporary page; its known model aids one existing municipal machine. */
export interface PerfecterEpilogueOrigin {
  id: string; location: string;
  operators: { id: string; name: string; age: number }[];
  patients: { id: string; name: string; age: number; injury: string }[];
  apparatus: { id: string; title: string; durability: number; modelId: string; modelVerified: boolean; supplierPartsStock: number };
  objects: { id: string; title: string }[];
  flow: { id: string; title: string; sourceObjectId: string; totalUnits: number; status: 'ISOLATED_PENDING' };
}
export type PerfecterEpilogueCommand = { type: 'OBSERVE' | 'CONTAIN_FLOW' | 'RECONSTRUCT_MODEL' | 'ISOLATE' | 'REPAIR_DEVICE' | 'EVACUATE' | 'WITHDRAW' | 'REPORT' };
export interface PerfecterEpilogueState {
  id: string; originId: string; location: string; startedWeek: number; startedRevision: number;
  status: 'ACTIVE' | 'RESOLVED' | 'WITHDRAWN'; observed: boolean; turns: number;
  pageAttempted: boolean; pageActive: boolean; pageExpiresTurn: number | null;
  modelAttempted: boolean; modelApplied: boolean; isolated: boolean; ordinaryRepairWeek: number | null;
  page: { id: string; capacity: 6; containedFlowId: string | null; containedUnits: number; status: 'EMPTY' | 'CONTAINING' | 'RELEASED' };
  flow: { id: string; title: string; sourceObjectId: string; totalUnits: 6; looseUnits: number; quietedUnits: number };
  apparatus: { id: string; title: string; durability: number; priorDurability: number; modelId: string; modelVerified: boolean; supplierPartsStock: number; sparePartsPurchased: number; sparePartsInstalled: number; sparePartsDamaged: number };
  operators: { id: string; name: string; age: number }[];
  patients: { id: string; name: string; injury: string; additionalInjuries: string[]; status: 'SHELTERED' | 'EVACUATED'; location: string }[];
  objectIds: string[]; routeDamage: number; rescueInjuries: string[]; reported: boolean;
  journal: { eventId: string; week: number; command: PerfecterEpilogueCommand; check: PublicCheckResult | null; summary: string }[];
}
const commands = ['OBSERVE', 'CONTAIN_FLOW', 'RECONSTRUCT_MODEL', 'ISOLATE', 'REPAIR_DEVICE', 'EVACUATE', 'WITHDRAW', 'REPORT'] as const;
const skillIds = { CONTAIN_FLOW: 'paragon.s0.civilization-page', RECONSTRUCT_MODEL: 'paragon.s0.finite-reconstruction' } as const;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const keys = (v: Record<string, unknown>, names: string[]) => Object.keys(v).length === names.length && names.every(k => Object.hasOwn(v, k));
const integer = (v: unknown, min = 0): v is number => Number.isSafeInteger(v) && (v as number) >= min;
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 500;
export function validatePerfecterEpilogueCommand(v: unknown): v is PerfecterEpilogueCommand {
  return record(v) && keys(v, ['type']) && commands.includes(v.type as PerfecterEpilogueCommand['type']);
}
export function createPerfecterEpilogue(origin: PerfecterEpilogueOrigin, input: { eventId: string; week: number; revision: number }): PerfecterEpilogueState {
  if (!text(input.eventId) || !integer(input.week, 1) || !integer(input.revision) || origin.operators.length !== 3 || origin.patients.length !== 2 || origin.objects.length !== 4 ||
    [...origin.operators, ...origin.patients].some(p => p.age < 19) || !origin.apparatus.modelVerified || origin.flow.totalUnits !== 6 || origin.flow.status !== 'ISOLATED_PENDING' || !origin.objects.some(o => o.id === origin.apparatus.id) || !origin.objects.some(o => o.id === origin.flow.sourceObjectId)) throw Error('档案馆的人、设备与已测得的模型尚未核清。');
  return { id: `${input.eventId}:archive-overflow`, originId: origin.id, location: origin.location,
    startedWeek: input.week, startedRevision: input.revision, status: 'ACTIVE', observed: false, turns: 0,
    pageAttempted: false, pageActive: false, pageExpiresTurn: null, modelAttempted: false, modelApplied: false, isolated: false, ordinaryRepairWeek: null,
    page: { id: `${input.eventId}:civilization-page`, capacity: 6, containedFlowId: null, containedUnits: 0, status: 'EMPTY' },
    flow: { id: origin.flow.id, title: origin.flow.title, sourceObjectId: origin.flow.sourceObjectId, totalUnits: 6, looseUnits: 6, quietedUnits: 0 },
    apparatus: { id: origin.apparatus.id, title: origin.apparatus.title, durability: Math.max(0, origin.apparatus.durability - 12), priorDurability: origin.apparatus.durability,
      modelId: origin.apparatus.modelId, modelVerified: origin.apparatus.modelVerified, supplierPartsStock: origin.apparatus.supplierPartsStock, sparePartsPurchased: 0, sparePartsInstalled: 0, sparePartsDamaged: 0 },
    operators: origin.operators.map(o => ({ id: o.id, name: o.name, age: o.age })),
    patients: origin.patients.map(p => ({ id: p.id, name: p.name, injury: p.injury, additionalInjuries: [], status: 'SHELTERED', location: `${origin.location}:sheltered-reading-room` })),
    objectIds: origin.objects.map(o => o.id), routeDamage: 12, rescueInjuries: [], reported: false, journal: [] };
}
/** Validate the bounded mutable scene; the owner additionally replays its exact
 * origin and authenticated central checks. Projection below is a fresh whitelist. */
export function validatePerfecterEpilogueState(v: unknown): v is PerfecterEpilogueState {
  try {
    if (!record(v) || !keys(v, ['id', 'originId', 'location', 'startedWeek', 'startedRevision', 'status', 'observed', 'turns', 'pageAttempted', 'pageActive', 'pageExpiresTurn', 'modelAttempted', 'modelApplied', 'isolated', 'ordinaryRepairWeek', 'page', 'flow', 'apparatus', 'operators', 'patients', 'objectIds', 'routeDamage', 'rescueInjuries', 'reported', 'journal'])) return false;
    const s = v as unknown as PerfecterEpilogueState;
    if (![s.id, s.originId, s.location].every(text) || !integer(s.startedWeek, 1) || !integer(s.startedRevision) || !integer(s.turns) || !['ACTIVE', 'RESOLVED', 'WITHDRAWN'].includes(s.status) || !integer(s.routeDamage) || s.routeDamage > 100) return false;
    if (![s.observed, s.pageAttempted, s.pageActive, s.modelAttempted, s.modelApplied, s.isolated, s.reported].every(x => typeof x === 'boolean')) return false;
    if (!record(s.page) || !keys(s.page, ['id', 'capacity', 'containedFlowId', 'containedUnits', 'status']) || !text(s.page.id) || s.page.capacity !== 6 || !integer(s.page.containedUnits) || s.page.containedUnits > 6 || !['EMPTY', 'CONTAINING', 'RELEASED'].includes(s.page.status)) return false;
    if (!record(s.flow) || !keys(s.flow, ['id', 'title', 'sourceObjectId', 'totalUnits', 'looseUnits', 'quietedUnits']) || ![s.flow.id, s.flow.title, s.flow.sourceObjectId].every(text) || s.flow.totalUnits !== 6 || !integer(s.flow.looseUnits) || !integer(s.flow.quietedUnits) || s.flow.looseUnits + s.flow.quietedUnits + s.page.containedUnits !== 6) return false;
    if ((s.page.containedFlowId !== null && s.page.containedFlowId !== s.flow.id) || (s.pageActive !== (s.page.containedUnits > 0)) || (s.page.status === 'CONTAINING') !== s.pageActive || (s.pageActive && (!s.pageAttempted || s.page.containedFlowId !== s.flow.id || s.status !== 'ACTIVE'))) return false;
    if ((s.pageExpiresTurn !== null && !integer(s.pageExpiresTurn, 1)) || (s.pageActive && (s.pageExpiresTurn === null || s.turns >= s.pageExpiresTurn))) return false;
    if (!record(s.apparatus) || !keys(s.apparatus, ['id', 'title', 'durability', 'priorDurability', 'modelId', 'modelVerified', 'supplierPartsStock', 'sparePartsPurchased', 'sparePartsInstalled', 'sparePartsDamaged']) || ![s.apparatus.id, s.apparatus.title, s.apparatus.modelId].every(text) || s.apparatus.modelVerified !== true || ![s.apparatus.durability, s.apparatus.priorDurability, s.apparatus.supplierPartsStock, s.apparatus.sparePartsPurchased, s.apparatus.sparePartsInstalled, s.apparatus.sparePartsDamaged].every(x => integer(x)) || s.apparatus.durability > s.apparatus.priorDurability || s.apparatus.priorDurability > 100 || s.apparatus.supplierPartsStock + s.apparatus.sparePartsPurchased !== 3 || s.apparatus.sparePartsPurchased !== Number(s.modelAttempted) + (s.ordinaryRepairWeek === null ? 0 : 2) || s.apparatus.sparePartsInstalled + s.apparatus.sparePartsDamaged !== s.apparatus.sparePartsPurchased || s.apparatus.sparePartsInstalled !== Number(s.modelApplied) + (s.ordinaryRepairWeek === null ? 0 : 2) || (s.modelApplied && !s.modelAttempted)) return false;
    if (s.ordinaryRepairWeek !== null && (!integer(s.ordinaryRepairWeek, s.startedWeek) || !s.isolated || s.apparatus.durability !== s.apparatus.priorDurability)) return false;
    if (!Array.isArray(s.operators) || s.operators.length !== 3 || s.operators.some(o => !record(o) || !keys(o, ['id', 'name', 'age']) || !text(o.id) || !text(o.name) || !integer(o.age, 19))) return false;
    if (!Array.isArray(s.patients) || s.patients.length !== 2 || new Set(s.patients.map(p => p.id)).size !== 2 || s.patients.some(p => !record(p) || !keys(p, ['id', 'name', 'injury', 'additionalInjuries', 'status', 'location']) || ![p.id, p.name, p.injury, p.location].every(text) || !Array.isArray(p.additionalInjuries) || !p.additionalInjuries.every(text) || !['SHELTERED', 'EVACUATED'].includes(p.status) || p.location !== `${s.location}:${p.status === 'EVACUATED' ? 'courtyard-aid-post' : 'sheltered-reading-room'}`)) return false;
    if (!Array.isArray(s.objectIds) || s.objectIds.length !== 4 || new Set(s.objectIds).size !== 4 || !s.objectIds.includes(s.apparatus.id) || !s.objectIds.includes(s.flow.sourceObjectId) || !Array.isArray(s.rescueInjuries) || !s.rescueInjuries.every(text)) return false;
    if (!Array.isArray(s.journal) || s.journal.length > 10 || new Set(s.journal.map(r => r.eventId)).size !== s.journal.length || s.journal.some(r => !record(r) || !keys(r, ['eventId', 'week', 'command', 'check', 'summary']) || !text(r.eventId) || !integer(r.week, s.startedWeek) || !validatePerfecterEpilogueCommand(r.command) || !text(r.summary))) return false;
    if (s.status === 'RESOLVED' && (!s.patients.every(p => p.status === 'EVACUATED') || s.flow.quietedUnits !== 6)) return false;
    if (s.isolated && s.flow.quietedUnits !== 6) return false;
    if (s.reported && s.status === 'ACTIVE') return false;
    return true;
  } catch { return false; }
}
export function perfecterEpilogueBlock(s: PerfecterEpilogueState, c: PerfecterEpilogueCommand, b: PerfecterBudget): string | null {
  if (!validatePerfecterEpilogueCommand(c) || !validatePerfecterEpilogueState(s)) return '这项现场行动或已有记录无效。';
  if (b.status !== 'ACTIVE' || b.sequence !== 0 || b.health <= 0 || b.mind <= 0) return '须由仍然存活、清醒的完美者本人行动。';
  if (c.type === 'REPORT') return s.status === 'ACTIVE' ? '先完成现场处置或沿安全侧道撤离。' : s.reported ? '本次实际报告已经交接。' : null;
  if (c.type === 'REPAIR_DEVICE') return s.reported ? '先前结果已经交接，本次维修不再重开。' : s.ordinaryRepairWeek !== null ? '同一台设备已经完成有偿普通修复。' : !s.observed ? '先观察实物故障与安全出口。' : s.apparatus.durability === s.apparatus.priorDurability ? '设备已恢复到事发前的实际耐久。' : b.actions < 1 || b.cash < 12 ? '普通修复需要一次行动与12便士；撤离后可以工作筹款，再回来修同一台设备。' : s.apparatus.supplierPartsStock < 2 ? '现存适配零件不足两份，不能凭空补料。' : null;
  if (s.status !== 'ACTIVE') return '这次现场已经结束，人员、费用与损坏不会重开。';
  if (c.type === 'WITHDRAW') return null;
  if (c.type === 'OBSERVE') return s.observed ? '已经检查过这台装置、外溢信息与实际出口。' : null;
  if (!s.observed) return '先观察副送纸口、两名受伤居民、隔离闸和安全侧道。';
  if (c.type === 'ISOLATE') return s.isolated ? '机械隔离闸已经关闭，目录回送已停。' : null;
  if (c.type === 'EVACUATE' && s.patients.every(p => p.status === 'EVACUATED')) return '两名居民都已转移到院内救护点。';
  if (b.actions < 1) return '需要一次行动；仍可操作安全侧的隔离闸或沿侧道撤离。';
  if (c.type === 'CONTAIN_FLOW') return s.pageAttempted ? '这一股目录回送信息已尝试收纳过，不能重试。' : s.flow.looseUnits === 0 ? '这股外溢信息已被隔离，无需收纳。' : b.cash < 6 || b.spirituality < 12 || b.mind <= 8 ? '需要6便士封装耗材、12灵性与8精神，并保有清醒。' : null;
  if (c.type === 'RECONSTRUCT_MODEL') return s.modelAttempted || s.ordinaryRepairWeek !== null ? '同一台设备已经处理过本次校准，不能重试。' : s.apparatus.supplierPartsStock < 1 ? '保管员没有剩余适配垫片。' : b.cash < 8 || b.spirituality < 10 || b.mind <= 8 ? '需要8便士购买一份适配垫片、10灵性与8精神，并保有清醒。' : null;
  return null;
}
function releasePage(s: PerfecterEpilogueState, quiet: boolean): void {
  if (quiet) { s.flow.quietedUnits += s.flow.looseUnits + s.page.containedUnits; s.flow.looseUnits = 0; }
  else s.flow.looseUnits += s.page.containedUnits;
  s.page.containedUnits = 0; s.pageActive = false;
  if (s.page.containedFlowId !== null) s.page.status = 'RELEASED';
}
export function applyPerfecterEpilogue(s: PerfecterEpilogueState, c: PerfecterEpilogueCommand, b: PerfecterBudget,
  input: { eventId: string; revision: number; check: PublicCheckResult | null }): PerfecterEpilogueState {
  const reason = perfecterEpilogueBlock(s, c, b); if (reason) throw Error(reason);
  if (!text(input.eventId) || !integer(input.revision, s.startedRevision + 1) || s.journal.some(r => r.eventId === input.eventId)) throw Error('这项现场行动已结算或次序无效。');
  const checked = c.type === 'CONTAIN_FLOW' || c.type === 'RECONSTRUCT_MODEL';
  if (checked !== (input.check !== null)) throw Error('有限技巧需要中央产生的本次实际检定，普通处置不接受检定。');
  const next = structuredClone(s), pass = input.check?.tier === 'SUCCESS' || input.check?.tier === 'GREAT_SUCCESS';
  let summary = '';
  if (c.type === 'OBSERVE') {
    next.observed = true;
    summary = `副送纸口的旧隔离封条已经破裂，六段目录回送信息溢入阅览室，检索机又损失了12耐久，现为${next.apparatus.durability}。艾琳与乔纳斯躲在遮蔽阅览区，原来的腕伤、腿伤仍在。三位成年值班员均在场，机械隔离闸、原担架和安全侧道可用。`;
  } else if (c.type === 'WITHDRAW') {
    releasePage(next, next.isolated); next.status = 'WITHDRAWN';
    summary = `你沿安全侧道撤离。${next.patients.filter(p => p.status === 'SHELTERED').length}名未搬离居民仍在遮蔽阅览区，由原值班员照看；${next.flow.looseUnits}段未隔离信息仍在档案馆。已花费用、原伤与设备损坏全部保留。`;
  } else if (c.type === 'REPORT') {
    next.reported = true;
    for (const [attempted, id] of [[next.pageAttempted, skillIds.CONTAIN_FLOW], [next.modelAttempted, skillIds.RECONSTRUCT_MODEL]] as const) if (attempted) b.mastery[id] = Math.min(100, (b.mastery[id] ?? 0) + 2);
    b.acting = Math.min(100, b.acting + (next.pageAttempted || next.modelAttempted ? 10 : 4));
    summary = `已交接真实结果：${next.patients.filter(p => p.status === 'EVACUATED').length}人抵达院内救护点，${next.patients.filter(p => p.status === 'SHELTERED').length}人仍在遮蔽阅览区；检索机耐久${next.apparatus.durability}，隔离${next.flow.quietedUnits}/6段信息。临时文明之页已结束，现场装置仍属市政，原伤与新增伤势仍需处理。`;
  } else if (c.type === 'ISOLATE') {
    // Existing mechanical safety equipment, reachable from the safe side. This
    // short manual action is available even after failed magic uses the week's AP.
    next.isolated = true; releasePage(next, true);
    summary = '你从安全侧转动原机械隔离闸，把副送纸口与主轴断开，六段回送信息落回原封闭收纸槽。无需施术或新零件，检索机仍保留实际损坏；伤员尚需搬运。';
  } else if (c.type === 'REPAIR_DEVICE') {
    b.actions--; b.cash -= 12; next.ordinaryRepairWeek = b.week;
    next.apparatus.supplierPartsStock -= 2; next.apparatus.sparePartsPurchased += 2; next.apparatus.sparePartsInstalled += 2;
    next.apparatus.durability = next.apparatus.priorDurability; next.isolated = true; releasePage(next, true);
    summary = `支付12便士，向原保管员购入剩余的两份适配零件，原维修员按实测尺寸更换变形部件。同一检索机恢复到事发前的${next.apparatus.durability}耐久，副送纸口已隔离；受伤居民的位置、已付费用和先前施术结果均未改变。`;
  } else {
    b.actions--; next.turns++;
    if (c.type === 'EVACUATE') {
      const count = next.pageActive || next.modelApplied || next.isolated ? 2 : 1;
      const moved = next.patients.filter(p => p.status === 'SHELTERED').slice(0, count);
      moved.forEach(p => { p.status = 'EVACUATED'; p.location = `${next.location}:courtyard-aid-post`; });
      summary = `三位原值班员协助使用馆内担架，从实际侧道把${moved.length}名受伤居民搬到院内救护点。原伤和新增伤势均未消失。`;
    } else {
      const id = skillIds[c.type]; b.cash -= c.type === 'CONTAIN_FLOW' ? 6 : 8;
      b.spirituality -= c.type === 'CONTAIN_FLOW' ? 12 : 10; b.mind -= 8;
      b.mastery[id] = Math.min(100, (b.mastery[id] ?? 0) + (pass ? 8 : 3));
      if (c.type === 'CONTAIN_FLOW') {
        next.pageAttempted = true;
        if (pass) {
          next.pageActive = true; next.pageExpiresTurn = next.turns + 3;
          next.page.containedFlowId = next.flow.id; next.page.containedUnits = next.flow.looseUnits;
          next.flow.looseUnits = 0; next.page.status = 'CONTAINING';
          summary = '支付6便士耗材、12灵性与8精神，文明之页实际收纳眼前这一股六段目录回送信息，容量已满。它只保存这股无生命信息，至多维持随后三次现场行动，不收纳人或实物。';
        } else {
          summary = '支付的耗材、灵性与精神已经用去；文明之页未能承受目录回送，六段信息仍在原阅览室。检索机进一步受损，无法重试这次收纳。';
        }
      } else {
        next.modelAttempted = true; next.apparatus.supplierPartsStock--; next.apparatus.sparePartsPurchased++;
        if (pass) {
          next.modelApplied = true; next.apparatus.sparePartsInstalled++;
          next.apparatus.durability = Math.min(next.apparatus.priorDurability, next.apparatus.durability + 8);
          next.isolated = true; releasePage(next, true);
          summary = `支付8便士买入一份适配垫片、10灵性与8精神，以先前实测的同一送纸模型辅助原检索机校准限位。垫片已装入，副送纸口安全停转，六段信息落回原收纸槽，设备耐久升至${next.apparatus.durability}。没有制造新机器或恢复未知内容。`;
        } else {
          next.apparatus.sparePartsDamaged++;
          summary = '已购买的垫片在失准的副送纸口变形，模型辅助校准失败。8便士、10灵性与8精神均已花去，同一检索机继续保留损坏；仍可从安全侧手动隔离。';
        }
      }
      if (!pass) {
        const severe = input.check!.tier === 'GREAT_FAILURE', damage = severe ? 8 : 4;
        b.health = Math.max(0, b.health - (severe ? 20 : 8)); b.mind = Math.max(0, b.mind - (severe ? 8 : 3));
        b.injuries.push({ id: `${input.eventId}:archive-injury`, severity: severe ? 'HEAVY' : 'LIGHT', acquiredRevision: input.revision, treatedRevision: null }); b.injuryRisk += severe ? 2 : 1;
        next.apparatus.durability = Math.max(0, next.apparatus.durability - damage); next.routeDamage = Math.min(100, next.routeDamage + damage);
        const patient = next.patients.find(p => p.status === 'SHELTERED');
        if (patient) { patient.additionalInjuries.push('目录回送冲击造成的擦伤'); next.rescueInjuries.push(`${patient.name}在这次冲击中新增擦伤。`); summary += ` ${patient.name}新增擦伤，仍在遮蔽阅览区。`; }
        summary += ` 你损失${severe ? 20 : 8}健康并留下${severe ? '重' : '轻'}伤，检索机耐久降到${next.apparatus.durability}。`;
      }
    }
    if (next.pageActive && next.pageExpiresTurn !== null && next.turns >= next.pageExpiresTurn) {
      releasePage(next, next.isolated); summary += ' 文明之页到达短时上限，信息回到原收纸槽附近，未凭空消失。';
    }
    if (b.health === 0 || b.mind === 0 || b.pollution >= 100) { b.status = 'DEAD'; b.health = 0; next.status = 'WITHDRAWN'; releasePage(next, next.isolated); }
  }
  if (next.status === 'ACTIVE' && next.patients.every(p => p.status === 'EVACUATED') && next.flow.quietedUnits === 6) next.status = 'RESOLVED';
  if (next.status !== 'ACTIVE') releasePage(next, next.isolated);
  next.journal.push({ eventId: input.eventId, week: b.week, command: { type: c.type }, check: input.check === null ? null : structuredClone(input.check), summary });
  if (!validatePerfecterEpilogueState(next)) throw Error('现场实物与信息守恒记录不一致。');
  return next;
}
export interface PerfecterEpilogueAction { command: PerfecterEpilogueCommand; label: string; cost: string; enabled: boolean; reason: string | null }
export function getPerfecterEpilogueActions(s: PerfecterEpilogueState, b: PerfecterBudget): PerfecterEpilogueAction[] {
  const choices: { type: PerfecterEpilogueCommand['type']; label: string; cost: string }[] = [
    { type: 'OBSERVE', label: '观察外溢信息、原设备与安全出口', cost: '0行动，现场观察五分钟' },
    { type: 'CONTAIN_FLOW', label: '用文明之页收纳眼前目录回送', cost: '1行动、6便士、12灵性、8精神；仅一次' },
    { type: 'RECONSTRUCT_MODEL', label: '用已测模型辅助原检索机校准', cost: '1行动、8便士、10灵性、8精神；仅一次' },
    { type: 'ISOLATE', label: '从安全侧手动关闭机械隔离闸', cost: '0行动，普通机械处置，不修复既有损坏' },
    { type: 'REPAIR_DEVICE', label: '付费普通修复同一台受损检索机', cost: '1行动、12便士、两份现存零件；不改变救援结果' },
    { type: 'EVACUATE', label: '用原担架沿安全侧道转移居民', cost: '1行动；通常一人，信息受控后两人' },
    { type: 'WITHDRAW', label: '沿安全侧道普通撤离', cost: '0行动，保留费用、伤势与尚未完成的救援' },
    { type: 'REPORT', label: '交接实际救援与设备结果', cost: '0行动，只记录实际应用与结果' },
  ];
  return choices.map(choice => { const command: PerfecterEpilogueCommand = { type: choice.type }, reason = perfecterEpilogueBlock(s, command, b); return { command, label: choice.label, cost: choice.cost, enabled: reason === null, reason }; });
}
export function projectPerfecterEpilogue(s: PerfecterEpilogueState): { story: string; nextStep: string; lines: string[] } {
  if (!validatePerfecterEpilogueState(s)) throw Error('现场结果记录无效。');
  return { story: s.journal.at(-1)?.summary ?? '旧档案馆待修的副送纸口封条破裂，目录回送信息正在外溢。你先前帮助过的居民和同一台检索机仍在这里，实际隔离闸与侧道也仍可使用。',
    nextStep: s.status !== 'ACTIVE' ? s.reported ? '这宗现场已交接；实际伤势、未救人员与设备损坏继续保留。' : '交接实际人员位置、信息处置和设备损坏。' : !s.observed ? '先观察眼前的设备、外溢信息、受伤居民与普通出口。' : !s.isolated ? '可尝试有偿的有限技巧，也可从安全侧关闭机械隔离闸；行动不足时仍可普通撤离。' : '沿实际侧道转移受伤居民；无力继续时可撤离并如实报告。',
    lines: [
      `同一台${s.apparatus.title}：耐久${s.apparatus.durability}；保管员余料${s.apparatus.supplierPartsStock}份，已购适配零件${s.apparatus.sparePartsPurchased}份，已安装${s.apparatus.sparePartsInstalled}份，损坏${s.apparatus.sparePartsDamaged}份。`,
      `目录回送共6段：文明之页内${s.page.containedUnits}段，已机械隔离${s.flow.quietedUnits}段，仍在原馆内外溢${s.flow.looseUnits}段。`,
      `文明之页${s.pageAttempted ? s.pageActive ? '正在短时收纳这一股无生命信息' : '本次尝试已结束' : '尚未施用'}；已测模型${s.modelAttempted ? s.modelApplied ? '已经辅助同一设备完成限位修复' : '本次辅助校准失败' : '尚未施用'}。`,
      `原成年值班员：${s.operators.map(o => `${o.name}（${o.age}岁）`).join('、')}。`,
      ...s.patients.map(p => `${p.name}：${p.status === 'EVACUATED' ? '院内救护点' : '遮蔽阅览区'}；${[p.injury, ...p.additionalInjuries].join('；')}。`),
      `实际现场损坏${s.routeDamage}；安全侧道仍通，机械隔离与普通撤离不依赖施术成功。`,
    ] };
}
