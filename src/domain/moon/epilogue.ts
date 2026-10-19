import type { PublicCheckResult } from '../../shared/contracts.js';
import type { MoonBudget } from './source.js';
import type { MoonServicesState } from './services.js';
export type MoonEpilogueCommand = { type: 'OBSERVE'|'MOONLIT_CHANNEL'|'GENTLE_CROSSING'|'ORDINARY_LANTERN'|'MOOR'|'TRANSFER'|'STOP_SERVICE'|'EVACUATE'|'WITHDRAW'|'REPORT' };
export interface MoonEpilogueState {
 id: string; location: string; stationId: 'EAST'; status: 'ACTIVE'|'RESOLVED'|'WITHDRAWN'; startedWeek: number; startedSecond: number;
 passengerIds: string[]; lampId: string; boatId: string; crewId: string; observed: boolean; reported: boolean; moored: boolean;
 channel: { attempted: boolean; passed: boolean; active: boolean; actionsRemaining: number; applied: boolean };
 crossing: { attempted: boolean; passed: boolean; expiresSecond: number | null; applied: boolean };
 ordinaryLantern: boolean; transferred: boolean; evacuated: boolean; stopped: boolean;
 fitting: { supplierStock: number; purchased: number; installed: number; damaged: number }; oilPurchased: number; oilConsumedIds: string[];
 journal: { eventId: string; second: number; command: MoonEpilogueCommand; check: PublicCheckResult | null; summary: string }[];
}
const types = ['OBSERVE','MOONLIT_CHANNEL','GENTLE_CROSSING','ORDINARY_LANTERN','MOOR','TRANSFER','STOP_SERVICE','EVACUATE','WITHDRAW','REPORT'] as const;
export function validateMoonEpilogueCommand(v: unknown): v is MoonEpilogueCommand {
 return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).join('|') === 'type' && types.includes((v as MoonEpilogueCommand).type);
}
export function createMoonEpilogue(services: MoonServicesState, input: { week: number; nowSecond: number }): MoonEpilogueState {
 const st = services.stations.find(s => s.id === 'EAST')!;
 if (!st.verifiedEventId || st.passengers.some(p => p.status !== 'ARRIVED' || p.location !== p.destination)) throw Error('须接续同一东岸渡口的真实到达，不能创建另一批乘客。');
 // The ordinary old mooring now slips. This is a concrete later event affecting
 // the same vessel, not a generated new apparatus or a reset of prior wear.
 st.boat.condition = Math.max(0, st.boat.condition - 4);
 return { id: 'moon-east-late-mooring', location: st.location, stationId: 'EAST', status: 'ACTIVE', startedWeek: input.week, startedSecond: input.nowSecond,
  passengerIds: st.passengers.map(p => p.id), lampId: st.lamp.id, boatId: st.boat.id, crewId: st.crew.id, observed: false, reported: false, moored: false,
  channel: { attempted: false, passed: false, active: false, actionsRemaining: 0, applied: false }, crossing: { attempted: false, passed: false, expiresSecond: null, applied: false },
  ordinaryLantern: false, transferred: false, evacuated: false, stopped: false, fitting: { supplierStock: 1, purchased: 0, installed: 0, damaged: 0 }, oilPurchased: 0, oilConsumedIds: [], journal: [] };
}
export function moonEpilogueBlock(s: MoonEpilogueState, c: MoonEpilogueCommand, b: MoonBudget, services: MoonServicesState, nowSecond: number): string | null {
 if (!validateMoonEpilogueCommand(c) || b.sequence !== 0 || b.status !== 'ACTIVE') return '须由仍活着的月亮本人实际行动。';
 const st = services.stations.find(st => st.id === 'EAST')!;
 if (c.type === 'REPORT') return s.status === 'ACTIVE' ? '先完成转移、岸上撤离或本人普通离场，再如实交接。' : s.reported ? '这宗实际结果已经交接。' : null;
 if (s.status !== 'ACTIVE') return '这一宗实际现场已经结束，不会重开或补回损耗。';
 if (['STOP_SERVICE','EVACUATE','WITHDRAW'].includes(c.type)) return null;
 if (c.type === 'OBSERVE') return s.observed ? '已经观察过原渡船、两名原乘客、缆桩和岸路。' : null;
 if (!s.observed) return '先观察实际水道、原船和乘客位置以及普通岸路。';
 if (c.type === 'MOOR') return s.moored ? '原缆绳已经重新系牢。' : st.boat.fittedRopeId ? null : '没有实际可用的原缆绳；仍可沿岸路撤离。';
 if (c.type === 'ORDINARY_LANTERN') return s.ordinaryLantern ? '原灯已经点亮。' : !st.stock.oil.length ? '没有已付费的剩余灯油；可以系缆后沿普通岸路撤离。' : null;
 if (b.actions < 1) return '需要一次行动，普通系缆、停航与岸路撤离仍可使用。';
 if (!st.crew.willing || st.passengers.some(p => !p.consent)) return '原船员或乘客撤回了配合许可；仍可普通停航与离场。';
 if (c.type === 'MOONLIT_CHANNEL') return s.channel.attempted ? '本场这段航道已经尝试照明，不能重复施术。' : b.cash < 12 || b.spirituality < 12 || b.mind <= 8 ? '需要12便士实购一份灯油、12灵性、8精神。' : st.supplier.oilDeliveryStock < 1 ? '本地有限灯油已用尽，不能凭空生成。' : null;
 if (c.type === 'GENTLE_CROSSING') return s.crossing.attempted ? '本场同一靠泊已经尝试稳定，不能重复施术。' : b.cash < 8 || b.spirituality < 10 || b.mind <= 6 || s.fitting.supplierStock < 1 ? '需要8便士购入一枚实存反光配件、10灵性、6精神。' : null;
 if (c.type === 'TRANSFER') return s.stopped ? '已停止水上转移；可沿普通岸路撤离。' : !(s.channel.active || s.ordinaryLantern) ? '须先有实际可见的水道照明；也可直接选择岸路撤离。' : !(s.moored || s.crossing.passed && s.crossing.expiresSecond !== null && nowSecond + 30 <= s.crossing.expiresSecond) ? '须用原缆系稳渡船或在六十秒内实际使用已成功的渡行稳定。' : st.boat.condition < 60 ? '原船实际状况不安全，须走普通岸路。' : null;
 return null;
}
export function applyMoonEpilogue(s: MoonEpilogueState, c: MoonEpilogueCommand, b: MoonBudget, services: MoonServicesState,
 input: { eventId: string; revision: number; nowSecond: number; check: PublicCheckResult | null }) {
 const reason = moonEpilogueBlock(s, c, b, services, input.nowSecond); if (reason) throw Error(reason);
 const n = structuredClone(s), nextServices = structuredClone(services), st = nextServices.stations.find(st => st.id === 'EAST')!, pass = input.check?.tier === 'SUCCESS' || input.check?.tier === 'GREAT_SUCCESS';
 const checked = c.type === 'MOONLIT_CHANNEL' || c.type === 'GENTLE_CROSSING';
 if (checked !== (input.check !== null)) throw Error('只有本次有限技巧可接受中央产生的检定。');
 let seconds = 30, summary = '';
 const endEffects = () => { n.channel.active = false; n.channel.actionsRemaining = 0; n.crossing.expiresSecond = null; n.ordinaryLantern = false; st.lamp.lit = false; };
 if (c.type === 'OBSERVE') { n.observed = true; seconds = 300; summary = '东岸旧缆桩松动，原船多损失4点状况；赫莲与奥斯卡仍在先前实际抵达的彼岸登船台。露西愿意协助，原堤路仍连通内岸。近处薄雾遮住已知水道，远处情况未知，不能靠照明平息天气。'; }
 else if (c.type === 'MOONLIT_CHANNEL' || c.type === 'GENTLE_CROSSING') {
  b.actions--; b.cash -= c.type === 'MOONLIT_CHANNEL' ? 12 : 8; b.spirituality -= c.type === 'MOONLIT_CHANNEL' ? 12 : 10; b.mind -= c.type === 'MOONLIT_CHANNEL' ? 8 : 6;
  if (c.type === 'MOONLIT_CHANNEL') { st.supplier.oilDeliveryStock--; n.oilPurchased++; n.oilConsumedIds.push(`${st.lamp.id}:epilogue-oil`); st.consumedOil.push(`${st.lamp.id}:epilogue-oil`); Object.assign(n.channel, { attempted: true, passed: pass, active: pass, actionsRemaining: pass ? 2 : 0 }); summary = pass ? '实购并燃去一份12便士灯油，以12灵性与8精神照明亲眼查过的同一水道，最多维持随后两次现场动作。尚未移动任何乘客。' : '灯油、灵性和精神已经消耗，薄雾仍遮蔽这段水道；本次施术失败，不能重复。'; }
  else { n.fitting.supplierStock--; n.fitting.purchased++; if (pass) n.fitting.installed++; else n.fitting.damaged++; Object.assign(n.crossing, { attempted: true, passed: pass, expiresSecond: pass ? input.nowSecond + seconds + 60 : null }); summary = pass ? '实付8便士购入同一反光配件并安装，以10灵性与6精神稳定眼前原船一次靠泊；从完成起仅六十秒有效，乘客仍须实际移动。' : '已购的反光配件实际变形损坏，灵性与精神照常损耗，没有稳定靠泊或移动乘客。'; }
  if (!pass) { const severe = input.check!.tier === 'GREAT_FAILURE'; b.health = Math.max(0, b.health - (severe ? 20 : 8)); b.mind = Math.max(0, b.mind - (severe ? 8 : 3)); b.injuries.push({ id: `${input.eventId}:quay-injury`, severity: severe ? 'HEAVY' : 'LIGHT', acquiredRevision: input.revision, treatedRevision: null }); b.injuryRisk += severe ? 2 : 1; st.boat.condition = Math.max(0, st.boat.condition - (severe ? 6 : 2)); summary += ' 你实际受伤，原船留下新的磨损；未发生的转移没有被计作救援。'; }
 }
 else if (c.type === 'ORDINARY_LANTERN') { const oil = st.stock.oil.shift()!; st.consumedOil.push(oil); n.oilConsumedIds.push(oil); n.ordinaryLantern = true; st.lamp.lit = true; summary = '使用已付费剩余的一份灯油点亮原灯，照明近处已知水道；不会生成新的灯、油或乘客。'; }
 else if (c.type === 'MOOR') { n.moored = true; seconds = 120; summary = '用原来已经安装的缆绳实际系牢原船，无需施术或新费用，原船磨损仍在。'; }
 else if (c.type === 'TRANSFER') {
  b.actions--; n.transferred = true; n.status = 'RESOLVED';
  if (n.channel.active) { n.channel.applied = true; b.mastery['moon.s0.moonlit-channel'] = Math.min(100, (b.mastery['moon.s0.moonlit-channel'] ?? 0) + 8); }
  if (n.crossing.passed && n.crossing.expiresSecond !== null && input.nowSecond + seconds <= n.crossing.expiresSecond) { n.crossing.applied = true; b.mastery['moon.s0.gentle-crossing'] = Math.min(100, (b.mastery['moon.s0.gentle-crossing'] ?? 0) + 8); }
  st.passengers.forEach(p => { p.status = 'EVACUATED'; p.location = `${st.location}:inner-shore-refuge`; }); st.crew.location = `${st.location}:inner-shore-refuge`; st.boat.condition -= 1;
  summary = '露西亲自划动同一渡船，你协助把赫莲与奥斯卡从原彼岸登船台转移到内岸避风点并实际下船。两人仍是原来身体；仅实际成功用于这次转移的技巧增加掌握，原伤与磨损保留。';
 }
 else if (c.type === 'STOP_SERVICE') { n.stopped = true; endEffects(); seconds = 60; summary = '立即停止进一步水上转移，关闭原灯与临时技巧。两名原乘客的位置未变，普通堤路撤离仍可进行。'; }
 else if (c.type === 'EVACUATE') { n.evacuated = true; n.status = 'RESOLVED'; seconds = 1800; st.passengers.forEach(p => { p.status = 'EVACUATED'; p.location = `${st.location}:inner-shore-refuge`; }); st.crew.location = `${st.location}:inner-shore-refuge`; summary = '沿已经走查过的普通堤路，花半小时把同一两名成年人带到内岸避风点。无需行动、现款或技巧成功；费用、原伤、设备损坏和失败记录保留。'; }
 else if (c.type === 'WITHDRAW') { n.status = 'WITHDRAWN'; seconds = 600; summary = '你独自沿原堤路退出现场，两名未转移的原乘客仍在原登船台，由原船员照看；离场没有冒充成功救援。'; }
 else { n.reported = true; const reached = st.passengers.filter(p => p.location === `${st.location}:inner-shore-refuge`).length; summary = `实际交接：${reached}名原乘客抵达内岸避风点，${2 - reached}名仍在原彼岸登船台；原船状况${st.boat.condition}，已耗灯油${n.oilConsumedIds.length}份，反光配件损坏${n.fitting.damaged}枚。既有伤势与没有完成的转移如实保留。`; }
 if (c.type !== 'MOONLIT_CHANNEL' && n.channel.active && --n.channel.actionsRemaining <= 0) { n.channel.active = false; summary += ' 月照航道已到两次现场动作上限。'; }
 if (n.crossing.expiresSecond !== null && input.nowSecond + seconds > n.crossing.expiresSecond) n.crossing.expiresSecond = null;
 if (!st.crew.willing || st.passengers.some(p => !p.consent)) endEffects();
 if (b.health <= 0 || b.mind <= 0 || b.pollution >= 100) { b.status = 'DEAD'; b.health = 0; n.status = 'WITHDRAWN'; summary += ' 本人实际死亡，现场原物留在原处，不能继续控制。'; }
 if (n.status !== 'ACTIVE') endEffects();
 n.journal.push({ eventId: input.eventId, second: input.nowSecond + seconds, command: structuredClone(c), check: input.check ? structuredClone(input.check) : null, summary });
 return { state: n, services: nextServices, seconds, summary };
}
export function getMoonEpilogueActions(s: MoonEpilogueState, b: MoonBudget, services: MoonServicesState, nowSecond: number) {
 const labels: Record<MoonEpilogueCommand['type'],string> = { OBSERVE: '观察原水道、船与乘客', MOONLIT_CHANNEL: '用月照航道照明已知水道', GENTLE_CROSSING: '用柔和渡行稳定原船靠泊', ORDINARY_LANTERN: '用已购剩余灯油点原灯', MOOR: '用原缆绳普通系稳渡船', TRANSFER: '由原船员划船完成实际转移', STOP_SERVICE: '立即停止水上服务', EVACUATE: '沿普通堤路带原乘客撤离', WITHDRAW: '本人沿普通堤路离场', REPORT: '如实交接人员与设备结果' };
 const costs: Record<MoonEpilogueCommand['type'],string> = { OBSERVE: '0行动，5分钟', MOONLIT_CHANNEL: '1行动、12便士、12灵性、8精神；仅一次', GENTLE_CROSSING: '1行动、8便士、10灵性、6精神；仅一次', ORDINARY_LANTERN: '0行动、0便士；耗用一份已购灯油，30秒', MOOR: '0行动、0便士，2分钟', TRANSFER: '1行动，30秒，须有实际照明与安全靠泊', STOP_SERVICE: '0行动、0便士，1分钟', EVACUATE: '0行动、0便士，实际半小时', WITHDRAW: '0行动、0便士，实际10分钟', REPORT: '0行动、0便士，30秒' };
 return types.map(type => { const command = { type }, reason = moonEpilogueBlock(s, command, b, services, nowSecond); return { command, label: labels[type], cost: costs[type], enabled: !reason, reason }; });
}
export function projectMoonEpilogue(s: MoonEpilogueState, services: MoonServicesState) {
 const st = services.stations.find(st => st.id === 'EAST')!;
 return { story: s.journal.at(-1)?.summary ?? '东岸原缆桩发生松动，原船与先前抵达的两名乘客仍在眼前。', nextStep: s.reported ? '本次真实现场已经交接，普通生活仍可继续。' : s.status !== 'ACTIVE' ? '如实交接当前人员位置、原伤和设备损坏。' : !s.observed ? '先观察实际水道与普通岸路。' : '可作一次有限技巧辅助真实转移，也可直接沿普通岸路撤离。', lines: [
  `原船状况${st.boat.condition}，原灯状况${st.lamp.condition}；原船员${st.crew.name}。`,
  ...st.passengers.map(p => `${p.name}：${p.location === `${st.location}:inner-shore-refuge` ? '已实际抵达内岸避风点' : '仍在先前抵达的彼岸登船台'}；${p.injuries.length ? p.injuries.join('、') : '无新增乘客伤势'}。`),
  `月照航道：${s.channel.applied ? '已成功用于实际转移' : s.channel.active ? `尚可维持${s.channel.actionsRemaining}次现场动作` : s.channel.attempted ? '尝试已经结束' : '尚未尝试'}。柔和渡行：${s.crossing.applied ? '已成功用于实际转移' : s.crossing.attempted ? '本次已尝试，须在完成后六十秒内使用' : '尚未尝试'}。`,
  '普通系缆、停航、沿岸路撤离及本人离场不需要行动或现款。报告只记真实到达，不替未转移的人完成转移。',
 ] };
}
