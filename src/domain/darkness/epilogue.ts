import type { PublicCheckResult } from '../../shared/contracts.js';
import type { DarknessBudget } from './source.js';
import type { DarknessEvacuationState } from './evacuation.js';

/** A later, bounded incident. The evacuation remains an immutable arrival
 * record. These same original IDs now have their current positions here. */
export type DarknessEpilogueCommand = { type: 'GO_SHELTER' | 'INVITE_RETURN' | 'RETURN_RESIDENTS' | 'OBSERVE' | 'SHORT_CONCEALMENT' | 'BOUNDED_MISFORTUNE_DIVERSION' | 'STOP_EFFECTS' | 'SECURE_LOAD' | 'CROSS' | 'ORDINARY_SIDE_EXIT' | 'WITHDRAW' | 'REPORT' };
export interface DarknessEpilogueState {
  id: string; location: string; startedWeek: number; startedSecond: number;
  status: 'ACTIVE' | 'RESOLVED' | 'WITHDRAWN'; position: number; invited: boolean; returned: boolean; observed: boolean; reported: boolean;
  residents: { id: string; name: string; age: number; position: number; returnWillingness: 'ACCEPT' | 'DECLINE'; consenting: boolean; originalArrivalId: string; injuries: string[] }[];
  observer: { id: string; position: number; lineEnd: number; alertedByNoise: boolean; lostSight: boolean };
  load: { id: string; position: number; condition: number; emptyBayClear: boolean; pending: boolean; secured: boolean; landed: 'NOT_RELEASED' | 'EMPTY_BAY' | 'WALKWAY'; latchUsed: boolean };
  concealment: { attempted: boolean; passed: boolean; expiresSecond: number | null; origin: number | null; applied: boolean };
  diversion: { attempted: boolean; passed: boolean; expiresSecond: number | null; applied: boolean };
  journal: { eventId: string; second: number; command: DarknessEpilogueCommand; check: PublicCheckResult | null; summary: string }[];
}
const TYPES = ['GO_SHELTER', 'INVITE_RETURN', 'RETURN_RESIDENTS', 'OBSERVE', 'SHORT_CONCEALMENT', 'BOUNDED_MISFORTUNE_DIVERSION', 'STOP_EFFECTS', 'SECURE_LOAD', 'CROSS', 'ORDINARY_SIDE_EXIT', 'WITHDRAW', 'REPORT'] as const;
const clone = <T>(v: T): T => structuredClone(v);
const skill = (c: DarknessEpilogueCommand) => c.type === 'SHORT_CONCEALMENT' || c.type === 'BOUNDED_MISFORTUNE_DIVERSION';
export function validateDarknessEpilogueCommand(v: unknown): v is DarknessEpilogueCommand {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).join('|') === 'type' && TYPES.includes((v as DarknessEpilogueCommand).type);
}
export function createDarknessEpilogue(evacuation: DarknessEvacuationState, input: { week: number; nowSecond: number }): DarknessEpilogueState {
  const people = ['DN-LENA', 'DN-NOAH'].map(id => evacuation.residents.find(p => p.id === id));
  if (!evacuation.reportEventId || people.some(p => !p?.arrival || p.position !== 110)) throw Error('须接续原居民真实夜间抵达安全屋的记录。');
  return {
    id: 'darkness-original-residents-return', location: '黑夜街区登记处', startedWeek: input.week, startedSecond: input.nowSecond,
    status: 'ACTIVE', position: 0, invited: false, returned: false, observed: false, reported: false,
    residents: people.map(p => ({ id: p!.id, name: p!.name, age: p!.age, position: p!.position, returnWillingness: 'ACCEPT' as const, consenting: false, originalArrivalId: p!.arrival!.eventId, injuries: p!.injuries.map(i => i.description) })),
    observer: { id: 'DN-LATE-WATCHER', position: 45, lineEnd: 44, alertedByNoise: false, lostSight: false },
    load: { id: 'DN-LATE-LOOSE-SHUTTER', position: 42, condition: 70, emptyBayClear: true, pending: true, secured: false, landed: 'NOT_RELEASED', latchUsed: false },
    concealment: { attempted: false, passed: false, expiresSecond: null, origin: null, applied: false },
    diversion: { attempted: false, passed: false, expiresSecond: null, applied: false }, journal: [],
  };
}
export function darknessEpilogueBlock(s: DarknessEpilogueState, c: DarknessEpilogueCommand, b: DarknessBudget, _evacuation: DarknessEvacuationState, nowSecond: number): string | null {
  if (!validateDarknessEpilogueCommand(c)) return '这项现场行动的内容无效。';
  if (b.status !== 'ACTIVE' || b.sequence !== 0) return '只有同一在世且实际晋升的本人可以继续。';
  if (!Number.isSafeInteger(nowSecond) || nowSecond < (s.journal.at(-1)?.second ?? s.startedSecond)) return '现场时刻不能倒退。';
  if (s.reported) return '本次实际交接已经完成。';
  if (c.type === 'REPORT') return s.status === 'ACTIVE' || s.position !== 0 ? '先亲自沿普通道路返回登记处。' : null;
  if (s.status !== 'ACTIVE') return '本次行动已结束，可如实报告。';
  if (c.type === 'WITHDRAW' || c.type === 'STOP_EFFECTS') return null;
  if (c.type === 'GO_SHELTER') return s.position !== 0 || s.invited || s.returned ? '须从登记处亲走到原安全屋。' : null;
  if (c.type === 'INVITE_RETURN') return s.position !== 110 || s.invited || s.residents.some(p => p.position !== 110 || p.returnWillingness !== 'ACCEPT') ? '须本人到场、原两人仍在安全屋且当次愿意返街取物。' : null;
  if (c.type === 'RETURN_RESIDENTS') return !s.invited || s.returned || s.position !== 110 || s.residents.some(p => p.position !== 110 || !p.consenting) ? '须同处原两人愿意同行，不能隔处移动或重复返街。' : null;
  if (c.type === 'ORDINARY_SIDE_EXIT') return !s.returned || s.residents.some(p => p.position !== s.position || !p.consenting) ? '原两人须实际同处且仍愿同行；本人始终可以独自原路离开。' : null;
  if (!s.returned || s.position !== 40) return '先陪同原两人真实走回四十米街口。';
  if (c.type === 'OBSERVE') return s.observed ? '这处实际视线、卸力区与悬置物已观察。' : null;
  if (!s.observed) return '先观察实际视线、未释放的悬置物和空置卸力区。';
  if (s.residents.some(p => p.position !== 40 || !p.consenting)) return '原两人须仍在身旁并愿意同行。';
  if (c.type === 'SECURE_LOAD') return !s.load.pending || s.load.secured || s.load.latchUsed ? '原悬置物已落定或原止动扣已经使用。' : null;
  if (c.type === 'CROSS') return null;
  if (c.type === 'SHORT_CONCEALMENT' && s.concealment.attempted) return '本次短隐秘已经尝试，不能重抽。';
  if (c.type === 'BOUNDED_MISFORTUNE_DIVERSION' && (s.diversion.attempted || !s.load.pending || s.load.secured || !s.load.emptyBayClear)) return '只影响这件尚未释放的原物，且须空置卸力区仍有效；本次只能尝试一次。';
  if (skill(c) && (b.actions < 1 || b.spirituality < (c.type === 'SHORT_CONCEALMENT' ? 12 : 10) || b.mind <= (c.type === 'SHORT_CONCEALMENT' ? 8 : 6))) return '灵性、精神或行动不足；可普通止动、走侧路或独自返回。';
  return null;
}
export function applyDarknessEpilogue(s: DarknessEpilogueState, c: DarknessEpilogueCommand, b: DarknessBudget, evacuation: DarknessEvacuationState, input: { eventId: string; revision: number; nowSecond: number; check: PublicCheckResult | null }): { state: DarknessEpilogueState; evacuation: DarknessEvacuationState; seconds: number; summary: string } {
  const block = darknessEpilogueBlock(s, c, b, evacuation, input.nowSecond); if (block) throw Error(block);
  if (s.journal.some(r => r.eventId === input.eventId)) throw Error('不能重复消费原行动。');
  if (skill(c) !== (input.check !== null)) throw Error('本次实际检定与行动不一致。');
  const n = clone(s), pass = input.check?.tier === 'SUCCESS' || input.check?.tier === 'GREAT_SUCCESS';
  let seconds = 30, summary = '';
  const stop = () => { n.concealment.expiresSecond = null; n.diversion.expiresSecond = null; };
  if (c.type === 'GO_SHELTER') { n.position = 110; seconds = 110; summary = '本人沿已走查的一百一十米普通道路到达原安全屋；两名居民尚未移动。'; }
  else if (c.type === 'INVITE_RETURN') { n.invited = true; n.residents.forEach(p => { p.consenting = true; }); seconds = 60; summary = '莱娜与诺亚当面同意返街取回生活物品；其原身体、伤势与夜间到达记录保留。'; }
  else if (c.type === 'RETURN_RESIDENTS') { n.position = 40; n.residents.forEach(p => { p.position = 40; }); n.returned = true; seconds = 140; summary = '花两分二十秒，陪同原两人沿原路实际行走七十米至街口。雨后旧百叶悬在通路旁，另一处灯光正沿街追索；夜间救援的结果没有重置。'; }
  else if (c.type === 'OBSERVE') { n.observed = true; summary = '确认前方四米通路会被侧灯看见；松脱百叶尚未下落，旁侧卸力区无人。原止动扣仍可手动扣住，另有通向登记处的普通侧路。'; }
  else if (skill(c)) {
    const conceal = c.type === 'SHORT_CONCEALMENT'; seconds = conceal ? 5 : 3;
    b.actions--; b.spirituality -= conceal ? 12 : 10; b.mind -= conceal ? 8 : 6;
    if (conceal) Object.assign(n.concealment, { attempted: true, passed: pass, expiresSecond: pass ? input.nowSecond + seconds + 30 : null, origin: n.position });
    else Object.assign(n.diversion, { attempted: true, passed: pass, expiresSecond: pass ? input.nowSecond + seconds + 10 : null });
    summary = pass ? conceal ? '付出真实代价，短暂遮断已观察的这一道视线。完成后至多三十秒、十米；噪声或强照仍可暴露，原两人尚未移动。' : '付出真实代价，使同一尚未释放的百叶暂偏向空置卸力区；完成后十秒内真实落下才可能生效。' : '本次施术失败，代价已经消耗，原视线或悬置物仍在。普通止动与侧路可用。';
    if (!pass) { const severe = input.check!.tier === 'GREAT_FAILURE'; b.health = Math.max(0, b.health - (severe ? 20 : 8)); b.mind = Math.max(0, b.mind - (severe ? 8 : 3)); b.injuries.push({ id: `${input.eventId}:darkness-strain`, severity: severe ? 'HEAVY' : 'LIGHT', acquiredRevision: input.revision, treatedRevision: null }); b.injuryRisk += severe ? 2 : 1; summary += ' 反冲留下本人实际伤势，未发生的后果没有被抹去。'; }
  }
  else if (c.type === 'STOP_EFFECTS') { stop(); seconds = 0; summary = '停止维持新效果；已花费用、已发生伤势和原人物位置保持。'; }
  else if (c.type === 'SECURE_LOAD') { n.load.secured = true; n.load.latchUsed = true; n.load.condition -= 5; seconds = 60; summary = '花一分钟用原止动扣锁住同一百叶，原件实际磨损五点；无需灵性、行动或新现款。'; }
  else if (c.type === 'CROSS') {
    seconds = 8; n.position = 44; n.residents.forEach(p => { p.position = 44; });
    const hidden = n.concealment.expiresSecond !== null && input.nowSecond + seconds <= n.concealment.expiresSecond && n.concealment.origin !== null && Math.abs(44 - n.concealment.origin) <= 10 && !n.observer.alertedByNoise;
    n.observer.lostSight = hidden;
    if (hidden) { n.concealment.applied = true; b.mastery['darkness.s0.short-concealment'] = Math.min(100, (b.mastery['darkness.s0.short-concealment'] ?? 0) + 8); }
    let impact = '原止动扣保持，百叶没有下落。';
    if (n.load.pending && !n.load.secured) {
      const diverted = n.diversion.expiresSecond !== null && input.nowSecond + seconds <= n.diversion.expiresSecond && n.load.emptyBayClear;
      n.load.pending = false; n.load.condition = Math.max(0, n.load.condition - 30); n.load.landed = diverted ? 'EMPTY_BAY' : 'WALKWAY';
      if (diverted) { n.diversion.applied = true; b.mastery['darkness.s0.bounded-misfortune-diversion'] = Math.min(100, (b.mastery['darkness.s0.bounded-misfortune-diversion'] ?? 0) + 8); impact = '同一百叶实际落入空置卸力区，原物损坏三十点。'; }
      else { b.health = Math.max(0, b.health - 8); b.injuryRisk++; b.injuries.push({ id: `${input.eventId}:falling-shutter`, severity: 'LIGHT', acquiredRevision: input.revision, treatedRevision: null }); n.residents[0]!.injuries.push('返街百叶碎片造成一次擦伤'); impact = '同一百叶落向通路，本人与莱娜实际擦伤，原物损坏三十点；不会事后重启或消除伤势。'; }
    }
    summary = `原两人随你实际走过四米。${hidden ? '已知追踪视线暂失目标。' : '侧灯仍看见本次移动，不能宣称隐秘成功应用。'}${impact}`; stop();
  }
  else if (c.type === 'ORDINARY_SIDE_EXIT') { seconds = Math.ceil(n.position * 2); n.position = 0; n.residents.forEach(p => { p.position = 0; }); n.status = 'RESOLVED'; stop(); summary = '沿已走查的普通侧路慢行，原两人和本人实际到达登记处。无需行动、现款或技巧成功；所有伤损、失败与原物落点保留。'; }
  else if (c.type === 'WITHDRAW') { seconds = Math.ceil(n.position * 2); n.position = 0; n.status = 'WITHDRAWN'; stop(); summary = '本人沿普通道路亲走返回登记处；没有自动搬动未同行者，原两人仍在各自最后实际位置。'; }
  else { n.reported = true; seconds = 30; summary = `如实交接：${n.residents.filter(p => p.position === 0).length}名原居民抵达登记处，其余仍在已记位置；本人伤势、原百叶状况${n.load.condition}与原来夜间到达记录全部保留。`; }
  if (n.concealment.expiresSecond !== null && input.nowSecond + seconds > n.concealment.expiresSecond) n.concealment.expiresSecond = null;
  if (n.diversion.expiresSecond !== null && input.nowSecond + seconds > n.diversion.expiresSecond) n.diversion.expiresSecond = null;
  if (n.residents.some(p => !p.consenting)) stop();
  if (b.health <= 0 || b.mind <= 0 || b.pollution >= 100) { b.status = 'DEAD'; b.health = 0; n.status = 'WITHDRAWN'; stop(); summary += ' 本人实际死亡，不能继续控制现场。'; }
  n.journal.push({ eventId: input.eventId, second: input.nowSecond + seconds, command: clone(c), check: clone(input.check), summary });
  return { state: n, evacuation: clone(evacuation), seconds, summary };
}
export function projectDarknessEpilogue(s: DarknessEpilogueState, _evacuation: DarknessEvacuationState) {
  return { story: s.journal.at(-1)?.summary ?? '原居民仍在夜间抵达的安全屋。可亲自前去，询问是否需要陪同返街取物；不会自动搬回已救者。', nextStep: s.reported ? '本次实际交接已完成，可回普通生活。' : s.status !== 'ACTIVE' ? '报告各原人实际位置与伤损。' : !s.invited ? '先亲走安全屋，当面询问原两人。' : !s.returned ? '按原路陪同愿意的两人实际返街。' : !s.observed ? '先看清眼前视线、悬置物及普通侧路。' : '可作一次有限技巧辅助，或使用原止动扣与普通侧路。', lines: [
    `本人实际位置${s.position}米；原百叶状况${s.load.condition}，${s.load.landed === 'NOT_RELEASED' ? s.load.secured ? '原扣已止动' : '尚未下落' : s.load.landed === 'EMPTY_BAY' ? '落在无人卸力区' : '落在原通路'}。`,
    ...s.residents.map(p => `${p.name}：当前位置${p.position}米，${!s.invited ? '尚未询问本次返街意愿' : p.consenting ? '愿意同行' : '不愿继续同行'}；${p.injuries.length ? p.injuries.join('、') : '没有新增伤势'}。`),
    `短隐秘：${s.concealment.applied ? '已实际遮断本次视线' : s.concealment.attempted ? '已尝试，未证明实际应用' : '未尝试'}。厄难偏导：${s.diversion.applied ? '原物实际落入空置区' : s.diversion.attempted ? '已尝试，未证明实际应用' : '未尝试'}。`,
    '夜间撤离表保留原抵达历史；本次返街后的当前位置以上述记录为准。普通止动、侧路与本人离开不需要行动或现款。',
  ] };
}
export function getDarknessEpilogueActions(s: DarknessEpilogueState, b: DarknessBudget, ev: DarknessEvacuationState, nowSecond: number) {
  const labels: Record<DarknessEpilogueCommand['type'], string> = { GO_SHELTER: '本人沿原路去安全屋', INVITE_RETURN: '当面询问原两人返街意愿', RETURN_RESIDENTS: '陪同原两人实际返街', OBSERVE: '观察视线、悬置物与普通侧路', SHORT_CONCEALMENT: '短隐秘遮断已知视线', BOUNDED_MISFORTUNE_DIVERSION: '偏导这一次尚未释放的危险', STOP_EFFECTS: '停止维持临时效果', SECURE_LOAD: '用原止动扣普通锁住百叶', CROSS: '陪同两人实际穿过四米', ORDINARY_SIDE_EXIT: '陪同原两人沿普通侧路回登记处', WITHDRAW: '本人沿普通道路返回', REPORT: '如实交接位置与伤损' };
  const costs: Record<DarknessEpilogueCommand['type'], string> = { GO_SHELTER: '0行动、0便士；实走110米', INVITE_RETURN: '0行动、0便士；1分钟', RETURN_RESIDENTS: '0行动、0便士；搀扶实走70米', OBSERVE: '0行动、0便士；30秒', SHORT_CONCEALMENT: '1行动、12灵性、8精神；仅一次，最多30秒与10米', BOUNDED_MISFORTUNE_DIVERSION: '1行动、10灵性、6精神；仅一次，10秒内实落', STOP_EFFECTS: '0行动、0便士；既有费用不退', SECURE_LOAD: '0行动、0便士；1分钟，原物磨损5', CROSS: '0行动、0便士；8秒，未止动时有实际坠物风险', ORDINARY_SIDE_EXIT: '0行动、0便士；按实际位置慢行', WITHDRAW: '0行动、0便士；仅本人实走，不搬他人', REPORT: '0行动、0便士；30秒' };
  const actions = TYPES.map(type => { const command = { type }, reason = darknessEpilogueBlock(s, command, b, ev, nowSecond); return { command, label: labels[type], cost: costs[type], enabled: !reason, reason, preferredAction: false }; });
  const priority: DarknessEpilogueCommand['type'][] = s.status !== 'ACTIVE' ? ['REPORT']
    : !s.invited ? [s.position === 0 ? 'GO_SHELTER' : 'INVITE_RETURN', 'WITHDRAW']
    : !s.returned ? ['RETURN_RESIDENTS', 'WITHDRAW']
    : s.position === 44 ? ['ORDINARY_SIDE_EXIT', 'WITHDRAW']
    : !s.observed ? ['OBSERVE', 'ORDINARY_SIDE_EXIT', 'WITHDRAW']
    : !s.concealment.attempted ? ['SHORT_CONCEALMENT', 'SECURE_LOAD', 'ORDINARY_SIDE_EXIT', 'WITHDRAW']
    : !s.diversion.attempted ? ['BOUNDED_MISFORTUNE_DIVERSION', 'SECURE_LOAD', 'CROSS', 'ORDINARY_SIDE_EXIT', 'WITHDRAW']
    : s.diversion.expiresSecond !== null && nowSecond + 8 <= s.diversion.expiresSecond && s.load.emptyBayClear
      ? ['CROSS', 'ORDINARY_SIDE_EXIT', 'WITHDRAW']
      : ['SECURE_LOAD', 'CROSS', 'ORDINARY_SIDE_EXIT', 'WITHDRAW'];
  const next = priority.map(type => actions.find(a => a.command.type === type && a.enabled)).find(Boolean);
  if (next) next.preferredAction = true;
  return actions;
}
