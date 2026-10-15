import { stableStringify } from '../canonical.js';
import { awardSeerMastery, type SeerContext } from '../seer/index.js';
import type { SliceState } from '../slice/types.js';

export const CATACLYSM_PRIEST_CASE_IDS = ['sea-eddy', 'wind-screen', 'lightning-stone'] as const;
export type CataclysmPriestCaseId = typeof CATACLYSM_PRIEST_CASE_IDS[number];
export type CataclysmPriestActivityCommand =
  | { type: 'OBSERVE'; caseId: CataclysmPriestCaseId }
  | { type: 'PERFORM'; caseId: CataclysmPriestCaseId }
  | { type: 'STOP_EFFECT'; caseId: CataclysmPriestCaseId }
  | { type: 'CLOSE'; caseId: CataclysmPriestCaseId }
  | { type: 'REPORT'; caseId: CataclysmPriestCaseId }
  | { type: 'WITHDRAW'; caseId: CataclysmPriestCaseId }
  | { type: 'PREPARE'; caseId: CataclysmPriestCaseId; method: 'ABILITY' | 'ORDINARY' }
  | { type: 'MOVE_ALLY' }
  | { type: 'RETURN_ALLY' }
  | { type: 'RETURN_FLOAT' }
  | { type: 'REFLECT' };
export interface CataclysmPriestCaseState {
  status: 'AVAILABLE' | 'OBSERVED' | 'PREPARED' | 'ACTIVE' | 'EXAMINED' | 'RESOLVED';
  observedWeek: number | null; attemptWeek: number | null; method: 'ABILITY' | 'ORDINARY' | null;
  result: 'NONE' | 'ABILITY' | 'ORDINARY'; contactOpen: boolean; effectActive: boolean;
  attempts: number; closes: number; withdrawals: number;
}
export interface CataclysmPriestLifeState {
  cases: Record<CataclysmPriestCaseId, CataclysmPriestCaseState>;
  siteId: 'CP4-PRACTICE-BAY'; waterSource: 'SEAWATER' | 'NONE'; playerLocation: 'OUTSIDE' | 'SHORE';
  ally: { id: 'CP4-SYLVA'; name: '西尔瓦·霍尔特'; age: 38; alive: boolean; willing: boolean; location: 'LOW' | 'RIDGE'; moves: number; returns: number };
  float: { id: 'CP4-FLOAT'; owner: 'CP4-SYLVA'; empty: true; location: 'BANK' | 'MARK'; moves: number; returns: number };
  rope: { id: 'CP4-ROPE'; owner: 'CP4-SYLVA'; present: boolean; durability: number };
  tarp: { id: 'CP4-TARP'; owner: 'CP4-SYLVA'; present: boolean; deployed: boolean; wetness: number };
  tray: { id: 'CP4-TRAY'; present: boolean; capturedUnits: number; wetness: number };
  stone: { id: 'CP4-STONE'; present: boolean; naturalMark: true; scorchMarks: number; ordinaryInspections: number };
  reflected: boolean;
}
export interface CataclysmPriestLifeAction { id: string; label: string; cost: string; enabled: boolean; reason: string | null; command: CataclysmPriestActivityCommand }
export interface CataclysmPriestLifeProjection {
  title: string; story: string;
  cases: { id: CataclysmPriestCaseId; title: string; story: string; status: string; method: 'ABILITY' | 'ORDINARY' | null; result: string | null; contactOpen: boolean; effectActive: boolean; observations: string[]; observedWeek: number | null; attemptWeek: number | null }[];
  objects: string[]; ally: CataclysmPriestLifeState['ally']; reflected: boolean; inside: boolean; actions: CataclysmPriestLifeAction[];
}
export const CATACLYSM_PRIEST_LIFE_STORY = '原CP4-PRACTICE-BAY有实际海水与一条普通干燥高路，原38岁西尔瓦·霍尔特自愿参与。同一原空浮具、绳、帆布、接水盘和石靶不复制、不转移所有权。人物、场地、尺度、难度与成长均为原创G。观察、准备、实施、报告各1行动；请求同行者真实走到高地、停止、归还浮具、请求真实返回、结束、取消和反思各0行动。能力实施前同行者须当前活着、自愿并实际在RIDGE；身份不提供免疫。三案各扮演25，反思25；能力成功单项掌握5、报告8，普通方法不授能力掌握。失败照耗、结束后下一真实周再试，不能无限海水或免费制造元素。';
const CASES = [
  { id: 'sea-eddy', title: '同一原空浮具的四米往返', spirit: 5, difficulty: 16, abilityId: 'tyrant.s4.surge-control', story: '西尔瓦同意在原湾一段四米标线水道移动自己系留的空浮具CP4-FLOAT。实际海水、原绳CP4-ROPE和普通绞盘都在原处。能力只拨动本段真实海水成有限小旋流；普通方法由本人用原绞盘移动同一浮具。停转不会使浮具返回，须另用仍可操作的同一原绳真实拉回。', facts: ['原空浮具BANK→MARK为实际四米位移；只有这一件，归西尔瓦。', '成功移动使同一原绳耐久−10，停止后保留；RETURN_FLOAT不修复原绳。', '能力5灵性、意志16；普通原绞盘知识14。没有无海造水、远程全海域统御或巨浪。'] },
  { id: 'wind-screen', title: '没有消失的原湾水雾', spirit: 4, difficulty: 16, abilityId: 'tyrant.s4.sea-tornado', story: '原湾空作业带有真实海水水雾、原帆布CP4-TARP与原接水盘CP4-TRAY。能力以有限短风改变这一股水雾的去向，或普通展开原帆布，把同一股真实水导进同一原盘。西尔瓦先真实离开低处；水会留下接水量和湿痕，不能被风删除。', facts: ['原盘取得一份有限接水量与湿痕；这是原创G记录单位，不是凭空生产物品。', '普通帆布成功后也实际湿润，STOP_EFFECT收起帆布但不消除湿痕。', '能力4灵性、意志16；普通原帆布知识14。没有改写天气、永久风墙或友军自动免疫。'] },
  { id: 'lightning-stone', title: '空岸同一块原石上的痕迹', spirit: 6, difficulty: 18, abilityId: 'tyrant.s4.great-lightning', story: '原空岸标线内只有原石CP4-STONE及导师预设的幻想许可符记（原创G），西尔瓦须真实到高地。能力向同一原石尝试一道有限雷击，成功保留焦痕；普通方法只检查原石既有的一道自然风暴痕，不假称施法。此处不提供现实电气施工或接触带电设施方法。', facts: ['能力6灵性、意志18，可失败且失败照耗；不会凭一次点击造出无限风暴。', '只有成功能力会新增一处焦痕，普通检查只记录既有原自然痕。', 'STOP_EFFECT停止本次接触，CLOSE实际检查保留的原痕并离开，之后才可报告。'] },
] as const;
const promoted = (s: SliceState) => s.progression.pathwayId === 'tyrant' && [4,3,2].includes(s.progression.sequence??0);
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shape = (v: object, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const freshCase = (): CataclysmPriestCaseState => ({ status: 'AVAILABLE', observedWeek: null, attemptWeek: null, method: null, result: 'NONE', contactOpen: false, effectActive: false, attempts: 0, closes: 0, withdrawals: 0 });
export function createCataclysmPriestLifeState(): CataclysmPriestLifeState {
  return { cases: { 'sea-eddy': freshCase(), 'wind-screen': freshCase(), 'lightning-stone': freshCase() }, siteId: 'CP4-PRACTICE-BAY', waterSource: 'SEAWATER', playerLocation: 'OUTSIDE',
    ally: { id: 'CP4-SYLVA', name: '西尔瓦·霍尔特', age: 38, alive: true, willing: true, location: 'LOW', moves: 0, returns: 0 },
    float: { id: 'CP4-FLOAT', owner: 'CP4-SYLVA', empty: true, location: 'BANK', moves: 0, returns: 0 },
    rope: { id: 'CP4-ROPE', owner: 'CP4-SYLVA', present: true, durability: 100 },
    tarp: { id: 'CP4-TARP', owner: 'CP4-SYLVA', present: true, deployed: false, wetness: 0 },
    tray: { id: 'CP4-TRAY', present: true, capturedUnits: 0, wetness: 0 },
    stone: { id: 'CP4-STONE', present: true, naturalMark: true, scorchMarks: 0, ordinaryInspections: 0 }, reflected: false };
}
export const hasCataclysmPriestLifeLock = (s: SliceState): boolean => s.cataclysmPriest.life.playerLocation !== 'OUTSIDE' || s.cataclysmPriest.life.ally.location !== 'LOW' || s.cataclysmPriest.life.float.location !== 'BANK' || Object.values(s.cataclysmPriest.life.cases).some(r => r.contactOpen || r.effectActive);
export const cataclysmPriestInside = hasCataclysmPriestLifeLock;
export function validateCataclysmPriestActivityCommand(v: unknown): v is CataclysmPriestActivityCommand {
  if (!record(v)) return false;
  if (['MOVE_ALLY', 'RETURN_ALLY', 'RETURN_FLOAT', 'REFLECT'].includes(String(v.type))) return shape(v, ['type']);
  if (!CATACLYSM_PRIEST_CASE_IDS.includes(v.caseId as CataclysmPriestCaseId)) return false;
  if (v.type === 'PREPARE') return shape(v, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(String(v.method));
  return ['OBSERVE', 'PERFORM', 'STOP_EFFECT', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(String(v.type)) && shape(v, ['type', 'caseId']);
}
export const isCataclysmPriestActivityCommand = validateCataclysmPriestActivityCommand;
export const isCataclysmPriestActivity = validateCataclysmPriestActivityCommand;
export function blockCataclysmPriestLife(s: SliceState, c: CataclysmPriestActivityCommand): string | null {
  if([3,2].includes(s.progression.sequence??0))return '旧灾难主祭实践已只读，原海岸与原人物后果保留。';
  if (!validateCataclysmPriestActivityCommand(c)) return '灾难主祭实践命令无效。';
  if (s.status !== 'ACTIVE' || !promoted(s)) return '须仍活着并已实际完成灾难主祭晋升。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '须实际到贝克兰德原实践湾。';
  if (s.cataclysmPriest.ritual.playerLocation === 'PLATFORM' || ['READY', 'FIGHTING'].includes(s.cataclysmPriest.encounter.status)) return '先沿原路实际离开仪式平台或原遭遇。';
  const l = s.cataclysmPriest.life, r = 'caseId' in c ? l.cases[c.caseId] : null;
  const active = Object.values(l.cases).some(x => x.effectActive);
  if (c.type === 'STOP_EFFECT') return r?.contactOpen && r.effectActive ? null : '没有本项仍待停止的有限作用或原器具操作。';
  if (c.type === 'RETURN_FLOAT') return active ? '先停止本次风、水或原绞盘操作。' : l.float.location !== 'MARK' ? '同一原空浮具已在BANK，没有可伪造的返回。' : !l.rope.present || l.rope.durability <= 0 ? '须有仍可实际操作的同一原绳，不能远程召回或免费补绳。' : null;
  if (c.type === 'RETURN_ALLY') return active ? '先停止实际作用，不能让同行者走入仍在作用的低处。' : l.ally.location !== 'RIDGE' ? '西尔瓦已在原LOW处。' : !l.ally.alive || !l.ally.willing ? '须由原西尔瓦当前活着且自愿沿原干燥高路真实走回。' : null;
  if (c.type === 'CLOSE') return !r?.contactOpen ? '没有本项尚未结束的原现场。' : r.effectActive ? '先0行动STOP_EFFECT明确停止本次有限作用。' : l.float.location !== 'BANK' ? '先用同一原绳实际拉回原浮具。' : l.ally.location !== 'LOW' ? '先请求当前自愿的西尔瓦沿原路实际返回。' : null;
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '只可取消尚未实施的准备；已付成本不退款。';
  if (c.type === 'MOVE_ALLY') return !Object.values(l.cases).some(x => x.status === 'PREPARED') ? '先观察并准备本项原现场。' : l.ally.location !== 'LOW' ? '西尔瓦已实际在RIDGE。' : !l.ally.alive || !l.ally.willing ? '原成年人须当前活着、自愿，不能强制其移动。' : active || Object.values(l.cases).some(x => x.contactOpen) ? '先实际结束上一段接触。' : null;
  const performingAtRidge = c.type === 'PERFORM' && r?.status === 'PREPARED' && l.ally.location === 'RIDGE' && !active && !Object.values(l.cases).some(x => x.contactOpen);
  if (hasCataclysmPriestLifeLock(s) && !performingAtRidge) return '先实际停止作用、拉回原浮具、请同行者真实返回，再结束现场。';
  if (s.oceanSinger.ritual.location !== 'DOCK' || s.oceanSinger.practice.songOpen || s.oceanSinger.practice.allyAffected || s.oceanSinger.practice.allyPosition !== 'NEAR' || Object.values(s.oceanSinger.cases).some(x => x.contactOpen || x.status === 'PREPARED')) return '旧海洋歌者原接触、同伴和仪式返程尚未收束。';
  if (Object.entries(l.cases).some(([id, v]) => v.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先实施或取消另一项准备。';
  if (s.health <= 0 || s.mind <= 0) return '先恢复身体与精神；实际收束动作仍可0行动执行。';
  if (c.type === 'REFLECT') return l.reflected ? '已经完成三案反思。' : CATACLYSM_PRIEST_CASE_IDS.some(id => l.cases[id].status !== 'RESOLVED') ? '先完成三项真实报告。' : null;
  if (s.actionsRemaining < 1) return '本次需要1行动。';
  if (!r || !('caseId' in c)) return '未知原实践。';
  if (r.status === 'RESOLVED') return '本案已报告，不重置原物或重复成长。';
  const i = CATACLYSM_PRIEST_CASE_IDS.indexOf(c.caseId), p = CASES[i]!;
  if (i > 0 && l.cases[CATACLYSM_PRIEST_CASE_IDS[i - 1]!].status !== 'RESOLVED') return '先完成前一项原现场报告。';
  if (c.type === 'OBSERVE') return r.status !== 'AVAILABLE' ? '原观察已保留。' : !l.ally.alive || !l.ally.willing || l.ally.location !== 'LOW' ? '须原西尔瓦当前在场、自愿且活着。' : null;
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先实际观察原现场。' : r.attemptWeek === s.week ? '本周成本保留，下一真实周再准备。' : null;
  if (c.type === 'REPORT') return r.status === 'EXAMINED' && r.result !== 'NONE' ? null : '须先成功实施、停止、归还和真实结束检查。';
  if (r.status !== 'PREPARED' || r.attemptWeek === s.week) return '先准备本次实践，同周不能反复实施。';
  if (!l.ally.alive || !l.ally.willing) return '原西尔瓦须当前活着且仍同意；不能沿用过去许可。';
  if (r.method === 'ABILITY' && l.ally.location !== 'RIDGE') return '先请求西尔瓦沿原干燥高路实际走到RIDGE；同伴没有能力免疫。';
  if (c.caseId !== 'lightning-stone' && l.waterSource !== 'SEAWATER') return '这里须有当前真实海水，不能无源造水或无水记录接水。';
  if (c.caseId === 'sea-eddy' && (!l.float.empty || l.float.location !== 'BANK' || !l.rope.present || l.rope.durability <= 10)) return '须是BANK同一原空浮具及可往返操作的原绳。';
  if (c.caseId === 'wind-screen' && (!l.tray.present || r.method === 'ORDINARY' && !l.tarp.present)) return '须有原接水盘，普通方法还须有同一原帆布。';
  if (c.caseId === 'lightning-stone' && !l.stone.present) return '同一原石靶须实际仍在空岸。';
  return r.method === 'ABILITY' && (!Number.isFinite(s.spirituality) || s.spirituality < p.spirit) ? `本次需要${p.spirit}灵性，失败照耗；可0行动取消。` : null;
}
export function applyCataclysmPriestActivity(s: SliceState, c: CataclysmPriestActivityCommand, ctx: SeerContext): void {
  const reason = blockCataclysmPriestLife(s, c); if (reason) throw new Error(reason);
  const l = s.cataclysmPriest.life;
  if (c.type === 'MOVE_ALLY' || c.type === 'RETURN_ALLY') { const move = c.type === 'MOVE_ALLY'; l.ally.location = move ? 'RIDGE' : 'LOW'; if (move) l.ally.moves++; else l.ally.returns++; ctx.note(move ? '原西尔瓦自愿走到高地' : '原西尔瓦自愿沿原路返回', '她当前活着且愿意，普通步行沿同一原干燥高路' + (move ? '离开低处到RIDGE。本次距离安排不代表友军普遍免疫。' : '从RIDGE回到LOW。不是位置标签瞬移，也不返还任何成本。')); return; }
  if (c.type === 'RETURN_FLOAT') { l.float.location = 'BANK'; l.float.returns++; ctx.note('用同一原绳拉回同一原浮具', '本人实际在岸边操作仍可用的CP4-ROPE，把四米标线处的同一空CP4-FLOAT沿原水道拉回BANK；耐久损耗与所有权保留，不造新绳、不瞬移。'); return; }
  if (c.type === 'STOP_EFFECT') { l.cases[c.caseId].effectActive = false; if (c.caseId === 'wind-screen') l.tarp.deployed = false; ctx.note('明确停止本次有限作用', '本人停止本次风、水、雷接触或普通原器具操作；原水恢复普通流动、原帆布收起。浮具仍在实际位置，接水、湿痕、焦痕和原绳损耗保留，同行者尚未自动返回。'); return; }
  if (c.type === 'CLOSE') { const r = l.cases[c.caseId]; r.contactOpen = false; r.closes++; r.status = r.result === 'NONE' ? 'OBSERVED' : 'EXAMINED'; l.playerLocation = 'OUTSIDE'; ctx.note('实际检查并结束原现场', r.result === 'NONE' ? '本次未取得合格结果，原成本保留；沿原干燥路离开，下一真实周才能再试。' : '你本人检查同一原物的实际结果，原浮具已回BANK、同行者已自愿返回；沿原干燥路离开。湿痕、焦痕与耐久损耗不因结束消失，尚须报告。'); return; }
  if (c.type === 'WITHDRAW') { const r = l.cases[c.caseId]; r.status = 'OBSERVED'; r.method = null; r.withdrawals++; ctx.note('取消尚未实施的原准备', '观察与准备行动不退款，没有制造能力效果；若同行者已在高地，仍须请求她沿原路真实返回。'); return; }
  if (c.type === 'REFLECT') { l.reflected = true; s.progression.acting = Math.min(100, s.progression.acting + 25); s.seer.completedSources.push('cataclysm-priest-reflection'); ctx.note('有限作用与留下的原后果', '三项真实报告已完成，G扮演+25。风、水与雷会影响同伴和环境，必须有实际来源、成本和收束；不获得海王远程海域控制或天灾位阶。'); return; }
  s.actionsRemaining--;
  const p = CASES.find(x => x.id === c.caseId)!, r = l.cases[c.caseId];
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; r.observedWeek = s.week; ctx.note(p.title, p.story + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = c.method; ctx.note(p.title, c.method === 'ABILITY' ? `准备有限能力：${p.spirit}灵性、意志${p.difficulty}，须先请同行者真实到高地。` : '准备实际原器具与原物的普通方法，知识14、0灵性；没有能力掌握。'); return; }
  if (c.type === 'REPORT') { r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); const source = `cataclysm-priest-case:${p.id}`; if (r.result === 'ABILITY') awardSeerMastery(s, source, 8, ctx); else s.seer.completedSources.push(source); ctx.note(p.title, '报告实际来源、实付成本、同一原物变化及真实收束，G扮演+25；' + (r.result === 'ABILITY' ? '实际能力报告单项掌握+8。' : '普通报告不增加能力掌握。')); return; }
  r.status = 'ACTIVE'; r.contactOpen = true; r.attemptWeek = s.week; r.attempts++; l.playerLocation = 'SHORE';
  const ability = r.method === 'ABILITY'; if (ability) s.spirituality -= p.spirit;
  const check = ctx.check(ability ? 'will' : 'knowledge', ability ? p.difficulty : 14), success = ['SUCCESS', 'GREAT_SUCCESS'].includes(check.tier);
  if (success) { r.result = r.method!; r.effectActive = true;
    if (p.id === 'sea-eddy') { l.float.location = 'MARK'; l.float.moves++; l.rope.durability -= 10; }
    else if (p.id === 'wind-screen') { l.tray.capturedUnits++; l.tray.wetness++; if (!ability) { l.tarp.deployed = true; l.tarp.wetness++; } }
    else if (ability) l.stone.scorchMarks++; else l.stone.ordinaryInspections++;
    if (ability) awardSeerMastery(s, `cataclysm-priest-practice:${p.id}`, 5, ctx);
  }
  ctx.note(p.title, success ? (ability ? `已实际支付${p.spirit}灵性，有限能力成功。` : '实际原器具普通核对成功，0灵性、无能力掌握。') + (p.id === 'sea-eddy' ? '同一原空浮具由BANK移动四米到MARK，同一原绳耐久实际−10；先停转，再真实拉回。' : p.id === 'wind-screen' ? '同一股真实水雾进原接水盘，接水量与湿痕各+1G，水没有消失；须停止本次风或收起原帆布。' : ability ? '一道有限雷击在同一原石留下真实焦痕；须停止接触，实际检查并结束。' : '只检查到原石既有自然风暴痕，没有新增雷击焦痕；须结束原检查接触。') : `本次失败，1行动${ability ? `和${p.spirit}灵性` : ''}照耗，未移动浮具、接到新水或留下新焦痕；同行者仍在实际位置，须真实返回再结束，下一真实周再试。`);
}
export function cataclysmPriestLifeActions(s: SliceState): CataclysmPriestLifeAction[] {
  if (!promoted(s)) return [];
  const out: CataclysmPriestLifeAction[] = [], add = (command: CataclysmPriestActivityCommand, label: string, cost: string) => { const reason = blockCataclysmPriestLife(s, command); out.push({ id: `cataclysm-priest-${command.type}${'caseId' in command ? `-${command.caseId}${'method' in command ? `-${command.method}` : ''}` : ''}`, label, cost, command, enabled: reason === null, reason }); };
  for (const p of CASES) { add({ type: 'OBSERVE', caseId: p.id }, `观察：${p.title}`, '1行动'); add({ type: 'PREPARE', caseId: p.id, method: 'ABILITY' }, `准备能力：${p.title}`, '1行动'); add({ type: 'PREPARE', caseId: p.id, method: 'ORDINARY' }, `准备普通方法：${p.title}`, '1行动'); add({ type: 'PERFORM', caseId: p.id }, `实际实施：${p.title}`, s.cataclysmPriest.life.cases[p.id].method === 'ABILITY' ? `1行动 · ${p.spirit}灵性 · 意志${p.difficulty}` : '1行动 · 普通知识14'); for (const [type, label] of [['STOP_EFFECT', '停止有限作用'], ['CLOSE', '检查原物并结束'], ['WITHDRAW', '取消未实施准备']] as const) add({ type, caseId: p.id }, `${label}：${p.title}`, '0行动'); add({ type: 'REPORT', caseId: p.id }, `报告：${p.title}`, '1行动 · 扮演25'); }
  add({ type: 'MOVE_ALLY' }, '请西尔瓦自愿走到原高地', '0行动 · 真实普通步行'); add({ type: 'RETURN_ALLY' }, '请西尔瓦自愿沿原路返回', '0行动 · 真实普通步行'); add({ type: 'RETURN_FLOAT' }, '用同一原绳实际拉回原空浮具', '0行动'); add({ type: 'REFLECT' }, '反思三个有限原现场', '0行动 · 扮演25'); return out;
}
export function projectCataclysmPriestLife(s: SliceState): CataclysmPriestLifeProjection {
  const l = s.cataclysmPriest.life;
  return { title: '原实践湾：风、水、雷与实际收束', story: CATACLYSM_PRIEST_LIFE_STORY, cases: CASES.map(p => { const r = l.cases[p.id]; return { id: p.id, title: p.title, story: p.story, status: r.status, method: r.method, result: r.result === 'NONE' ? null : r.result === 'ABILITY' ? '实际有限能力成功，成本与原后果保留' : '实际原器具普通核对成功，无魔法掌握', contactOpen: r.contactOpen, effectActive: r.effectActive, observations: r.observedWeek === null ? [] : [...p.facts], observedWeek: r.observedWeek, attemptWeek: r.attemptWeek }; }),
    objects: [`${l.siteId} · 当前水源${l.waterSource} · 本人${l.playerLocation} · 原干燥高路开放`, `${l.float.id} · 西尔瓦所有原空浮具 · ${l.float.location} · 实际移出${l.float.moves}次/拉回${l.float.returns}次`, `${l.rope.id} · 西尔瓦所有 · ${l.rope.present ? '原处可用' : '原处缺失'} · 耐久${l.rope.durability}`, `${l.tarp.id} · ${l.tarp.present ? '原物在场' : '缺失'} · ${l.tarp.deployed ? '仍展开' : '已收起'} · 保留湿痕${l.tarp.wetness}`, `${l.tray.id} · 实际接水${l.tray.capturedUnits}G份 · 保留湿痕${l.tray.wetness}`, `${l.stone.id} · 原自然痕仍在 · 新雷击焦痕${l.stone.scorchMarks} · 普通检查${l.stone.ordinaryInspections}次`], ally: { ...l.ally }, reflected: l.reflected, inside: hasCataclysmPriestLifeLock(s), actions: cataclysmPriestLifeActions(s) };
}
export function validateCataclysmPriestLife(s: SliceState): boolean {
  const l = s.cataclysmPriest?.life, base = createCataclysmPriestLifeState(), promotion = s.cataclysmPriest?.promotionWeek;
  if (!record(l) || !shape(l, Object.keys(base)) || !record(l.cases) || !shape(l.cases, CATACLYSM_PRIEST_CASE_IDS) || !Array.isArray(s.seer.completedSources)) return false;
  for (const k of ['ally', 'float', 'rope', 'tarp', 'tray', 'stone'] as const) if (!record(l[k]) || !shape(l[k], Object.keys(base[k]))) return false;
  if (promotion === null) return stableStringify(l) === stableStringify(base);
  if (!integer(promotion, 1, s.week) || !promoted(s) || l.siteId !== base.siteId || !['SEAWATER', 'NONE'].includes(l.waterSource) || !['OUTSIDE', 'SHORE'].includes(l.playerLocation)) return false;
  const a = l.ally, f = l.float;
  if (a.id !== base.ally.id || a.name !== base.ally.name || a.age !== 38 || typeof a.alive !== 'boolean' || typeof a.willing !== 'boolean' || !['LOW', 'RIDGE'].includes(a.location) || !integer(a.moves) || !integer(a.returns) || a.moves - a.returns !== (a.location === 'RIDGE' ? 1 : 0)) return false;
  if (f.id !== base.float.id || f.owner !== 'CP4-SYLVA' || f.empty !== true || !['BANK', 'MARK'].includes(f.location) || !integer(f.moves, 0, 1) || !integer(f.returns, 0, 1) || f.moves - f.returns !== (f.location === 'MARK' ? 1 : 0)) return false;
  if (l.rope.id !== base.rope.id || l.rope.owner !== 'CP4-SYLVA' || typeof l.rope.present !== 'boolean' || l.rope.durability !== 100 - 10 * f.moves || l.tarp.id !== base.tarp.id || l.tarp.owner !== 'CP4-SYLVA' || typeof l.tarp.present !== 'boolean' || typeof l.tarp.deployed !== 'boolean' || !integer(l.tarp.wetness, 0, 1) || l.tray.id !== base.tray.id || typeof l.tray.present !== 'boolean' || !integer(l.tray.capturedUnits, 0, 1) || l.tray.wetness !== l.tray.capturedUnits || l.stone.id !== base.stone.id || typeof l.stone.present !== 'boolean' || l.stone.naturalMark !== true || !integer(l.stone.scorchMarks, 0, 1) || !integer(l.stone.ordinaryInspections, 0, 1)) return false;
  let open = 0, prepared = 0, resolved = 0;
  for (const [i, id] of CATACLYSM_PRIEST_CASE_IDS.entries()) { const r = l.cases[id];
    if (!record(r) || !shape(r, Object.keys(freshCase())) || !['AVAILABLE', 'OBSERVED', 'PREPARED', 'ACTIVE', 'EXAMINED', 'RESOLVED'].includes(r.status) || !['NONE', 'ABILITY', 'ORDINARY'].includes(r.result) || r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || typeof r.contactOpen !== 'boolean' || typeof r.effectActive !== 'boolean' || !integer(r.attempts, 0, s.week - promotion + 1) || !integer(r.closes, 0, r.attempts) || !integer(r.withdrawals)) return false;
    if (r.status === 'AVAILABLE') { if (stableStringify(r) !== stableStringify(freshCase())) return false; }
    else if (!integer(r.observedWeek, promotion, s.week) || i > 0 && l.cases[CATACLYSM_PRIEST_CASE_IDS[i - 1]!].status !== 'RESOLVED') return false;
    if (r.attemptWeek !== null && (!integer(r.attemptWeek, r.observedWeek ?? promotion, s.week) || r.attempts === 0) || (r.attemptWeek === null) !== (r.attempts === 0)) return false;
    if (r.result !== 'NONE' && (r.result !== r.method || r.attemptWeek === null) || r.closes !== r.attempts - (r.contactOpen ? 1 : 0)) return false;
    if ((r.status === 'ACTIVE') !== r.contactOpen || r.effectActive && (!r.contactOpen || r.result === 'NONE')) return false;
    if (r.contactOpen) { open++; if (r.attemptWeek !== s.week || r.method === null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND' || s.combat || s.activeEvent || l.playerLocation !== 'SHORE') return false; }
    if (r.status === 'PREPARED') { prepared++; if (r.method === null || r.result !== 'NONE' || r.attemptWeek === s.week) return false; }
    if (r.status === 'OBSERVED' && r.result !== 'NONE' || ['EXAMINED', 'RESOLVED'].includes(r.status) && (r.result === 'NONE' || r.closes === 0 || r.contactOpen)) return false;
    if (r.effectActive && r.method === 'ABILITY' && (!a.alive || a.location !== 'RIDGE')) return false;
    if (r.status === 'RESOLVED') resolved++;
    if (s.seer.completedSources.filter(x => x === `cataclysm-priest-case:${id}`).length !== (r.status === 'RESOLVED' ? 1 : 0) || s.seer.completedSources.filter(x => x === `cataclysm-priest-practice:${id}`).length !== (r.result === 'ABILITY' ? 1 : 0)) return false;
  }
  const sea = l.cases['sea-eddy'], wind = l.cases['wind-screen'], lightning = l.cases['lightning-stone'];
  if (open > 1 || prepared > 1 || open && prepared || (l.playerLocation === 'SHORE') !== (open === 1) || a.location === 'RIDGE' && !open && !prepared && !Object.values(l.cases).some(r => r.withdrawals > 0 && r.status === 'OBSERVED')) return false;
  if (f.moves !== (sea.result !== 'NONE' ? 1 : 0) || f.location === 'MARK' && (!sea.contactOpen || !l.rope.present || l.rope.durability <= 0)) return false;
  if (l.tray.capturedUnits !== (wind.result !== 'NONE' ? 1 : 0) || l.tarp.wetness !== (wind.result === 'ORDINARY' ? 1 : 0) || l.tarp.deployed !== (wind.result === 'ORDINARY' && wind.effectActive)) return false;
  if (l.stone.scorchMarks !== (lightning.result === 'ABILITY' ? 1 : 0) || l.stone.ordinaryInspections !== (lightning.result === 'ORDINARY' ? 1 : 0)) return false;
  return typeof l.reflected === 'boolean' && (!l.reflected || resolved === 3) && s.seer.completedSources.filter(x => x === 'cataclysm-priest-reflection').length === (l.reflected ? 1 : 0) && ((s.progression.sequence===3||s.progression.sequence===2)?s.seaKing.cataclysmPriestActingAtPromotion:s.progression.acting) === resolved * 25 + (l.reflected ? 25 : 0);
}
