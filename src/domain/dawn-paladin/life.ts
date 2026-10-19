import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applyWarriorActivity } from '../warrior/life.js';
import { applyDawnPaladinEncounter, blockDawnPaladinEncounter, DAWN_PALADIN_ENCOUNTER_STORY } from './encounter.js';
import { DAWN_PALADIN_CASE_IDS, type DawnPaladinCommand, type DawnPaladinActivityCommand, type DawnPaladinAction, type DawnPaladinProjection } from './types.js';

const CASES = [
  {
    id: 'marked-exit', title: '原练习出口的淡薄幻象', spirit: 3,
    story: '成年序列7志愿者瑟恩·维克在奥斯温原训练场自愿演示一次低强度幻象。你先亲眼核对原标记出口，再看见他从本人20灵性中实付2灵性，在原可移动屏前制造覆盖该已知出口视线的淡薄幻象。它只有这一个来源，不是突然出现的神秘陷阱。（原创G）',
    facts: ['原标记出口真实存在且已先核实位置，原通路无旁人和障碍。', '成年瑟恩·维克自愿且亲自施术一次，灵性20→18；失败与退出不回填或复制他的施术。', '晨曦尝试驱散这一已存在低强度幻象，3灵性、知识14；不推定所有幻术免疫。', '普通方法移动获准的原屏，沿事先核对的原标记出口实际走过；0灵性、知识10。'],
    ability: '准备仅以晨曦处理眼前有明确来源的原低强度幻象；实施1行动、3灵性、知识14，出口本身不移动。',
    ordinary: '准备经本人获准移动原普通屏，沿事先核实的原标记出口走过；实施1行动、知识10、0灵性，不把绕开遮挡冒充超凡驱散。',
    abilityResult: '晨曦实际驱散了瑟恩·维克唯一已施放的原低强度幻象，已知原出口重新清晰可见。原屏未移动，施术者已付2灵性仍保留；这不是永久免疫或对普通人的神圣伤害。',
    ordinaryResult: '你实际移开获准的原普通屏并沿已核对的原标记出口走过。幻象随原屏离开出口视线，未声称被晨曦驱散；已付施术成本、原屏新位置及原出口记录保留。',
    abilityOutcome: 'ILLUSION_DISPELLED', ordinaryOutcome: 'MARKED_EXIT_USED',
    close: '你实际收束晨曦或结束普通查看，经已知原出口离开这处局部练习；原幻象是否已驱散、原屏位置和瑟恩已付2灵性均保留，不重造幻象。',
  },
  {
    id: 'armor-test', title: '本人光甲与原软垫摆锤', spirit: 3,
    story: '原训练场有一套奥斯温所有的轻量软垫摆锤和机械止动。你自愿在本人身体范围内接受有限轻触试压；原导师负责止动，现场没有别人承担攻击。可以实际凝甲测试并记录裂纹，也可以只沿原机械止动步骤停住装置。（原创G）',
    facts: ['本人自愿、限定轻量软垫与原机械止动，不借旁人受伤证明能力。', '能力实施3灵性、意志14；光甲形成后才受一次有限试压，真实裂纹保留为历史。', '光甲可破损且恢复慢，不因为有甲而回血、免疫或减少已经结算的真实伤势。', '普通方法检查并实际使用原机械止动，知识10、0灵性，不声称凝甲。'],
    ability: '准备本人自愿接受原软垫摆锤有限试压，导师握住原止动；实施1行动、3灵性、意志14，记录光甲实际裂纹，0健康奖励。',
    ordinary: '准备核对原摆锤与机械止动并实际停住它；实施1行动、知识10、0灵性，不生成光甲。',
    abilityResult: '你实际凝成晨曦铠甲，承受约定的原软垫轻量试压，导师随即制停。光甲出现实际裂纹，防护的有限效果被记录；没有补满健康、抹除伤势或获得永久免疫。',
    ordinaryResult: '你按核对的原机械止动步骤，实际停住原软垫摆锤并完成检查。装置仍属原导师，未生成光甲，没有生命恢复或防护奖励。',
    abilityOutcome: 'ARMOR_TESTED', ordinaryOutcome: 'PROBE_STOPPED',
    close: '你实际解除本次仍在本人身上的临时光甲或结束普通检查，并从原出口离开。此前实际试压和裂纹记录保留，不用结束接触冒充光甲修复或伤势治疗。',
  },
  {
    id: 'cleared-storm', title: '净空原院中的唯一纸靶', spirit: 10,
    story: '奥斯温的原12米练习院内只有一张原纸靶与原框，四周界限和普通出口清楚，没有其他人。准备时导师实际经已知原出口走到院外，确认无人进入；你可以亲自凝剑、凝甲后释放有限光之风暴，也可直接拆下原纸靶。（原创G）',
    facts: ['原12米练习院、原纸靶、原框和已知原出口在观察中实际核对，不临时创造战斗目标。', 'PREPARE中导师实际退出院外，只有本人留在练习院；原净空与退出历史保留。', '能力实施总10灵性：真实凝剑3、真实凝甲3、有限风暴4，同1行动、知识14；不是免费持剑施术。', '风暴会消散本次光剑、使本次光甲留裂纹；成功毁掉唯一原纸靶并留下焦黑原框，不能反复复制靶物。', '普通路线实际拆下原纸靶，知识10、0灵性，无风暴或虚构焦痕。'],
    ability: '先确认导师实际从原出口走到院外，原12米院内再无他人。准备实施1行动、总10灵性（凝剑3＋凝甲3＋风暴4）、知识14；成功毁原纸靶留焦框，失败照耗，光剑消散、光甲裂纹均保留。',
    ordinary: '先让导师实际经已知原出口到院外，再准备本人拆下唯一原纸靶；实施1行动、知识10、0灵性。原框不凭空焦黑。',
    abilityResult: '你先实付3灵性凝成光剑，再付3灵性凝成光甲，最后付4灵性释放本次有限风暴。唯一原纸靶实际毁掉，原框留下焦痕；自己的光剑已消散、光甲实际开裂。院外导师与其他人未进入原净空练习院，没有新武器或衣物进入库存。',
    ordinaryResult: '你本人实际拆下唯一原纸靶，原框仍留在院内，拆下的纸靶仍归导师。没有发动风暴、生成光剑或光甲，也没有虚构焦痕。',
    abilityOutcome: 'STORM_COMPLETED', ordinaryOutcome: 'TARGET_DISMANTLED',
    close: '你实际收束尚在的临时光甲，沿原普通出口走到院外并告知导师结束。导师随后自行返回原院；被毁或拆下的原纸靶、焦框、消散光剑与光甲裂纹历史均不回滚，原靶不会补充。',
  },
] as const;

export const DAWN_PALADIN_ENVIRONMENT = '三个有限原现场与数值均为原创G：观察1行动，准备1行动，实施1行动。晨曦3灵性、知识14；光甲3灵性、意志14；净空风暴总10灵性（先实凝剑3＋凝甲3＋风暴4）、知识14。普通方法知识10、0灵性。每次实施无论成败都须0行动明确收束本次作用并实际离开；不返费、不治疗，不回滚幻象来源、原屏位置、裂纹或原靶结果。失败照耗，下一真实周重试；每案报告1行动、25扮演与单项掌握8，三案反思1行动、25扮演，可全程普通方法和平100。 ' + DAWN_PALADIN_ENCOUNTER_STORY;
export const dawnPaladinInside = (s: SliceState) => Object.values(s.dawnPaladin.cases).some(r => r.contactOpen);
export const isDawnPaladinActivity = (c: DawnPaladinCommand): c is DawnPaladinActivityCommand => ['OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'REFLECT', 'RETURN_TOOL', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
function validActivity(c: unknown): c is DawnPaladinActivityCommand {
  if (!record(c)) return false;
  if (['REFLECT', 'RETURN_TOOL', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type as string)) return shape(c, ['type']);
  if (!DAWN_PALADIN_CASE_IDS.includes(c.caseId as typeof DAWN_PALADIN_CASE_IDS[number])) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  return ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string) && shape(c, ['type', 'caseId']);
}
const handsOccupied = (s: SliceState) => s.town.clubLocation === 'HAND' || s.warrior.practiceClub.custodian === 'PLAYER' && s.warrior.practiceClub.location === 'player:hand';
function blocked(s: SliceState, c: DawnPaladinActivityCommand): string | null {
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockDawnPaladinEncounter(s, c);
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.progression.pathwayId !== 'warrior' || s.progression.sequence !== 6) return '先完成黎明骑士晋升。';
  const p = 'caseId' in c ? CASES.find(p => p.id === c.caseId) : null;
  const r = p ? s.dawnPaladin.cases[p.id] : null;
  if (c.type === 'CLOSE') {
    if (!r?.contactOpen) return '没有尚未结束的本次接触。';
    return s.activeEvent || s.combat || s.world.city !== 'BACKLUND' ? '本次原现场位置不符，不能以结束接触瞬移。' : null;
  }
  if (dawnPaladinInside(s)) return '先0行动实际收束本次作用并离开；原来源、裂纹与原靶结果保留。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要回到贝克兰德原训练场。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚待取消的准备。';
  if (Object.entries(s.dawnPaladin.cases).some(([id, value]) => value.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先完成或取消另一项尚未实施的准备。';
  if (s.health <= 0 || s.mind <= 0) return '先休养恢复身体与精神。';
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'RETURN_TOOL') return s.warrior.practiceClub.custodian === 'PLAYER' ? null : '没有实际借在手中的原训练棍。';
  if (c.type === 'REFLECT') return s.dawnPaladin.reflected ? '已经回看这段经历。' : CASES.some(p => s.dawnPaladin.cases[p.id]?.status !== 'RESOLVED') ? '先完成三项有限报告。' : null;
  if (!p || !r) return '未知原事项。';
  if (r.status === 'RESOLVED') return '这项报告已经完成。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '原现场观察已经保留。';
  if (c.type === 'PREPARE') {
    if (r.status !== 'OBSERVED') return '先实际观察本项原现场。';
    if (p.id === 'cleared-storm' && c.method === 'ABILITY' && handsOccupied(s)) return '双手光剑需要空出双手：先收好自己的短棍或实际归还奥斯温的原借棍，不自动移动原物。';
    return r.attemptWeek === s.week ? '本周实施结果保留，下一真实周再依原观察准备。' : null;
  }
  if (c.type === 'REPORT') return r.status === 'EXAMINED' ? null : '先取得有限结果并实际结束接触离开。';
  if (r.status !== 'PREPARED') return '先选择本次方法。';
  if (p.id === 'cleared-storm' && r.method === 'ABILITY' && handsOccupied(s)) return '先取消准备，再收好自己的短棍或归还原借棍，空出双手。';
  if (r.method === 'ABILITY' && s.spirituality < p.spirit) return `本次能力实施需要${p.spirit}灵性${p.id === 'cleared-storm' ? '（凝剑3＋凝甲3＋风暴4）' : ''}，可取消准备后选择普通方法。`;
  if (p.id === 'cleared-storm' && (!s.dawnPaladin.practice.instructorOutside || !s.dawnPaladin.practice.stormCleared || s.dawnPaladin.practice.stormTarget !== 'INTACT')) return '导师须已实际退出且原练习院净空，唯一原纸靶仍完好才能实施。';
  return null;
}
export function applyDawnPaladinActivity(s: SliceState, c: DawnPaladinActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validActivity(c)) throw new Error('黎明骑士实践命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyDawnPaladinEncounter(s, c, ctx); return; }
  if (c.type === 'RETURN_TOOL') { applyWarriorActivity(s, c, ctx, award); return; }
  const m = s.dawnPaladin, facts = m.practice;
  if (c.type === 'CLOSE') {
    const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[p.id]!;
    r.contactOpen = false; r.closes += 1;
    facts.swordActive = false; facts.armorActive = false;
    if (p.id === 'cleared-storm') facts.instructorOutside = false;
    ctx.note('实际收束本次作用并离开', '0行动。' + p.close + '本次成功或失败与已付行动、灵性均保留，不返资源、不治疗、不增加掌握或扮演。'); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    if (c.caseId === 'cleared-storm') facts.instructorOutside = false;
    ctx.note('取消尚未实施的准备', '0行动取消本次准备并实际离开，导师自行返回，原观察、净空历史与已付行动保留；尚未凝剑、凝甲或发动风暴，原来源和物件保持当时状态。可以重新选择普通方法。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('dawn-paladin-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('看清原路，承认防护的边界', '回看已知原出口、本人光甲的有限试压与净空原靶。G扮演+25；普通方法同样可以完成三项实践。能照亮不是永久免疫，能防护不是不受伤，强大风暴也会破坏自己的光甲。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[p.id]!;
  if (c.type === 'OBSERVE') {
    r.status = 'OBSERVED';
    if (p.id === 'marked-exit') { facts.illusionCreated = true; facts.volunteerSpirituality -= 2; }
    ctx.note(p.title, p.story + ' ' + p.facts.join(' ') + '实际观察后离开，尚未施加本人的能力，没有待结束接触。'); return;
  }
  if (c.type === 'PREPARE') {
    r.status = 'PREPARED'; r.method = c.method;
    if (p.id === 'cleared-storm') { facts.stormCleared = true; facts.instructorOutside = true; }
    ctx.note(p.title, c.method === 'ABILITY' ? p.ability : p.ordinary); return;
  }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); award(`dawn-paladin-case:${p.id}`, 8);
    ctx.note(p.title, (r.method === 'ABILITY' ? p.abilityResult : p.ordinaryResult) + '本次后续已实际收束作用并离开，报告G扮演+25、原规则单项掌握+8。'); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (r.method === 'ABILITY') {
    s.spirituality -= p.spirit;
    if (p.id === 'armor-test') { facts.armorProbePerformed = true; facts.armorCracked = true; facts.armorActive = true; }
    if (p.id === 'cleared-storm') {
      // The three actual casts share one paid action. Their original G costs are separately disclosed.
      facts.swordActive = true; facts.armorActive = true;
      facts.swordActive = false; facts.stormSwordDispersed = true; facts.stormArmorCracked = true;
    }
  }
  const result = ctx.check(r.method === 'ABILITY' && p.id === 'armor-test' ? 'will' : 'knowledge', r.method === 'ABILITY' ? 14 : 10);
  if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
    r.status = 'EXAMINED'; r.outcome = r.method === 'ABILITY' ? p.abilityOutcome : p.ordinaryOutcome;
    if (p.id === 'marked-exit') { if (r.method === 'ABILITY') facts.illusionDispelled = true; else facts.screenRemoved = true; }
    if (p.id === 'cleared-storm') { facts.stormTarget = r.method === 'ABILITY' ? 'DESTROYED' : 'DISMANTLED'; facts.stormFrameScorched = r.method === 'ABILITY'; }
    ctx.note(p.title, (r.method === 'ABILITY' ? p.abilityResult : p.ordinaryResult) + '本次接触尚须0行动实际收束作用并离开，之后才能报告。'); return;
  }
  r.status = 'OBSERVED'; r.outcome = 'NONE';
  const consequences = p.id === 'marked-exit' ? '原幻象仍在，未驱散或移屏；瑟恩已付2灵性不回填。'
    : p.id === 'armor-test' ? r.method === 'ABILITY' ? '本次光甲已形成并留裂纹，导师以原止动结束轻量试压，未取得可报告的防护复核结果；没有治疗或额外身体伤害。' : '未完成普通机械止动步骤，导师安全制停原软垫摆锤，未生成光甲。'
      : r.method === 'ABILITY' ? '本次真实凝剑3、凝甲3、风暴4均已付，风暴未命中原纸靶，靶与原框仍完好；自己的光剑已消散、光甲仍在且开裂，导师仍在院外。' : '未完成拆靶，唯一原纸靶与原框仍完好，导师仍在院外。';
  ctx.note(p.title, `本次实施未取得可报告结果，原观察保留。1行动${r.method === 'ABILITY' ? `与${p.spirit}灵性` : ''}已经实际消耗，不增加掌握或扮演；${consequences}先0行动实际收束作用并离开，下一真实周再准备。`);
}
export function dawnPaladinActions(s: SliceState): DawnPaladinAction[] {
  if (s.progression.pathwayId !== 'warrior' || (s.progression.sequence !== 6 && s.progression.sequence !== 5 && (s.progression.sequence!==4&&s.progression.sequence!==3))) return [];
  const out: DawnPaladinAction[] = [];
  const add = (id: string, label: string, cost: string, command: DawnPaladinActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  for (const p of CASES) {
    const r = s.dawnPaladin.cases[p.id]!;
    if (r.contactOpen) add(p.id + '-close', '实际收束本次作用并离开', '0行动 · 原来源、裂纹与原靶结果保留', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(p.id + '-observe', '实际观察本项原现场', '1行动 · 核实对象与原物来源', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      add(p.id + '-ability', p.id === 'marked-exit' ? '准备晨曦驱散原幻象' : p.id === 'armor-test' ? '准备本人凝甲接受有限试压' : '准备净空原院、实际凝剑凝甲与风暴', `1行动 · 实施另${p.spirit}灵性${p.id === 'cleared-storm' ? '（凝剑3＋凝甲3＋风暴4）' : ''}`, { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(p.id + '-ordinary', '准备原现场普通方法', '1行动 · 实施不耗灵性', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(p.id + '-perform', r.method === 'ABILITY' ? '实际实施本项有限能力' : '实际使用原现场普通方法', r.method === 'ABILITY' ? `1行动 · ${p.spirit}灵性${p.id === 'cleared-storm' ? '（凝剑3＋凝甲3＋风暴4）' : ''} · ${p.id === 'armor-test' ? '意志' : '知识'}14 · 失败照耗` : '1行动 · 知识10 · 0灵性', { type: 'PERFORM', caseId: p.id });
      add(p.id + '-withdraw', '取消尚未实施的准备', '0行动 · 已付成本不退', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(p.id + '-report', '报告本项有限结果与实际离开', '1行动 · 结束本次接触后', { type: 'REPORT', caseId: p.id });
  }
  if (s.warrior.practiceClub.custodian === 'PLAYER') add('dawn-paladin-return-tool', '沿原路把原训练短棍交还奥斯温', '1行动 · 原所有人不变 · 空出双手', { type: 'RETURN_TOOL' });
  if (!s.dawnPaladin.reflected) add('dawn-paladin-reflect', '回看已知原路、防护与风暴的边界', '1行动 · 三项报告后', { type: 'REFLECT' });
  if (s.dawnPaladin.encounter.status === 'AVAILABLE') {
    add('dawn-paladin-encounter-talk', '前往原训练场外空院并当面澄清', '1行动 · 对方仍可拒绝 · 无额外扮演', { type: 'ENCOUNTER_TALK' });
    add('dawn-paladin-encounter-fight', '前往原训练场外空院并承担冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function dawnPaladinCases(s: SliceState): DawnPaladinProjection['cases'] {
  if (s.progression.pathwayId !== 'warrior' || (s.progression.sequence !== 6 && s.progression.sequence !== 5 && (s.progression.sequence!==4&&s.progression.sequence!==3&&s.progression.sequence!==2))) return [];
  return CASES.map(p => {
    const r = s.dawnPaladin.cases[p.id]!;
    const result = ['EXAMINED', 'RESOLVED'].includes(r.status)
      ? (r.method === 'ABILITY' ? p.abilityResult : p.ordinaryResult) + (r.contactOpen ? ' 尚须明确收束本次作用并离开。' : ' 随后' + p.close)
      : r.attemptWeek !== null ? '此前实施未成，已付成本、原观察与实际造物损耗记录保留。' : r.withdrawals ? '尚未实施的准备已取消，原观察保留。' : null;
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result, status: r.status, contactOpen: r.contactOpen ? '本次作用仍须明确收束并实际离开' : '没有尚未结束的本次接触', closes: r.closes };
  });
}

/** Keep actual source costs, destroyed originals and prior failed-cast damage through later ordinary completion. */
export function validateDawnPaladinLife(s: SliceState): boolean {
  const m = s.dawnPaladin;
  const practiceKeys = ['swordActive', 'armorActive', 'illusionCreated', 'volunteerSpirituality', 'illusionDispelled', 'screenRemoved', 'armorProbePerformed', 'armorCracked', 'stormCleared', 'instructorOutside', 'stormTarget', 'stormFrameScorched', 'stormSwordDispersed', 'stormArmorCracked'];
  if (!record(m) || !record(m.cases) || !shape(m.cases, DAWN_PALADIN_CASE_IDS) || !record(m.practice) || !shape(m.practice, practiceKeys) || !record(s.seer) || !Array.isArray(s.seer.completedSources) || !s.seer.completedSources.every(x => typeof x === 'string') || typeof m.reflected !== 'boolean') return false;
  const f = m.practice;
  for (const key of practiceKeys.filter(k => !['volunteerSpirituality', 'stormTarget'].includes(k))) if (typeof (f as unknown as Record<string, unknown>)[key] !== 'boolean') return false;
  if (!integer(f.volunteerSpirituality, 18, 20) || !['INTACT', 'DESTROYED', 'DISMANTLED'].includes(f.stormTarget)) return false;
  const isPromoted = s.progression.pathwayId === 'warrior' && (s.progression.sequence === 6||s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
  let open = 0, prepared = 0, resolved = 0;
  for (const p of CASES) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status as string) || !integer(r.withdrawals, 0) || !integer(r.closes, 0) || typeof r.contactOpen !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method as string)) return false;
    if (r.attemptWeek !== null && !integer(r.attemptWeek, m.promotionWeek ?? s.week, s.week)) return false;
    if (s.seer.completedSources.filter(x => x === `dawn-paladin-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1) return false; }
    const successful = ['EXAMINED', 'RESOLVED'].includes(r.status as string);
    if (successful) {
      if (r.attemptWeek === null || r.method === null || r.outcome !== (r.method === 'ABILITY' ? p.abilityOutcome : p.ordinaryOutcome)) return false;
    } else if (r.outcome !== 'NONE') return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null || r.attemptWeek === s.week) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
    if (r.status === 'OBSERVED' && r.attemptWeek === null && r.method !== null) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek !== null && !r.contactOpen && r.closes < 1) return false;
    if (r.contactOpen) { open += 1; if (!['OBSERVED', 'EXAMINED'].includes(r.status as string) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND') return false; }
    if (!isPromoted && (r.status !== 'AVAILABLE' || r.attemptWeek !== null || r.method !== null || r.outcome !== 'NONE' || r.contactOpen || r.closes !== 0 || r.withdrawals !== 0)) return false;
    if (p.id === 'marked-exit') {
      if (f.illusionCreated !== (r.status !== 'AVAILABLE') || f.volunteerSpirituality !== (f.illusionCreated ? 18 : 20)) return false;
      if (f.illusionDispelled !== (successful && r.method === 'ABILITY') || f.screenRemoved !== (successful && r.method === 'ORDINARY')) return false;
    }
    if (p.id === 'armor-test') {
      if (f.armorCracked !== f.armorProbePerformed || f.armorProbePerformed && r.attemptWeek === null) return false;
      if (r.attemptWeek !== null && r.status !== 'PREPARED' && r.method === 'ABILITY' && !f.armorProbePerformed) return false;
    }
    if (p.id === 'cleared-storm') {
      if (f.instructorOutside !== (r.status === 'PREPARED' || r.contactOpen)) return false;
      if (f.stormCleared !== (r.status === 'PREPARED' || r.attemptWeek !== null || r.withdrawals > 0)) return false;
      if (f.stormTarget !== (successful ? r.method === 'ABILITY' ? 'DESTROYED' : 'DISMANTLED' : 'INTACT') || f.stormFrameScorched !== (f.stormTarget === 'DESTROYED')) return false;
      if (f.stormSwordDispersed !== f.stormArmorCracked || f.stormSwordDispersed && r.attemptWeek === null) return false;
      if (r.attemptWeek !== null && r.status !== 'PREPARED' && r.method === 'ABILITY' && !f.stormSwordDispersed) return false;
      if (r.method === 'ABILITY' && (r.status === 'PREPARED' || r.contactOpen) && handsOccupied(s)) return false;
    }
  }
  if (open > 1 || prepared > 1 || open && prepared || f.swordActive) return false;
  const armor = m.cases['armor-test']!, storm = m.cases['cleared-storm']!;
  if (f.armorActive !== ([armor, storm].some(r => r.contactOpen && r.method === 'ABILITY'))) return false;
  if (s.seer.completedSources.some(x => x.startsWith('dawn-paladin-case:') && !DAWN_PALADIN_CASE_IDS.some(id => x === `dawn-paladin-case:${id}`))) return false;
  if (s.seer.completedSources.filter(x => x === 'dawn-paladin-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (!isPromoted && m.reflected) return false;
  if (isPromoted && ((s.progression.sequence===5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))?s.guardian.dawnPaladinActingAtPromotion:s.progression.acting) !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  return true;
}
