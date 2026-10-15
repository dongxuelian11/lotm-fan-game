import { stableStringify } from '../canonical.js';
import { awardSeerMastery, type SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';
import { hasPriestOfLightOpenPractice } from '../priest-of-light/encounter.js';
import { hasUnshadowedRitualLock } from './ritual.js';

export const UNSHADOWED_CASE_IDS = ['open-domain', 'finite-purification', 'warned-sunflare'] as const;
export type UnshadowedCaseId = typeof UNSHADOWED_CASE_IDS[number];
export type UnshadowedActivityCommand =
  | { type: 'OBSERVE'; caseId: UnshadowedCaseId }
  | { type: 'PREPARE'; caseId: UnshadowedCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'PERFORM'; caseId: UnshadowedCaseId }
  | { type: 'STOP_EFFECT'; caseId: UnshadowedCaseId }
  | { type: 'CLOSE'; caseId: UnshadowedCaseId }
  | { type: 'REPORT'; caseId: UnshadowedCaseId }
  | { type: 'WITHDRAW'; caseId: UnshadowedCaseId }
  | { type: 'MOVE_ALLY' } | { type: 'RETURN_ALLY' }
  | { type: 'STEP_OUT' } | { type: 'STEP_IN' } | { type: 'COOL_TARGET' } | { type: 'REFLECT' };
export interface UnshadowedCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED';
  observedWeek: number | null; attemptWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; effectActive: boolean;
  attempts: number; closes: number; withdrawals: number;
}
export interface UnshadowedLifeState {
  siteId: 'UD4-PRACTICE-HALL'; playerLocation: 'OUTSIDE' | 'ROOM' | 'DOOR_OUTSIDE' | 'BENCH' | 'COURTYARD';
  cases: Record<UnshadowedCaseId, UnshadowedCaseState>;
  ally: { id: 'UD4-ALDEN'; name: '奥尔登·弗思'; age: 41; alive: boolean; willing: boolean; location: 'LOW' | 'OUTSIDE'; moves: number; returns: number };
  room: { doorId: 'UD4-DOOR'; doorOpen: boolean; screenId: 'UD4-SCREEN'; screenPresent: boolean; markId: 'UD4-MARK'; markPresent: boolean; lampId: 'UD4-LAMP'; lampPresent: boolean; illuminated: boolean; stepsOut: number; stepsIn: number; attemptSteppedOut: boolean; walkVerified: boolean };
  characteristic: { id: 'UD4-CHARACTERISTIC-1'; owner: 'ARCHIVE'; quantity: 1; source: 'DECEASED_ORDINARY_LOST_CONTROL_ADULT_BARD_9'; divinePollution: false; present: boolean; permission: boolean; contamination: 0 | 3; boxId: 'UD4-SHIELD-BOX'; boxPresent: boolean; containment: 'BENCH' | 'CONTAINED'; before: number | null; after: number | null };
  tile: { id: 'UD4-TILE'; present: boolean; licensedSigil: boolean; heat: 'COLD' | 'HOT'; scorchMarks: number; ordinaryWarmMarks: number; coolingSeconds: number; lampId: 'UD4-BRAZIER-LAMP'; lampPresent: boolean };
  reflected: boolean;
}
export interface UnshadowedLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: UnshadowedActivityCommand }
export interface UnshadowedLifeProjection {
  title: string; story: string; environment: string; inside: boolean; playerLocation: UnshadowedLifeState['playerLocation'];
  ally: UnshadowedLifeState['ally']; objects: string[]; reflected: boolean; actions: UnshadowedLifeAction[];
  cases: { id: UnshadowedCaseId; title: string; story: string; status: string; method: 'ABILITY' | 'ORDINARY' | null; observations: string[]; preparation: string | null; result: string | null; contactOpen: boolean; effectActive: boolean; closes: number }[];
}
export const UNSHADOWED_LIFE_STORY = '原许可练习厅UD4-PRACTICE-HALL中，原41岁奥尔登·弗思当前自愿参加。原普通门与2米出口始终是普通通路，领域没有物理墙；原空院8米标线范围是本作G。原特性来自许可档案中的一位已故普通失控序列9成年歌颂者，仅一枚原存档碎片、轻度精神污染3G，不是神性污染。原石板与幻想许可符记只用于抽象游戏操作，能力会波及同伴，实际热量须停止后另等60秒G冷却。人物、物件、场地、成本、难度与结果均为原创G。观察、准备、实施、报告各1行动，其余本次现场操作0行动；三案报告各扮演25，三案反思25。能力完成实际收束给单项掌握5、报告8，普通方法不授魔法掌握。失败成本保留，结束后下一真实周再试。';
export const UNSHADOWED_ENVIRONMENT = UNSHADOWED_LIFE_STORY;
const CASES = [
  { id: 'open-domain', title: '领域亮着，原普通门仍可走出', spirit: 5, difficulty: 16, story: '在原屏风UD4-SCREEN旁照亮同一原标记UD4-MARK。本人实际沿2米普通门走出再走回；奥尔登也能自行沿原路离开。屏风仍遮挡视线，领域不变成物理囚笼，不透视一切物质。普通方法点亮现场原灯后走同一条路。', facts: ['能力5灵性、意志16；普通原灯知识14、0灵性。', '须照明仍在时STEP_OUT再STEP_IN，才证实没有物理屏障；STOP_EFFECT不拉回身体。', '原屏风不会消失，没有全知视野、强迫同行者或永久领域。'] },
  { id: 'finite-purification', title: '许可档案中同一枚普通失控特性', spirit: 6, difficulty: 18, story: '许可档案员允许在原台处理同一枚UD4-CHARACTERISTIC-1。它来自一名此前已故的普通失控成年序列9歌颂者，原轻度精神污染为3G，无神性或极端污染。能力成功将该原碎片污染3→0；普通方法只把它放入同一原屏蔽盒封存，不清洗。原特性始终归ARCHIVE且数量仍1，不给新魔药或提取物。', facts: ['能力6灵性、意志18；失败仍3，不退款。普通原屏蔽盒知识14、0灵性。', '普通CONTAINED是封存而非净化，实际before/after保持3→3。', '不保证清除神灵或极端污染；抽离自身非凡特性可能降序列，本切片不提供免费精准抽取。没有活人实验。'] },
  { id: 'warned-sunflare', title: '原同行者走出后，同一石板留下热与焦痕', spirit: 6, difficulty: 18, story: '原净空8米标线院中只有同一原石板UD4-TILE与幻想许可符记。奥尔登须当前自愿沿原步道走出标线；能力对原石板尝试一次有限太阳耀斑，成功留下真实热量与焦痕。普通方法只用原火盆灯留下普通暖痕，不声称耀斑。停止后热量仍在，实际等待60秒G冷却再请同行者返回。', facts: ['耀斑6灵性、意志18，必须先MOVE_ALLY真实到OUTSIDE；友好身份没有免疫。', '普通原火盆灯知识14；只有能力成功产生scorchMarks，普通只留ordinaryWarmMarks。', 'STOP_EFFECT不删焦痕、不自动冷却；COOL_TARGET实际等待60秒G，原石板身份和痕迹保留。'] },
] as const;
const promoted = (s: SliceState) => s.progression.pathwayId === 'sun' && [4,3,2].includes(s.progression.sequence??0);
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const freshCase = (): UnshadowedCaseState => ({ status: 'AVAILABLE', observedWeek: null, attemptWeek: null, method: null, result: 'NONE', contactOpen: false, effectActive: false, attempts: 0, closes: 0, withdrawals: 0 });
export function createUnshadowedLifeState(): UnshadowedLifeState {
  return { siteId: 'UD4-PRACTICE-HALL', playerLocation: 'OUTSIDE', cases: { 'open-domain': freshCase(), 'finite-purification': freshCase(), 'warned-sunflare': freshCase() },
    ally: { id: 'UD4-ALDEN', name: '奥尔登·弗思', age: 41, alive: true, willing: true, location: 'LOW', moves: 0, returns: 0 },
    room: { doorId: 'UD4-DOOR', doorOpen: true, screenId: 'UD4-SCREEN', screenPresent: true, markId: 'UD4-MARK', markPresent: true, lampId: 'UD4-LAMP', lampPresent: true, illuminated: false, stepsOut: 0, stepsIn: 0, attemptSteppedOut: false, walkVerified: false },
    characteristic: { id: 'UD4-CHARACTERISTIC-1', owner: 'ARCHIVE', quantity: 1, source: 'DECEASED_ORDINARY_LOST_CONTROL_ADULT_BARD_9', divinePollution: false, present: true, permission: true, contamination: 3, boxId: 'UD4-SHIELD-BOX', boxPresent: true, containment: 'BENCH', before: null, after: null },
    tile: { id: 'UD4-TILE', present: true, licensedSigil: true, heat: 'COLD', scorchMarks: 0, ordinaryWarmMarks: 0, coolingSeconds: 0, lampId: 'UD4-BRAZIER-LAMP', lampPresent: true }, reflected: false };
}
export const hasUnshadowedLifeLock = (s: SliceState): boolean => s.unshadowed.life.playerLocation !== 'OUTSIDE' || s.unshadowed.life.ally.location !== 'LOW' || s.unshadowed.life.tile.heat !== 'COLD' || Object.values(s.unshadowed.life.cases).some(r => r.contactOpen || r.effectActive);
export const unshadowedInside = hasUnshadowedLifeLock;
export function validateUnshadowedActivityCommand(v: unknown): v is UnshadowedActivityCommand {
  if (!record(v)) return false;
  if (['MOVE_ALLY', 'RETURN_ALLY', 'STEP_OUT', 'STEP_IN', 'COOL_TARGET', 'REFLECT'].includes(String(v.type))) return shape(v, ['type']);
  if (!UNSHADOWED_CASE_IDS.includes(v.caseId as UnshadowedCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  return ['OBSERVE', 'PERFORM', 'STOP_EFFECT', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(String(v.type)) && shape(v, ['type', 'caseId']);
}
export const isUnshadowedActivityCommand = validateUnshadowedActivityCommand;
export const isUnshadowedActivity = validateUnshadowedActivityCommand;
export function blockUnshadowedLife(s: SliceState, c: UnshadowedActivityCommand): string | null {
  if([3,2].includes(s.progression.sequence??0))return '旧无暗者实践已只读，原情感回输、原特性与原人物后果保留。';
  if (!validateUnshadowedActivityCommand(c)) return '无暗者实践命令无效。';
  if (s.status !== 'ACTIVE' || !promoted(s)) return '须仍活着且实际完成无暗者晋升。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际到贝克兰德原许可练习厅。';
  if (hasUnshadowedRitualLock(s) || ['READY', 'FIGHTING'].includes(s.unshadowed.encounter.status)) return '先真实结束本次仪式或原遭遇并离开。';
  const l = s.unshadowed.life, r = 'caseId' in c ? l.cases[c.caseId] : null, domain = l.cases['open-domain'], flare = l.cases['warned-sunflare'];
  if (c.type === 'STOP_EFFECT') return r?.contactOpen && r.effectActive ? null : '没有本项仍须停止的能力或原器具操作。';
  if (c.type === 'STEP_OUT') return !domain.contactOpen || !domain.effectActive || l.playerLocation !== 'ROOM' || l.room.attemptSteppedOut ? '须在本次原照明中，从原ROOM实际走出一次。' : !l.room.doorOpen ? '原普通门当前不通，领域不替你破门。' : null;
  if (c.type === 'STEP_IN') return domain.contactOpen && l.playerLocation === 'DOOR_OUTSIDE' && l.room.doorOpen ? null : '须本人确实在原门外且原普通门畅通，才能真实返回。';
  if (c.type === 'COOL_TARGET') return !flare.contactOpen || l.tile.heat !== 'HOT' ? '没有本次尚待实际冷却的原石板。' : flare.effectActive ? '先明确停止耀斑或原火盆灯操作。' : !l.tile.present ? '原石板当前缺失，不能声称已检查并冷却它。' : null;
  if (c.type === 'RETURN_ALLY') return l.ally.location !== 'OUTSIDE' ? '原奥尔登已在LOW，无返回可伪造。' : !l.ally.alive || !l.ally.willing ? '须原成年人当前活着且自愿沿原路返回。' : flare.effectActive || l.tile.heat !== 'COLD' ? '先停止太阳耀斑或原灯，实际等待原石板冷却后再请同行者返回。' : null;
  if (c.type === 'MOVE_ALLY') return !(domain.status === 'PREPARED' || flare.status === 'PREPARED' || domain.contactOpen && domain.effectActive) ? '先准备原门或原耀斑现场。' : l.ally.location !== 'LOW' ? '原奥尔登已经实际在OUTSIDE。' : !l.ally.alive || !l.ally.willing ? '原成年人须当前活着且愿意，不能强制移动。' : !l.room.doorOpen ? '原普通门须当前畅通。' : null;
  if (c.type === 'CLOSE') return !r?.contactOpen ? '没有本项尚未结束的原接触。' : r.effectActive ? '先STOP_EFFECT明确停止本次能力或原器具。' : l.playerLocation === 'DOOR_OUTSIDE' ? '本人仍在门外，须先沿同一普通门STEP_IN实际返回核对。' : l.ally.location !== 'LOW' ? '先请当前自愿的原奥尔登真实返回。' : l.tile.heat !== 'COLD' ? '同一原石板仍热，须实际冷却后检查。' : null;
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '只可取消尚未实施的准备，原成本不会退款。';
  const performingOutside = c.type === 'PERFORM' && r?.status === 'PREPARED' && l.ally.location === 'OUTSIDE' && l.playerLocation === 'OUTSIDE' && !Object.values(l.cases).some(x => x.contactOpen);
  if (hasUnshadowedLifeLock(s) && !performingOutside) return '先实际停止、返回、冷却并结束当前原现场。';
  if (hasPriestOfLightOpenPractice(s) || Object.values(s.priestOfLight.cases).some(x => x.status === 'PREPARED')) return '旧光之祭司原身体、冰、灯笼、灵体与契约须已真实收束。';
  if (Object.entries(l.cases).some(([id, value]) => value.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先实施或取消另一项原准备。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神；原现场0行动收束仍可执行。';
  if (c.type === 'REFLECT') return l.reflected ? '已经完成三案反思。' : UNSHADOWED_CASE_IDS.some(id => l.cases[id].status !== 'RESOLVED') ? '先完成三项真实报告。' : null;
  if (s.actionsRemaining < 1) return '本次需要1行动。';
  if (!r || !('caseId' in c)) return '未知原实践。';
  const i = UNSHADOWED_CASE_IDS.indexOf(c.caseId), p = CASES[i]!;
  if (r.status === 'RESOLVED') return '本案已报告，不重置原物或重复成长。';
  if (i > 0 && l.cases[UNSHADOWED_CASE_IDS[i - 1]!].status !== 'RESOLVED') return '先完成前一项原现场报告。';
  if (!l.ally.alive || !l.ally.willing) return '原奥尔登须当前活着且仍愿意参与，过去许可不能代替。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '原观察已保留。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先观察原现场。' : r.attemptWeek === s.week ? '本周成本保留，下一真实周再准备。' : null;
  if (c.type === 'REPORT') return r.status === 'EXAMINED' && r.result !== 'NONE' ? null : '先取得真实结果并停止、返回、冷却、结束。';
  if (r.status !== 'PREPARED' || r.attemptWeek === s.week) return '先准备本次实践，同周不能反复实施。';
  if (c.caseId === 'open-domain' && (!l.room.doorOpen || !l.room.screenPresent || !l.room.markPresent || r.method === 'ORDINARY' && !l.room.lampPresent)) return '须同一原屏风、标记与畅通普通门；普通方法还须原灯。';
  if (c.caseId === 'finite-purification' && (!l.characteristic.present || !l.characteristic.permission || l.characteristic.owner !== 'ARCHIVE' || l.characteristic.quantity !== 1 || l.characteristic.source !== 'DECEASED_ORDINARY_LOST_CONTROL_ADULT_BARD_9' || l.characteristic.divinePollution !== false || l.characteristic.contamination !== 3 || !l.characteristic.boxPresent)) return '仅许可档案中同一枚轻度普通污染原特性可实施，不能替换目标、免费抽取或净化神性污染。';
  if (c.caseId === 'warned-sunflare' && (!l.tile.present || !l.tile.licensedSigil || r.method === 'ORDINARY' && !l.tile.lampPresent)) return '须同一原石板与幻想许可符记，普通方法还须原火盆灯。';
  if (c.caseId === 'warned-sunflare' && r.method === 'ABILITY' && l.ally.location !== 'OUTSIDE') return '先MOVE_ALLY请原奥尔登沿原路真实走出8米标线，友好身份不提供耀斑免疫。';
  return r.method === 'ABILITY' && (!Number.isFinite(s.spirituality) || s.spirituality < p.spirit) ? `需要${p.spirit}灵性，失败照耗；可0行动取消。` : null;
}
export function applyUnshadowedActivity(s: SliceState, c: UnshadowedActivityCommand, ctx: SeerContext): void {
  const reason = blockUnshadowedLife(s, c); if (reason) throw new Error(reason);
  const l = s.unshadowed.life;
  if (c.type === 'MOVE_ALLY' || c.type === 'RETURN_ALLY') { const move = c.type === 'MOVE_ALLY'; l.ally.location = move ? 'OUTSIDE' : 'LOW'; if (move) l.ally.moves++; else l.ally.returns++; ctx.note(move ? '原奥尔登自愿走出原标线' : '原奥尔登沿原路真实返回', '原成年人当前活着且愿意，沿畅通原普通门与8米标线步道实际步行' + (move ? '到OUTSIDE。领域没有物理墙，此次实际不在范围不代表友军自动免疫。' : '回LOW。热量已冷却，没有传送、强迫或恢复任何资源。')); return; }
  if (c.type === 'STEP_OUT' || c.type === 'STEP_IN') { const out = c.type === 'STEP_OUT'; l.playerLocation = out ? 'DOOR_OUTSIDE' : 'ROOM'; if (out) { l.room.stepsOut++; l.room.attemptSteppedOut = true; } else { l.room.stepsIn++; l.room.walkVerified = l.cases['open-domain'].effectActive && l.room.attemptSteppedOut; } ctx.note(out ? '本人实际走出原普通门' : '本人沿同一原普通门走回', `本人沿原2米普通通路${out ? '离开照明房间到DOOR_OUTSIDE' : '从DOOR_OUTSIDE回到ROOM'}，没有穿墙、瞬移或领域拉回。${l.cases['open-domain'].effectActive ? '原照明仍在，原屏风仍遮挡，真实步行说明领域没有物理屏障。' : '照明已停，此次返回只收束身体位置，不补做照明中的往返证明。'}`); return; }
  if (c.type === 'COOL_TARGET') { l.tile.heat = 'COLD'; l.tile.coolingSeconds += 60; ctx.note('实际等同一原石板冷却', '停止作用后，在原现场实际等待60秒G并检查同一UD4-TILE，HOT→COLD；原焦痕或普通暖痕保留，不删除烧灼、不治伤、不补灵性。'); return; }
  if (c.type === 'STOP_EFFECT') { const r = l.cases[c.caseId]; r.effectActive = false; if (c.caseId === 'open-domain') { l.room.illuminated = false; if (!l.room.walkVerified) r.result = 'NONE'; } ctx.note('停止本次有限作用', '本人明确停下领域、净化、耀斑或现场原灯操作。本人和同行者仍在真实位置，原特性的实际污染、封存、石板热量与焦痕全部保留；不拉回身体、不自动冷却。' + (c.caseId === 'open-domain' && !l.room.walkVerified ? '本次尚未在照明中完成真实往返，不能报告合格结果，收束后下一真实周重试。' : '')); return; }
  if (c.type === 'CLOSE') { const r = l.cases[c.caseId]; r.contactOpen = false; r.closes++; r.status = r.result === 'NONE' ? 'OBSERVED' : 'EXAMINED'; l.playerLocation = 'OUTSIDE'; if (r.result === 'ABILITY') awardSeerMastery(s, `unshadowed-practice:${c.caseId}`, 5, ctx); ctx.note('实际检查原物并离开', '本人在原现场检查真实结果后沿普通出口离开。能力已停、奥尔登实际返回、原石板已冷却；原特性仍归档案、数量仍1，焦痕与所有成本保留。' + (r.result === 'NONE' ? '未取得合格结果，下一真实周才能再准备。' : '实际收束已完成，尚须报告。')); return; }
  if (c.type === 'WITHDRAW') { const r = l.cases[c.caseId]; r.status = 'OBSERVED'; r.method = null; r.withdrawals++; ctx.note('取消尚未实施的准备', '原观察、已付准备行动和真实物体状态保留。没有施法或退款，同行者若仍在OUTSIDE须单独请其真实返回。'); return; }
  if (c.type === 'REFLECT') { l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('unshadowed-reflection'); ctx.note('无暗领域仍有出口，净化与耀斑都有边界', '三项真实报告后G扮演+25。领域不是物理墙，普通污染净化不保证对神性有效，抽离自身特性可能降序列；耀斑不会自动豁免同伴，停火不删除真实热量。不提前获得正义导师能力。'); return; }
  s.actionsRemaining--;
  const p = CASES.find(x => x.id === c.caseId)!, r = l.cases[c.caseId];
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; r.observedWeek = s.week; ctx.note(p.title, p.story + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = c.method; ctx.note(p.title, c.method === 'ABILITY' ? `准备有限能力，实施另耗${p.spirit}灵性、意志${p.difficulty}；实际成本与收束不可省略。` : '准备同一原现场普通方法，实施知识14、0灵性，不授能力掌握。'); return; }
  if (c.type === 'REPORT') { r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); const source = `unshadowed-case:${p.id}`; if (r.result === 'ABILITY') awardSeerMastery(s, source, 8, ctx); else s.seer.completedSources.push(source); ctx.note(p.title, resultText(s, p.id) + `实际报告G扮演+25；${r.result === 'ABILITY' ? '已有知识池单项掌握+8。' : '普通方法不增加魔法掌握。'}`); return; }
  r.status = 'ACTIVE'; r.contactOpen = true; r.attemptWeek = s.week; r.attempts++; r.result = 'NONE';
  l.playerLocation = p.id === 'open-domain' ? 'ROOM' : p.id === 'finite-purification' ? 'BENCH' : 'COURTYARD';
  if (p.id === 'open-domain') { l.room.attemptSteppedOut = false; l.room.walkVerified = false; }
  if (p.id === 'finite-purification') { l.characteristic.before = l.characteristic.contamination; l.characteristic.after = l.characteristic.contamination; }
  const ability = r.method === 'ABILITY'; if (ability) s.spirituality -= p.spirit;
  const check = ctx.check(ability ? 'will' : 'knowledge', ability ? p.difficulty : 14), success = ['SUCCESS', 'GREAT_SUCCESS'].includes(check.tier);
  if (success) { r.result = r.method!; r.effectActive = true;
    if (p.id === 'open-domain') l.room.illuminated = true;
    else if (p.id === 'finite-purification') { if (ability) l.characteristic.contamination = 0; else l.characteristic.containment = 'CONTAINED'; l.characteristic.after = l.characteristic.contamination; }
    else { l.tile.heat = 'HOT'; if (ability) l.tile.scorchMarks++; else l.tile.ordinaryWarmMarks++; }
  }
  ctx.note(p.title, success ? resultText(s, p.id) + '先明确停止，实际往返或冷却与同行者返回，再结束并报告。' : `本次失败，1行动${ability ? `和${p.spirit}灵性` : ''}照耗；没有新照明、污染削减或石板痕迹。本人及同行者仍在原真实位置，须收束后下一真实周再试。`);
}
function resultText(s: SliceState, id: UnshadowedCaseId): string {
  const l = s.unshadowed.life, r = l.cases[id], ability = r.result === 'ABILITY';
  if (id === 'open-domain') return `${ability ? '有限领域' : '原普通灯'}实际照亮同一原标记，原屏风仍遮挡；${l.room.walkVerified ? '已在照明中沿普通门真实走出并返回，没有物理屏障。' : '尚须在照明仍在时真实走出并返回，不能仅凭文字认定完成。'}`;
  if (id === 'finite-purification') return `同一枚${l.characteristic.id}实际污染${l.characteristic.before}→${l.characteristic.after}G，${ability ? '仅普通失控精神污染净化成功，不保证神性或极端污染。' : '已进入原屏蔽盒CONTAINED，污染没有被清除。'}原数量1、所有者ARCHIVE保持，没有免费抽取、自身降序列操作或新魔药。`;
  return `${ability ? '有限太阳耀斑在同一原石板留下焦痕' : '原火盆灯在同一原石板留下普通暖痕，没有耀斑'}；当前${l.tile.heat}、焦痕${l.tile.scorchMarks}、普通暖痕${l.tile.ordinaryWarmMarks}，实际冷却${l.tile.coolingSeconds}秒G。${ability ? '原奥尔登此前实际走出8米标线，同伴身份没有免疫。' : ''}`;
}
export function unshadowedLifeActions(s: SliceState): UnshadowedLifeAction[] {
  if (s.progression.pathwayId === 'sun' && s.progression.sequence === 2) return [];
  if (!promoted(s)) return [];
  const out: UnshadowedLifeAction[] = [], add = (command: UnshadowedActivityCommand, label: string, cost: string) => { const reason = blockUnshadowedLife(s, command); out.push({ id: `unshadowed-${command.type}${'caseId' in command ? `-${command.caseId}${'method' in command ? `-${command.method}` : ''}` : ''}`, label, cost, command, enabled: reason === null, reason }); };
  for (const p of CASES) { add({ type: 'OBSERVE', caseId: p.id }, `观察：${p.title}`, '1行动'); add({ type: 'PREPARE', caseId: p.id, method: 'ABILITY' }, `准备能力：${p.title}`, '1行动'); add({ type: 'PREPARE', caseId: p.id, method: 'ORDINARY' }, `准备普通方法：${p.title}`, '1行动'); add({ type: 'PERFORM', caseId: p.id }, `实际实施：${p.title}`, s.unshadowed.life.cases[p.id].method === 'ABILITY' ? `1行动 · ${p.spirit}灵性 · 意志${p.difficulty}` : '1行动 · 普通知识14'); for (const [type, label] of [['STOP_EFFECT', '停止本次有限作用'], ['CLOSE', '检查原物并沿出口离开'], ['WITHDRAW', '取消尚未实施的准备']] as const) add({ type, caseId: p.id }, `${label}：${p.title}`, '0行动'); add({ type: 'REPORT', caseId: p.id }, `报告：${p.title}`, '1行动 · 扮演25'); }
  add({ type: 'STEP_OUT' }, '本人沿原2米普通门实际走出', '0行动 · 领域没有物理墙'); add({ type: 'STEP_IN' }, '本人沿同一原普通门实际返回', '0行动 · 不瞬移'); add({ type: 'MOVE_ALLY' }, '请奥尔登自愿沿原步道走出8米标线', '0行动 · 同伴无自动免疫'); add({ type: 'COOL_TARGET' }, '停止后实际等待原石板冷却', '0行动 · 现场60秒G · 焦痕保留'); add({ type: 'RETURN_ALLY' }, '请奥尔登自愿沿原路返回', '0行动 · 先停火与实际冷却'); add({ type: 'REFLECT' }, '反思原普通门、有限净化与耀斑边界', '0行动 · 扮演25'); return out;
}
export function projectUnshadowedLife(s: SliceState): UnshadowedLifeProjection {
  const l = s.unshadowed.life;
  return { title: '无暗者原许可练习厅', story: UNSHADOWED_LIFE_STORY, environment: UNSHADOWED_ENVIRONMENT, inside: hasUnshadowedLifeLock(s), playerLocation: l.playerLocation, ally: { ...l.ally }, reflected: l.reflected, actions: unshadowedLifeActions(s),
    cases: CASES.map(p => { const r = l.cases[p.id]; return { id: p.id, title: p.title, story: p.story, status: r.status, method: r.method, observations: r.observedWeek === null ? [] : [...p.facts], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? `${p.spirit}灵性、意志${p.difficulty}；失败照耗` : '原器具普通知识14、0灵性' : null, result: r.result !== 'NONE' ? resultText(s, p.id) : r.attemptWeek !== null ? '尚无合格结果，原成本与物体事实保留；收束后下一真实周重试。' : null, contactOpen: r.contactOpen, effectActive: r.effectActive, closes: r.closes }; }),
    objects: [`${l.siteId} · 本人${l.playerLocation} · 原普通门${l.room.doorOpen ? '开放' : '当前不通'} · 没有领域物理墙`, `${l.room.screenId}仍遮挡视线；${l.room.markId}仅被照明才可见 · 当前照明${l.room.illuminated ? 'ON' : 'OFF'} · 本人实际走出${l.room.stepsOut}次/返回${l.room.stepsIn}次 · 本次照明中往返${l.room.walkVerified ? '已完成' : '未完成'}`, `${l.characteristic.id} · 许可档案已故普通失控成年歌颂者9原特性 · 仅轻度精神污染${l.characteristic.contamination}G · 本次${l.characteristic.before ?? '未实施'}→${l.characteristic.after ?? '未实施'} · ${l.characteristic.containment} · 原数量${l.characteristic.quantity} · 所有者${l.characteristic.owner} · 无神性污染净化保证或免费抽取`, `${l.tile.id} · 热量${l.tile.heat} · 耀斑焦痕${l.tile.scorchMarks} · 原火盆灯普通暖痕${l.tile.ordinaryWarmMarks} · 实际停止后冷却${l.tile.coolingSeconds}秒G · 原物痕迹不删除`] };
}
export function validateUnshadowedLife(s: SliceState): boolean {
  const l = s.unshadowed?.life, base = createUnshadowedLifeState(), promotion = s.unshadowed?.promotionWeek;
  if (!record(l) || !shape(l, Object.keys(base)) || !record(l.cases) || !shape(l.cases, UNSHADOWED_CASE_IDS) || !Array.isArray(s.seer.completedSources)) return false;
  for (const k of ['ally', 'room', 'characteristic', 'tile'] as const) if (!record(l[k]) || !shape(l[k], Object.keys(base[k]))) return false;
  if (promotion === null) return stableStringify(l) === stableStringify(base) && !s.seer.completedSources.some(x => x.startsWith('unshadowed-case:') || x.startsWith('unshadowed-practice:') || x === 'unshadowed-reflection');
  if (!integer(promotion, 1, s.week) || !promoted(s) || l.siteId !== base.siteId || !['OUTSIDE', 'ROOM', 'DOOR_OUTSIDE', 'BENCH', 'COURTYARD'].includes(l.playerLocation)) return false;
  const a = l.ally, room = l.room, f = l.characteristic, tile = l.tile;
  if (a.id !== base.ally.id || a.name !== base.ally.name || a.age !== 41 || typeof a.alive !== 'boolean' || typeof a.willing !== 'boolean' || !['LOW', 'OUTSIDE'].includes(a.location) || !integer(a.moves) || !integer(a.returns) || a.moves - a.returns !== (a.location === 'OUTSIDE' ? 1 : 0)) return false;
  if (room.doorId !== base.room.doorId || room.screenId !== base.room.screenId || room.markId !== base.room.markId || room.lampId !== base.room.lampId || ['doorOpen', 'screenPresent', 'markPresent', 'lampPresent', 'illuminated', 'attemptSteppedOut', 'walkVerified'].some(k => typeof room[k as keyof typeof room] !== 'boolean') || !integer(room.stepsOut) || !integer(room.stepsIn) || room.stepsOut - room.stepsIn !== (l.playerLocation === 'DOOR_OUTSIDE' ? 1 : 0)) return false;
  if (f.id !== base.characteristic.id || f.owner !== 'ARCHIVE' || f.quantity !== 1 || f.source !== base.characteristic.source || f.divinePollution !== false || f.boxId !== base.characteristic.boxId || ['present', 'permission', 'boxPresent'].some(k => typeof f[k as keyof typeof f] !== 'boolean') || ![0, 3].includes(f.contamination) || !['BENCH', 'CONTAINED'].includes(f.containment)) return false;
  if (tile.id !== base.tile.id || tile.lampId !== base.tile.lampId || ['present', 'licensedSigil', 'lampPresent'].some(k => typeof tile[k as keyof typeof tile] !== 'boolean') || !['COLD', 'HOT'].includes(tile.heat) || !integer(tile.scorchMarks, 0, 1) || !integer(tile.ordinaryWarmMarks, 0, 1) || ![0, 60].includes(tile.coolingSeconds)) return false;
  let open = 0, prepared = 0, resolved = 0;
  for (const [i, id] of UNSHADOWED_CASE_IDS.entries()) { const r = l.cases[id];
    if (!record(r) || !shape(r, Object.keys(freshCase())) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result) || r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || typeof r.contactOpen !== 'boolean' || typeof r.effectActive !== 'boolean' || !integer(r.attempts, 0, s.week - promotion + 1) || !integer(r.closes, 0, r.attempts) || !integer(r.withdrawals)) return false;
    if (r.status === 'AVAILABLE') { if (stableStringify(r) !== stableStringify(freshCase())) return false; }
    else if (!integer(r.observedWeek, promotion, s.week) || i > 0 && l.cases[UNSHADOWED_CASE_IDS[i - 1]!].status !== 'RESOLVED') return false;
    if (r.attemptWeek !== null && (!integer(r.attemptWeek, r.observedWeek ?? promotion, s.week) || r.attempts === 0) || (r.attemptWeek === null) !== (r.attempts === 0)) return false;
    if (r.result !== 'NONE' && (r.result !== r.method || r.attemptWeek === null) || r.closes !== r.attempts - (r.contactOpen ? 1 : 0)) return false;
    if ((r.status === 'ACTIVE') !== r.contactOpen || r.effectActive && (!r.contactOpen || r.result === 'NONE')) return false;
    const expectedLocation = id === 'open-domain' ? ['ROOM', 'DOOR_OUTSIDE'] : id === 'finite-purification' ? ['BENCH'] : ['COURTYARD'];
    if (r.contactOpen) { open++; if (r.attemptWeek !== s.week || r.method === null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND' || s.combat || s.activeEvent || !expectedLocation.includes(l.playerLocation)) return false; }
    if (r.status === 'PREPARED') { prepared++; if (r.method === null || r.result !== 'NONE' || r.attemptWeek === s.week) return false; }
    if (r.status === 'OBSERVED' && r.result !== 'NONE' || ['EXAMINED', 'RESOLVED'].includes(r.status) && (r.result === 'NONE' || r.closes === 0 || r.contactOpen)) return false;
    if (r.status === 'RESOLVED') resolved++;
    const completedAbility = r.result === 'ABILITY' && ['EXAMINED', 'RESOLVED'].includes(r.status);
    if (s.seer.completedSources.filter(x => x === `unshadowed-case:${id}`).length !== (r.status === 'RESOLVED' ? 1 : 0) || s.seer.completedSources.filter(x => x === `unshadowed-practice:${id}`).length !== (completedAbility ? 1 : 0)) return false;
  }
  const domain = l.cases['open-domain'], purification = l.cases['finite-purification'], flare = l.cases['warned-sunflare'];
  if (open > 1 || prepared > 1 || open && prepared || (l.playerLocation !== 'OUTSIDE') !== (open === 1) || a.location === 'OUTSIDE' && !open && !prepared && !Object.values(l.cases).some(r => r.withdrawals > 0 && r.status === 'OBSERVED')) return false;
  if (room.illuminated !== domain.effectActive || room.stepsOut > domain.attempts || room.walkVerified && (!room.attemptSteppedOut || room.stepsIn < 1 || domain.result === 'NONE') || room.attemptSteppedOut && room.stepsOut < 1 || ['EXAMINED', 'RESOLVED'].includes(domain.status) && !room.walkVerified || l.playerLocation === 'DOOR_OUTSIDE' && !room.attemptSteppedOut) return false;
  if (f.contamination !== (purification.result === 'ABILITY' ? 0 : 3) || f.containment !== (purification.result === 'ORDINARY' ? 'CONTAINED' : 'BENCH') || f.before !== (purification.attempts > 0 ? 3 : null) || f.after !== (purification.attempts > 0 ? f.contamination : null)) return false;
  if (tile.scorchMarks !== (flare.result === 'ABILITY' ? 1 : 0) || tile.ordinaryWarmMarks !== (flare.result === 'ORDINARY' ? 1 : 0) || (tile.heat === 'HOT') !== (tile.scorchMarks + tile.ordinaryWarmMarks === 1 && tile.coolingSeconds === 0) || tile.coolingSeconds > 0 && (tile.scorchMarks + tile.ordinaryWarmMarks !== 1 || flare.effectActive)) return false;
  if (tile.heat === 'HOT' && !flare.contactOpen || flare.effectActive && flare.method === 'ABILITY' && a.location !== 'OUTSIDE' || flare.result === 'ABILITY' && a.moves < 1 || !flare.contactOpen && tile.heat !== 'COLD') return false;
  return typeof l.reflected === 'boolean' && (!l.reflected || resolved === 3) && s.seer.completedSources.filter(x => x === 'unshadowed-reflection').length === (l.reflected ? 1 : 0) && ((s.progression.sequence===3||s.progression.sequence===2)?s.justiceMentor.unshadowedActingAtPromotion:s.progression.acting) === resolved * 25 + (l.reflected ? 25 : 0);
}
