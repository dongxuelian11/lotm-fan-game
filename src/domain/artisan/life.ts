import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { ARTISAN_KIT_PRICE } from './content.js';
import { applyArtisanEncounter, blockArtisanEncounter, ARTISAN_ENCOUNTER_STORY } from './encounter.js';
import { ARTISAN_CASE_IDS, type ArtisanCommand, type ArtisanActivityCommand, type ArtisanAction, type ArtisanProjection } from './types.js';

const CASES = [
  { id: 'reading-diagram', title: '先读懂这张微光图纸', story: '原工坊导师埃德温·沃德拿出一份原创G低强微光灯片教学图纸。成年委托人伊芙只需要照清工房里眼前已有的一段刻度；铜壳和灵性材料的用途、三次有限使用与每次轻微疲劳都明确写在纸上。先读图、核对并报告，才算真正理解这个已知方案。（G）', facts: ['本张图纸只支持眼前小范围微光照明；没有隐藏文字、驱邪、太阳光、攻击或免伤效果。', '原工房工作台、普通夹具和工具可供这一次教学使用，仍归工房；不从别的案件搬取工具。', '材料包包含一只普通原铜壳和一份明确标G的低强教学灵性材料，都是本作原创，不冒充原著材料。'], ability: '用已继承的知识与机械制作理解核对真实图纸，说明有限输出和用量；不直接获得成品。', ordinary: '普通逐项阅读并核对原图纸和刻度，不施加非凡制造。', result: '图纸的有限照明、材料用量与三次使用限制已核对。完成报告后才可按这份已理解的方案购买材料并制造。', outcome: 'DIAGRAM_UNDERSTOOD' },
  { id: 'limited-fabrication', title: '材料会耗尽的第一次制造', story: '你在同一原工房用已报告的微光图纸进行非凡制造。每一次实际实施都消耗自己买来的原铜壳一只、G教学灵性材料一份和4灵性；失败只留下耗料记录，不会把普通废铁改称非凡成品。成功才得到唯一原件ART6-LAMP-1。（G）', facts: ['必须先完成图纸报告，具备真实原工具与自己持有的完整材料包。', '本次必须实际使用工匠制造能力；普通检查不能冒充非凡制作。', '失败耗料保留；退出后下一个真实周可重新付费购料，再准备重做。成功原件只有三次有限照明，不制造第二件。'], ability: '准备按已理解方案制作低强微光灯片；实施另耗原铜壳1、G灵性材料1及4灵性，成功与否都照付。', ordinary: '', result: '已实际制成唯一低强微光灯片ART6-LAMP-1，原材料已经消耗，初始仅三次使用。它目前由玩家持有，不产生战斗能力、金钱或额外材料。', outcome: 'LAMP_FABRICATED' },
  { id: 'client-handover', title: '照亮原刻度，再交出原件', story: '完成制造报告后，成年委托人伊芙在原工作台旁验收同一件ART6-LAMP-1。第一次实测只照亮眼前原刻度，耗原件一次使用并付精神1的G轻微疲劳；核对仍可失败。后续重试复核这一次真实检验记录，不反复耗尽原件。她在报告时按原约定接受同一原件，交付后不再留在玩家包中。（G）', facts: ['验收只读取眼前原有刻度；普通核对和能力核对都不发现秘密或产生其它效果。', '第一次PERFORM真实照明并扣一次使用、精神1，无论结果成败都保留；后续只复核同一记录。', '报告时本人接受原件才转交，剩余两次使用随原件交给伊芙；不复制、补能、出售或凭空退款。'], ability: '按已知有限固化方案复核原刻度和实际照明记录；首次实测才耗一次原件使用及精神1。', ordinary: '普通目视核对同一刻度和实际照明记录；同样必须首次实际用灯，不把普通检查当新制造。', result: '眼前原刻度与本次实际照明记录已经核对。首次使用消耗与轻微疲劳保留；完成报告时伊芙本人接受同一原件，余下两次使用随原件交付。', outcome: 'LAMP_VERIFIED' },
] as const;
export const ARTISAN_ENVIRONMENT = '先实际核对并报告已知图纸，再付100便士购买一套原铜壳与G教学灵性材料；原工房每批只有3套，耗尽后下一真实周才能付费补进。制造必须用能力，每次成功失败均耗各1材料及4灵性。成功唯一ART6-LAMP-1有3次使用，验收首次实际照亮眼前原刻度扣1次、精神1；失败后的复核不重复消耗。报告时原件交给本人并留2次，玩家不再持有。0行动结束现场不移动物品、不退成本或治疗。每案报告G扮演+25、单项掌握+8，三案反思+25。具体图纸、材料、价格、次数和判定均为原创G。 ' + ARTISAN_ENCOUNTER_STORY;
export const artisanInside = (s: SliceState) => Object.values(s.artisan.cases).some(r => r.contactOpen);
export const isArtisanActivity = (c: ArtisanCommand): c is ArtisanActivityCommand => ['BUY_KIT', 'OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
function validActivity(c: unknown): c is ArtisanActivityCommand {
  if (!record(c)) return false;
  if (['BUY_KIT', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type as string)) return shape(c, ['type']);
  if (!ARTISAN_CASE_IDS.includes(c.caseId as typeof ARTISAN_CASE_IDS[number])) return false;
  if (c.type === 'PREPARE') return shape(c, ['type', 'caseId', 'method']) && ['ABILITY', 'ORDINARY'].includes(c.method as string);
  return ['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'].includes(c.type as string) && shape(c, ['type', 'caseId']);
}
function blocked(s: SliceState, c: ArtisanActivityCommand): string | null {
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockArtisanEncounter(s, c);
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.progression.pathwayId !== 'paragon' || s.progression.sequence !== 6) return '先完成工匠晋升。';
  const r = 'caseId' in c ? s.artisan.cases[c.caseId] : null, w = s.artisan.workshop;
  if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚未结束的本次事项。';
  if (artisanInside(s)) return '先0行动实际结束本次现场并退出。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '需要回到贝克兰德原工房与原工具旁。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚待取消的准备。';
  if (s.health <= 0 || s.mind <= 0) return '先休养恢复身体与精神。';
  if (c.type === 'BUY_KIT') {
    if (s.artisan.cases['reading-diagram']!.status !== 'RESOLVED') return '先实际报告并理解原微光图纸。';
    if (w.lamp !== null) return '唯一灯片已制成，不能再买材料制造第二件。';
    if (w.copperShells !== 0 || w.spiritualPortions !== 0) return '当前原材料尚未耗尽，不能囤积下一套。';
    if (s.artisan.cases['limited-fabrication']!.attemptWeek === s.week) return '本周失败与耗料保留，退出后下一真实周再付费购料重做。';
    if (w.kitStock === 0 && (w.restockAfterWeek === null || s.week <= w.restockAfterWeek)) return '原工房本批三套材料已耗尽，下一真实周才能实际付费补进。';
    return s.cash < ARTISAN_KIT_PRICE ? '一套原铜壳与G教学灵性材料需要100便士。' : null;
  }
  if (Object.entries(s.artisan.cases).some(([id, value]) => value.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先完成或取消另一项尚未实施的准备。';
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'REFLECT') return s.artisan.reflected ? '已经回看这段经历。' : CASES.some(p => s.artisan.cases[p.id]?.status !== 'RESOLVED') ? '先完成三项实际报告与原件交付。' : null;
  if (!r) return '未知原事项。';
  if (r.status === 'RESOLVED') return '这项报告已经完成。';
  if (c.caseId === 'limited-fabrication' && s.artisan.cases['reading-diagram']!.status !== 'RESOLVED') return '先完成图纸报告，真正理解已知制作方案。';
  if (c.caseId === 'client-handover' && s.artisan.cases['limited-fabrication']!.status !== 'RESOLVED') return '先完成实际制造与制造报告，再验收同一原件。';
  if (c.type === 'OBSERVE') return r.status === 'AVAILABLE' ? null : '原图纸、工具与现场观察已经保留。';
  if (c.type === 'PREPARE') {
    if (r.status !== 'OBSERVED') return '先核对当前真实图纸、物品与现场。';
    if (r.attemptWeek === s.week) return '本周结果和耗料保留，下一真实周再准备重试。';
    if (c.caseId === 'limited-fabrication' && c.method !== 'ABILITY') return '实际非凡制造必须用工匠能力，普通审核不能冒充已经造物。';
    return null;
  }
  if (c.type === 'REPORT') return r.status === 'EXAMINED' ? null : '先取得有限结果并实际结束现场。';
  if (r.status !== 'PREPARED') return '先选择本次方法。';
  if (c.caseId === 'limited-fabrication') {
    if (r.method !== 'ABILITY') return '实际制造必须使用工匠能力。';
    if (w.lamp !== null) return '已存在唯一原件，不能重复制造。';
    if (w.copperShells !== 1 || w.spiritualPortions !== 1) return '需要实际购买并持有原铜壳1和G教学灵性材料1。';
    if (s.spirituality < 4) return '本次制造需要4灵性；取消准备后可休养，材料不会凭空消失。';
  }
  if (c.caseId === 'client-handover' && (!w.lamp || w.lamp.location !== 'PLAYER' || w.delivered || w.tests === 0 && w.lamp.charges < 1)) return '需要自己仍持有的同一原灯片及首次实测所需次数。';
  return null;
}
export function applyArtisanActivity(s: SliceState, c: ArtisanActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validActivity(c)) throw new Error('工匠实践命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyArtisanEncounter(s, c, ctx); return; }
  const m = s.artisan, w = m.workshop;
  if (c.type === 'CLOSE') {
    const r = m.cases[c.caseId]!; r.contactOpen = false; r.closes += 1;
    ctx.note('实际结束本次现场并退出', '0行动停止本次操作并退离原工作台。原工具仍在原工房，原件位置不变；不交付、不复制、不返还耗材、不补次数、不治疗。已付行动、灵性、精神和失败记录全部保留。'); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    ctx.note('取消尚未实施的准备', '0行动取消本次准备，原观察和已付行动保留；尚未用于制造的材料仍在，已经耗去的材料和真实检验成本不会退还。'); return;
  }
  if (c.type === 'BUY_KIT') {
    if (w.kitStock === 0) { w.kitStock = 3; w.restockAfterWeek = null; ctx.note('原工房下一批三套材料实际到货', `第${s.week}周原工房实际补进下一批3套原创G教学材料，旧失败和耗料保留；本次仍须支付100便士领取其中1套，不免费补料。`); }
    s.cash -= ARTISAN_KIT_PRICE; w.kitsBought += 1; w.kitStock -= 1; w.copperShells = 1; w.spiritualPortions = 1;
    if (w.kitStock === 0) w.restockAfterWeek = s.week;
    ctx.note('付费领取实际材料包', `0行动支付100便士，从原工房领取第${w.kitsBought}套材料：原铜壳1、明确标为原创G的低强教学灵性材料1。工具仍归原工房，本批现货剩${w.kitStock}套；这些不是原著配方材料，亦未产生灯片。`); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('artisan-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('知识、材料与原件各有来处', '回看读图、真实耗料制造和原件验收交付。G扮演+25；失败没有造出成品，交出的原件不再属于自己的背包。有限仪式来自已知资料，不能凭空复制任意高阶能力。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[c.caseId]!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + ' ' + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = c.method; ctx.note('准备本次有限方案', c.method === 'ABILITY' ? p.ability : p.ordinary); return; }
  if (c.type === 'REPORT') {
    if (p.id === 'client-handover') { w.lamp!.location = 'CLIENT'; w.delivered = true; ctx.note('伊芙本人接受同一原件', '伊芙按原约定核对后接受ART6-LAMP-1。唯一原件带着余下2次照明实际交给本人，位置改为CLIENT，不再留在玩家包中；不产生副本、补能或额外货款。'); }
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25); award(`artisan-case:${p.id}`, 8);
    ctx.note(p.title, p.result + '现场已实际结束，G扮演+25、已知能力单项掌握+8。'); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (p.id === 'limited-fabrication') { w.copperShells -= 1; w.spiritualPortions -= 1; s.spirituality -= 4; ctx.note('实际投入原材料与灵性', '原铜壳1和原创G低强教学灵性材料1投入原工房制作，4灵性已经支出；判定成败均不退料，普通废铁不能替代灵性材料。'); }
  if (p.id === 'client-handover') {
    if (w.tests === 0) { w.tests = 1; w.lamp!.charges -= 1; s.mind = Math.max(0, s.mind - 1); ctx.note('原灯片实际照亮原刻度', 'ART6-LAMP-1第一次实际照亮眼前原刻度，使用次数3→2，精神−1的G轻微疲劳已经发生。成败均保留这次使用，不照出秘密、不驱邪，也不提供攻击或免伤。'); }
    else ctx.note('复核已经发生的检验记录', '本次对照同一原刻度和首次照明记录，不再次点亮灯片、不扣次数或精神；第一次结果与成本保留，重新核对仍可能失败。');
  }
  const result = ctx.check('knowledge', r.method === 'ABILITY' ? 12 : 10);
  if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
    r.status = 'EXAMINED'; r.outcome = p.outcome;
    if (p.id === 'limited-fabrication') w.lamp = { id: 'ART6-LAMP-1', createdWeek: s.week, charges: 3, location: 'PLAYER' };
    ctx.note(p.title, p.result + '先0行动实际结束本次现场。');
  } else {
    r.status = 'OBSERVED';
    if (p.id === 'limited-fabrication') w.craftFailures += 1;
    ctx.note(p.title, (p.id === 'limited-fabrication' ? '本次制造失败，原铜壳和G灵性材料已耗尽，4灵性已支出；没有灯片、残料退款或伪成功。' : p.id === 'client-handover' ? '本次未形成可报告的验收结论，原灯片仍归玩家；首次真实照明记录、次数和疲劳保留，后续只复核记录。' : '本次图纸核对未形成足够结果，尚未理解并获准按图制造。') + '先实际结束现场，下一真实周才能重新准备。');
  }
}
export function artisanActions(s: SliceState): ArtisanAction[] {
  if (s.progression.pathwayId !== 'paragon' || s.progression.sequence !== 6) return [];
  const out: ArtisanAction[] = [];
  const add = (id: string, label: string, cost: string, command: ArtisanActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (!s.artisan.workshop.lamp) add('artisan-buy-kit', '购买原铜壳与G教学灵性材料包', '0行动 · 100便士 · 只在材料耗尽时购买1套', { type: 'BUY_KIT' });
  for (const p of CASES) {
    const r = s.artisan.cases[p.id]!;
    if (r.contactOpen) add(p.id + '-close', '实际结束本次现场并退出', '0行动 · 不退料、不移物、不治疗', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(p.id + '-observe', '核对本案原图纸、原物与现场', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      add(p.id + '-ability', p.id === 'limited-fabrication' ? '准备实际工匠制造' : '准备有限能力核对', p.id === 'limited-fabrication' ? '1行动 · 实施另耗各1材料与4灵性' : '1行动', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      if (p.id !== 'limited-fabrication') add(p.id + '-ordinary', '准备普通核对方法', '1行动', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(p.id + '-perform', p.id === 'limited-fabrication' ? '实际耗料制作唯一灯片' : p.id === 'client-handover' ? '实际检验原灯片与原刻度' : '实际阅读并核对图纸', p.id === 'limited-fabrication' ? '1行动 · 各1材料与4灵性 · 失败也耗料' : p.id === 'client-handover' && s.artisan.workshop.tests === 0 ? '1行动 · 原灯1次使用 · 精神1 · 成败照付' : '1行动 · 仍可能失败', { type: 'PERFORM', caseId: p.id });
      add(p.id + '-withdraw', '取消尚未实施的准备', '0行动 · 保留原成本', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(p.id + '-report', p.id === 'client-handover' ? '报告验收并将原件交给伊芙本人' : '报告本案有限结果与未知范围', '1行动', { type: 'REPORT', caseId: p.id });
  }
  if (!s.artisan.reflected) add('artisan-reflect', '回看知识、真实材料与原件交付', '1行动 · 三项报告后', { type: 'REFLECT' });
  if (s.artisan.encounter.status === 'AVAILABLE') {
    add('artisan-encounter-talk', '前往原工房外院观察并当面澄清', '1行动 · 对方仍可拒绝 · 无额外扮演', { type: 'ENCOUNTER_TALK' });
    add('artisan-encounter-fight', '前往原工房外院观察并承担冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function artisanCases(s: SliceState): ArtisanProjection['cases'] {
  if (s.progression.pathwayId !== 'paragon' || (s.progression.sequence !== 6&&s.progression.sequence !== 5&&s.progression.sequence!==4&&s.progression.sequence!==3&&s.progression.sequence!==2)) return [];
  return CASES.map(p => { const r = s.artisan.cases[p.id]!; return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null, result: ['EXAMINED', 'RESOLVED'].includes(r.status) ? p.result : r.attemptWeek !== null ? p.id === 'limited-fabrication' ? `此前制造失败${s.artisan.workshop.craftFailures}次，耗料与4灵性成本保留，没有虚构成品。` : p.id === 'client-handover' ? '首次真实照明已经发生，原件仍剩2次；此前核对未成，下一周只复核原记录。' : '此前读图核对未成，尚未获得可制造的理解。' : r.withdrawals ? '尚未实施的准备已取消，原事实保留。' : null, status: r.status, contactOpen: r.contactOpen ? '本次原工房现场仍须结束并退离' : '没有尚未结束的本次事项', closes: r.closes }; });
}
/** One paid material ledger and one immutable item identity, not a general inventory framework. */
export function validateArtisanLife(s: SliceState): boolean {
  const m = s.artisan;
  if (!record(m) || !record(m.cases) || !shape(m.cases, ARTISAN_CASE_IDS) || !Array.isArray(s.seer.completedSources)) return false;
  let open = 0, prepared = 0, resolved = 0;
  for (const p of CASES) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status as string) || !integer(r.withdrawals, 0) || !integer(r.closes, 0, Math.max(0, s.week - (m.promotionWeek ?? s.week) + 1)) || typeof r.contactOpen !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method as string)) return false;
    if (r.attemptWeek !== null && !integer(r.attemptWeek, m.promotionWeek ?? s.week, s.week)) return false;
    if (s.seer.completedSources.filter(x => x === `artisan-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1) return false; }
    if (['EXAMINED', 'RESOLVED'].includes(r.status as string)) { if (r.attemptWeek === null || r.method === null || r.outcome !== p.outcome) return false; }
    else if (r.outcome !== 'NONE') return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek !== null && !r.contactOpen && r.closes < 1) return false;
    if (r.attemptWeek !== null && r.status === 'OBSERVED' && r.method === null && r.withdrawals === 0) return false;
    if (r.contactOpen) { open += 1; if (!['OBSERVED', 'EXAMINED'].includes(r.status as string) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND') return false; }
    if (p.id === 'limited-fabrication' && r.method !== null && r.method !== 'ABILITY') return false;
  }
  if (open > 1 || prepared > 1 || open && prepared) return false;
  if (s.seer.completedSources.filter(x => x === 'artisan-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (s.progression.pathwayId === 'paragon' && s.progression.sequence === 6 && s.progression.acting !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  const w = m.workshop, diagram = m.cases['reading-diagram']!, fabrication = m.cases['limited-fabrication']!, handover = m.cases['client-handover']!;
  if (!record(w) || !shape(w, ['kitsBought', 'kitStock', 'restockAfterWeek', 'copperShells', 'spiritualPortions', 'craftFailures', 'lamp', 'tests', 'delivered'])) return false;
  if (!integer(w.kitsBought, 0) || !integer(w.kitStock, 0, 3) || !integer(w.copperShells, 0, 1) || !integer(w.spiritualPortions, 0, 1) || !integer(w.craftFailures, 0) || !integer(w.tests, 0, 1) || typeof w.delivered !== 'boolean') return false;
  if (w.restockAfterWeek !== null && !integer(w.restockAfterWeek, m.promotionWeek ?? s.week, s.week)) return false;
  if ((w.kitStock === 0) !== (w.restockAfterWeek !== null) || w.kitStock !== (w.kitsBought === 0 ? 3 : (3 - (w.kitsBought as number) % 3) % 3)) return false;
  if (w.copperShells !== w.spiritualPortions || w.kitsBought !== (w.craftFailures as number) + (w.lamp === null ? 0 : 1) + (w.copperShells as number)) return false;
  if (w.kitsBought > 0 && diagram.status !== 'RESOLVED' || fabrication.status !== 'AVAILABLE' && diagram.status !== 'RESOLVED' || handover.status !== 'AVAILABLE' && fabrication.status !== 'RESOLVED') return false;
  if (w.craftFailures + (w.lamp === null ? 0 : 1) !== fabrication.closes + (fabrication.contactOpen ? 1 : 0)) return false;
  if (fabrication.attemptWeek === null && w.craftFailures > 0) return false;
  if (w.tests !== (handover.attemptWeek === null ? 0 : 1) || w.delivered !== (handover.status === 'RESOLVED')) return false;
  if (w.lamp === null) { if (w.tests !== 0 || w.delivered || ['EXAMINED', 'RESOLVED'].includes(fabrication.status)) return false; }
  else {
    if (!record(w.lamp) || !shape(w.lamp, ['id', 'createdWeek', 'charges', 'location']) || w.lamp.id !== 'ART6-LAMP-1' || !integer(w.lamp.createdWeek, m.promotionWeek ?? s.week, s.week)) return false;
    if (w.lamp.createdWeek !== fabrication.attemptWeek || !['EXAMINED', 'RESOLVED'].includes(fabrication.status) || w.copperShells !== 0 || w.spiritualPortions !== 0) return false;
    if (w.lamp.charges !== 3 - w.tests || w.lamp.location !== (w.delivered ? 'CLIENT' : 'PLAYER')) return false;
    if (handover.attemptWeek !== null && handover.attemptWeek < (w.lamp.createdWeek as number)) return false;
  }
  if (m.promotionWeek === null && (w.kitsBought !== 0 || w.kitStock !== 3 || w.restockAfterWeek !== null || w.craftFailures !== 0 || w.lamp !== null)) return false;
  return true;
}
