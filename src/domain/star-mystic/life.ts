import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applyScrollProfessorActivity, scrollProfessorActions, scrollProfessorInside } from '../scroll-professor/life.js';
import type { ScrollProfessorActivityCommand } from '../scroll-professor/types.js';
import { STAR_MYSTIC_LENSES_ID, STAR_MYSTIC_LENSES_PRICE } from './content.js';
import { applyStarMysticEncounter, blockStarMysticEncounter, STAR_MYSTIC_ENCOUNTER_STORY } from './encounter.js';
import { validateStarMysticCommand } from './index.js';
import { STAR_MYSTIC_CASE_IDS, type StarMysticCommand, type StarMysticActivityCommand, type StarMysticAction, type StarMysticProjection } from './types.js';

/** Fixed original facts belong to the domain; do not project the concealed inscription before actual observation. */
const MARKER_OBSERVATION = '你实际看清伊蕾手中的同一张原木牌SM5-MARKER-1，上面有三道水平刻痕。';
const CASES = [
  {
    id: 'veiled-marker', title: '六米外薄布后的同一原标记',
    story: '同一位成年导师伊蕾·莫文已在原教学室六米外的原薄布后就位。她明确同意本次只核对一张原木牌的标记，也允许改用普通拉开薄布的方法；木牌与薄布始终归她。现在只知道双方约定的原标记确实存在，尚未看见其内容。（原创G）',
    facts: ['观察只核对原薄布、双方约定的站位、六米距离与伊蕾本人的本次同意；不揭开遮挡，不报告尚未看见的牌面或手部位置。', '能力实施须已购买并戴好同一副原厚镜片眼镜；实施时实际将它移到手中，3灵性、2精神、知识14，失败可能只有纷乱视觉，不能据此编造秘密。', '普通实施经本人许可拉开同一原薄布，再以知识10核对原木牌；核对失败薄布仍已实际拉开。', '无论成败都须0行动实际拉回原薄布、戴回自己持有的原眼镜并结束本次接触；已经真正学到的事实不会因遮挡恢复而遗忘。'],
    ability: '准备这一次六米原标记的有限窥视；眼镜仍戴着，薄布仍合着。实施才将已购原眼镜拿到手中并付3灵性、2精神；没有自动看穿别处或提前知道牌面。',
    ordinary: '准备经伊蕾同意普通拉开原薄布、核对同一原标记；准备没有移动薄布或赠送眼镜。实施0灵性、知识10。',
  },
  {
    id: 'willing-cage', title: '达芙宁本人同意的两米边界',
    story: '原创成年志愿者达芙宁（Daphnie）本人已经来到原教学室等待位置，距离原地面试验标记两米。她只同意一次有界星光囚笼或普通边界对照，可以要求立即停止；她没有因你晋升而被生成或传送到场。（原创G）',
    facts: ['准备和观察都不移动达芙宁；实施时她本人沿净空普通地面实际步行两米到原标记。', '能力实施3灵性、知识14，成功才在她身边实际形成这一次透明琥珀色星光囚笼，限制移动，不伤害健康，也不耗用卷轴。', '普通实施0灵性、知识10；她在原地面边界内自愿暂站，没有星光束缚，随时能自行移动。', '关闭时实际解除囚笼（若有），由达芙宁本人自由步行两米返回等待位置；不是传送、精神控制或持续支配。'],
    ability: '准备对同一位明确同意的原达芙宁作一次有限星光囚笼试验；她仍在原等待位置，实施3灵性、知识14，不要求眼镜或新卷轴。',
    ordinary: '准备使用已有原地面边界，邀请达芙宁本人自愿短暂停步；她仍在原等待位置，实施0灵性、知识10，没有非凡束缚。',
  },
  {
    id: 'uncertain-chart', title: '相互冲突的旧记录与当下天空',
    story: '原教学室保留三条本作原创G历史天气条目：相似云纹下，一次记晴，一次记雨，一次记阴。这些旧记录彼此不能给出可靠的未来天气结论。门外六米处是原露天庭院，沿普通走廊可步行去回；本项只作普通当下观察。（原创G）',
    facts: ['三条旧记录已公开可比较，但它们不是未发生天气的答案，也不是本次新施法的来源。', '普通实施0灵性、知识10；本人沿原普通走廊实际步行六米到庭院后，查看当前当地天空。即使比较失败，已看到的天空与身体到场都保留。', '关闭必须本人沿原普通走廊实际步行六米回教学室；不跳时间，不以当前位置标签代替真实返程。'],
    ability: null,
    ordinary: '准备普通步行六米去原庭院，比较三条原历史条目与当下当地天气。实施0灵性、知识10，不使用预言或控制天气。',
  },
] as const;
type Case = typeof CASES[number];
type WorkshopCommand = Extract<ScrollProfessorActivityCommand, { type: 'LEARN_SPELL' | 'BUY_KIT' | 'CRAFT_SCROLL' | 'AUTHORIZE_SCROLL' }>;
const isWorkshop = (c: { type: string }): c is WorkshopCommand => ['LEARN_SPELL', 'BUY_KIT', 'CRAFT_SCROLL', 'AUTHORIZE_SCROLL'].includes(c.type);
const active = (s: SliceState) => s.progression.pathwayId === 'hermit' && s.progression.sequence === 5;
const succeeded = (status: string) => status === 'EXAMINED' || status === 'RESOLVED';

export const STAR_MYSTIC_ENVIRONMENT = '三项原创G有限实践：六米外获准原标记、原达芙宁两米步行后的自愿边界、本人六米步行去回的当下天气比较。观察、准备、实施、报告各1行动。原厚镜片眼镜SM5-LENS-1须另花1行动80便士购买并实际佩戴，不随晋升赠送；它在普通生活中继续持有并戴着。本切片只结算明确选择的有限主动观察，不运行全世界自动窥视或日常精神扣费。标记能力3灵性2精神知识14，星光囚笼3灵性知识14且无需卷轴；两项普通方法均0灵性知识10，天气只有普通方法。实施成败都须0行动实际恢复遮挡、戴镜、解笼、本人普通步行返程并结束接触，已付成本不返。取消未实施准备0行动，不产生奖励或物品。每案每真实周至多实施一次；实际收束后才可生活或换周。三份报告各G扮演25，前两项成功能力报告各一次已有知识池单项掌握8，普通报告不伪增掌握；反思25，可全普通和平100。继续原卷轴工房只用原课程、原材料、原卷和明确逐张授权，不赠术式，不下放序列4神秘再现。所有新增人物、物件、距离、成本与判定数值为原创G。' + STAR_MYSTIC_ENCOUNTER_STORY;
export const starMysticInside = (s: SliceState) => {
  const m = s.starMystic, f = m.practice;
  return Object.values(m.cases).some(r => r.contactOpen) || f.screen === 'OPEN' || f.lenses === 'HELD' || f.cageActive || f.companionNode === 'MARK' || f.playerNode === 'COURTYARD';
};
export const isStarMysticActivity = (c: StarMysticCommand): c is StarMysticActivityCommand => typeof c === 'object' && c !== null && ['BUY_LENSES', 'LEARN_SPELL', 'BUY_KIT', 'CRAFT_SCROLL', 'AUTHORIZE_SCROLL', 'OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);

function blocked(s: SliceState, c: StarMysticActivityCommand): string | null {
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (!active(s)) return '先完成窥秘人途径星象师晋升。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.world.city !== 'BACKLUND') return '先真实返回贝克兰德伊蕾的原教学室。';
  const m = s.starMystic, f = m.practice, r = 'caseId' in c ? m.cases[c.caseId] : null;
  if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚待实际结束的本次接触。';
  if (starMysticInside(s)) return '先0行动实际恢复遮挡、戴镜、解笼或普通步行返回，并结束本次接触。';
  if (scrollProfessorInside(s) || Object.values(s.wizard.cases).some(r => r.effectOpen)) return '先实际结束原旧现场的接触。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚未实施的准备。';
  if (Object.entries(m.cases).some(([id, value]) => value.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先完成或0行动取消另一项尚未实施的准备。';
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockStarMysticEncounter(s, c);
  if (isWorkshop(c)) {
    const action = scrollProfessorActions(s).find(({ command }) => {
      if (command.type !== c.type) return false;
      if (c.type === 'LEARN_SPELL') return command.type === 'LEARN_SPELL' && command.spellId === c.spellId;
      if (c.type === 'CRAFT_SCROLL') return command.type === 'CRAFT_SCROLL' && command.kind === c.kind;
      if (c.type === 'AUTHORIZE_SCROLL') return command.type === 'AUTHORIZE_SCROLL' && command.scrollId === c.scrollId && command.authorized === c.authorized;
      return true;
    });
    return action ? action.reason : '这项原卷轴工房操作目前不可用；须使用实际已有课程、材料与原卷。';
  }
  if (s.health <= 0 || s.mind <= 0) return '先休养恢复身体与精神。';
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'BUY_LENSES') return f.lenses !== 'SUPPLIER' ? '同一副原眼镜已经购买，不能再生成一副。' : s.cash < STAR_MYSTIC_LENSES_PRICE ? '购买原眼镜需要80便士。' : null;
  if (c.type === 'REFLECT') return m.reflected ? '已经回看这三项经历。' : CASES.some(p => m.cases[p.id]!.status !== 'RESOLVED') ? '先完成三项真实报告。' : null;
  if (!r) return '未知原现场。';
  if (r.status === 'RESOLVED') return '本项已经报告，不能重复取得奖励。';
  if (c.type === 'OBSERVE') {
    const previous = CASES[CASES.findIndex(p => p.id === c.caseId) - 1];
    return r.status !== 'AVAILABLE' ? '原观察已经保留。' : previous && m.cases[previous.id]!.status !== 'RESOLVED' ? '先完成上一项真实报告。' : null;
  }
  if (c.type === 'REPORT') return r.status === 'EXAMINED' ? null : '先取得真实结果，再实际收束本次接触。';
  if (c.type === 'PREPARE') return r.status !== 'OBSERVED' ? '先核对原现场与本人本次同意。'
    : r.attemptWeek === s.week ? '本周已实际尝试，下一真实周再准备。'
      : c.method === 'ABILITY' && c.caseId === 'uncertain-chart' ? '旧天气条目只作普通当下比较，不能据此施放预言。'
        : c.method === 'ABILITY' && c.caseId === 'veiled-marker' && f.lenses !== 'WORN' ? '先实际购买并佩戴同一副原厚镜片眼镜，或选择普通拉开原薄布。' : null;
  if (r.status !== 'PREPARED' || r.method === null) return '先准备本次有限方法。';
  if (r.attemptWeek === s.week) return '本周已经实际尝试，下一真实周才能重试。';
  if (r.method === 'ABILITY') {
    if (c.caseId === 'uncertain-chart') return '本项没有能力实施方法。';
    if (c.caseId === 'veiled-marker' && f.lenses !== 'WORN') return '本次窥视必须从实际戴着的原眼镜开始。';
    if (s.spirituality < 3) return '本次能力需要3灵性；可0行动取消准备。';
    if (c.caseId === 'veiled-marker' && s.mind < 2) return '本次专注需要2精神；可0行动取消准备。';
  }
  return null;
}
function resultText(p: Case, method: 'ABILITY' | 'ORDINARY'): string {
  if (p.id === 'veiled-marker') return (method === 'ABILITY' ? '你拿下实际持有的原眼镜，只穿过眼前六米原薄布作有限观察。' : '你经伊蕾本人许可普通拉开原薄布。') + MARKER_OBSERVATION + '这是一条已经观察到的历史事实，不是全知或未来预报。';
  if (p.id === 'willing-cage') return method === 'ABILITY' ? '达芙宁本人已实际步行两米至原标记；你直接施放的一次透明琥珀色星光囚笼确实限制她的移动，没有烧卷、扣健康或控制她的思想。' : '达芙宁本人已实际步行两米到原地面边界并自愿短暂停步；她仍可自由移动，没有星光囚笼或非凡束缚。';
  return '你本人沿原普通走廊实际步行六米到原庭院，看见当地此刻阴天，并将它与三条互不一致的原历史天气条目作普通比较。当下观察不能证明未来天气，没有预言、天气控制或时间跳跃。';
}
export function applyStarMysticActivity(s: SliceState, c: StarMysticActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validateStarMysticCommand(c) || !isStarMysticActivity(c)) throw new Error('星象师实践命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyStarMysticEncounter(s, c, ctx); return; }
  if (isWorkshop(c)) { applyScrollProfessorActivity(s, c, ctx, award); return; }
  const m = s.starMystic, f = m.practice;
  if (c.type === 'CLOSE') {
    const r = m.cases[c.caseId]!;
    let action: string;
    if (c.caseId === 'veiled-marker') {
      action = f.screen === 'OPEN' ? '你将同一原薄布实际拉回合拢。' : '同一原薄布仍合着，本次没有虚构拉开或重造遮挡。';
      f.screen = 'SHUT';
      if (f.lenses === 'HELD') { f.lenses = 'WORN'; action += '你将手中同一副原厚镜片眼镜实际戴回。'; }
      action += f.markerSeen ? '已经实际看见的原标记作为历史知识保留，重新遮挡不抹去记忆。' : '没有把未看清的原标记补写为已知事实。';
    } else if (c.caseId === 'willing-cage') {
      action = f.cageActive ? '你实际解除同一次星光囚笼。' : '本次没有仍生效的星光囚笼，不虚构解笼。';
      f.cageActive = false; f.companionNode = 'WAITING';
      action += '达芙宁本人随后自由沿原地面实际步行两米返回等待位置，本次有限同意结束；没有传送或持续控制。';
    } else {
      f.playerNode = 'ROOM';
      action = '你本人沿原普通走廊实际步行六米返回原教学室；原身体已经离开庭院，先前实际观察到的当地天空仍作为历史保留。';
    }
    r.contactOpen = false; r.closes += 1;
    ctx.note('实际结束本次接触并返回', '0行动。' + action + '已付行动、灵性与精神不退，不治疗，不补物品或奖励。'); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    ctx.note('取消尚未实施的准备', '0行动取消本次有限准备与尚待实施的同意；原薄布、原眼镜、双方原身体均未因准备而移动，旧观察与此前已付成本保留，没有退款或奖励。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'BUY_LENSES') {
    s.cash -= STAR_MYSTIC_LENSES_PRICE; f.lenses = 'WORN';
    ctx.note('购买并实际戴上同一副原眼镜', `你向伊蕾的原教学室供应渠道支付80便士与1行动，取得本作原创G厚镜片眼镜${STAR_MYSTIC_LENSES_ID}并实际戴好。只有这一副原件，日常仍持有并佩戴；不是晋升赠品、封印物或绝对安全保证，没有开启任何窥视。`); return;
  }
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('star-mystic-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('回看已见事实、自愿边界与未来不确定性', '三份报告区分了亲见的有限原标记、本人同意且实际解除的边界，以及当下天气和未来结论之间的距离。G扮演+25；不补发眼镜、卷轴或法术，不把故事转为序列4神秘再现。'); return;
  }
  const p = CASES.find(p => p.id === c.caseId)!, r = m.cases[p.id]!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = c.method; ctx.note(p.title, c.method === 'ABILITY' ? p.ability! : p.ordinary); return; }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25);
    const source = `star-mystic-case:${p.id}`;
    if (r.method === 'ABILITY') award(source, 8); else s.seer.completedSources.push(source);
    ctx.note(p.title, resultText(p, r.method!) + '上述实施后的实际收束与普通返程已经完成。G扮演+25；' + (r.method === 'ABILITY' ? '能力报告一次已有知识池单项掌握+8。' : '本次普通报告不伪造能力掌握。')); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (r.method === 'ABILITY') {
    s.spirituality -= 3;
    if (p.id === 'veiled-marker') { f.lenses = 'HELD'; s.mind -= 2; }
    ctx.note('实际支付有限能力成本', p.id === 'veiled-marker' ? '你实际拿下已购原眼镜，握在手中；3灵性与2精神已经支出，薄布仍合着。只核对获准的六米原标记，纷乱视觉不是全知，失败也不退款。' : '本次直接星光囚笼已经支付3灵性；没有取用任何卷轴，知识14成功才实际形成有限束缚，失败不退款。');
  }
  if (p.id === 'veiled-marker' && r.method === 'ORDINARY') {
    f.screen = 'OPEN'; ctx.note('同一原薄布已经实际拉开', '经伊蕾本人许可，你普通拉开同一原薄布。接下来的知识10核对失败也不撤销已经发生的开布，仍须实际拉回。');
  } else if (p.id === 'willing-cage') {
    f.companionNode = 'MARK'; ctx.note('本人普通步行两米到原标记', '同一位明确同意的原达芙宁沿净空普通地面实际步行两米到原地面标记。接下来的核对失败不把她移回等待位置；此时尚未形成星光囚笼。');
  } else if (p.id === 'uncertain-chart') {
    f.playerNode = 'COURTYARD'; f.weatherSeen = true;
    ctx.note('本人已实际到庭院观察当下天空', '你沿原普通走廊实际步行六米到原庭院，已经看见当前当地阴天。接下来的知识10比较失败也保留原身体位置与这次观察；这不是未来天气答案。');
  }
  const result = ctx.check('knowledge', r.method === 'ABILITY' ? 14 : 10);
  if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
    if (p.id === 'veiled-marker') f.markerSeen = true;
    if (p.id === 'willing-cage' && r.method === 'ABILITY') f.cageActive = true;
    r.status = 'EXAMINED';
    r.outcome = p.id === 'veiled-marker' ? 'MARKER_CHECKED' : p.id === 'willing-cage' ? r.method === 'ABILITY' ? 'CAGE_CHECKED' : 'BOUNDARY_CHECKED' : 'WEATHER_CHECKED';
    ctx.note(p.title, resultText(p, r.method!) + '本次接触仍未结束，须先0行动实际收束后报告。'); return;
  }
  r.status = 'OBSERVED'; r.outcome = 'NONE';
  ctx.note(p.title, (p.id === 'veiled-marker' ? r.method === 'ABILITY' ? '本次视觉纷乱，未看清原标记；不编造牌面、隐藏存在或未来事件，原眼镜仍在手中。' : '本次未形成可接受的原标记观察，薄布仍已经实际拉开。' : p.id === 'willing-cage' ? '本次未形成可报告边界结果，星光囚笼没有生效；达芙宁仍实际站在原标记，可自由移动。' : '本次旧记录比较不足以报告；你仍实际在原庭院，已看到当下阴天，这不证明未来。') + '已付成本保留，先0行动实际收束，下一真实周再准备。');
}

export function starMysticActions(s: SliceState): StarMysticAction[] {
  if (!active(s)) return [];
  const out: StarMysticAction[] = [];
  const add = (id: string, label: string, cost: string, command: StarMysticActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (s.starMystic.practice.lenses === 'SUPPLIER') add('star-mystic-buy-lenses', '购买并戴好同一副原厚镜片眼镜', '1行动 · 80便士 · 仅一副原创G原件', { type: 'BUY_LENSES' });
  for (const action of scrollProfessorActions(s)) if (isWorkshop(action.command)) add(`star-mystic-${action.id}`, action.label, action.cost, action.command);
  for (const p of CASES) {
    const r = s.starMystic.cases[p.id]!;
    if (r.contactOpen) add(`${p.id}-close`, p.id === 'veiled-marker' ? '实际恢复原遮挡并戴回原眼镜' : p.id === 'willing-cage' ? '解除原囚笼并由本人步行返回' : '本人沿原走廊实际步行返回教学室', '0行动 · 实际收束 · 不退成本', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(`${p.id}-observe`, '核对原现场、原物与本次同意', '1行动 · 不提前揭示未知标记', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      if (p.ability) add(`${p.id}-ability`, p.id === 'veiled-marker' ? '准备六米原标记的有限窥视' : '准备本人同意的一次星光囚笼', '1行动 · 不移动人或物', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(`${p.id}-ordinary`, p.id === 'veiled-marker' ? '准备普通拉开原薄布' : p.id === 'willing-cage' ? '准备本人自愿的普通边界对照' : '准备普通步行查看当下天空', '1行动 · 不耗灵性', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(`${p.id}-perform`, '实际实施本次有限方法', r.method === 'ABILITY' ? p.id === 'veiled-marker' ? '1行动 · 3灵性 · 2精神 · 知识14 · 失败照耗' : '1行动 · 3灵性 · 知识14 · 不耗卷' : '1行动 · 0灵性 · 知识10 · 实际普通行动', { type: 'PERFORM', caseId: p.id });
      add(`${p.id}-withdraw`, '取消尚未实施的准备', '0行动 · 不返成本', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(`${p.id}-report`, '报告已经发生的有限结果', '1行动 · 先实际收束', { type: 'REPORT', caseId: p.id });
  }
  if (!s.starMystic.reflected) add('star-mystic-reflect', '回看已见事实与未来不确定性', '1行动 · 三份真实报告后', { type: 'REFLECT' });
  if (s.starMystic.encounter.status === 'AVAILABLE') {
    add('star-mystic-encounter-talk', '到原空院当面澄清', '1行动 · 本人仍可拒绝 · 不加扮演', { type: 'ENCOUNTER_TALK' });
    add('star-mystic-encounter-fight', '到原空院承担冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}
export function starMysticCases(s: SliceState): StarMysticProjection['cases'] {
  if (!(s.progression.pathwayId==='hermit'&&(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))) return [];
  return CASES.map(p => {
    const r = s.starMystic.cases[p.id]!;
    return { id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : [...p.facts], preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null,
      result: succeeded(r.status) ? resultText(p, r.method!) : r.attemptWeek !== null ? '上次尚未形成可报告结果；实际开布、步行、已观察的历史与成本保留，须收束后等下一真实周再准备。' : r.withdrawals ? '准备已取消，原人原物未移动，已付行动保留。' : null,
      status: r.status, contactOpen: r.contactOpen ? '本次接触仍未实际结束，原人原物与效果须真实收束' : '没有尚未结束的本次接触', closes: r.closes };
  });
}
export function starMysticPractice(s: SliceState): StarMysticProjection['practice'] {
  if (!(s.progression.pathwayId==='hermit'&&(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3)))) return null;
  const f = s.starMystic.practice;
  const history: string[] = [];
  if (f.markerSeen) history.push('已通过本次实际观察获得的历史知识：原SM5-MARKER-1有三道水平刻痕；遮挡恢复后仍记得，不表示现在又读取了薄布后方。');
  if (f.weatherSeen) history.push('已实际站在原庭院观察到当时当地阴天；这条历史观察不证明未来天气，也不持续读取院外天空。');
  return {
    vision: (f.lenses === 'SUPPLIER' ? `原眼镜${STAR_MYSTIC_LENSES_ID}仍由供应渠道持有，尚未购买。` : f.lenses === 'WORN' ? `已购同一副原眼镜${STAR_MYSTIC_LENSES_ID}实际戴着，普通生活也继续持有。` : `已购同一副原眼镜${STAR_MYSTIC_LENSES_ID}实际拿在手中，有限主动观察尚待收束。`) + (f.screen === 'SHUT' ? '原薄布合着。' : '原薄布已经实际拉开，须拉回。'),
    cage: f.cageActive ? '本次同意的原星光囚笼正在实际限制达芙宁移动，须立即响应停止要求并实际解除。' : '没有生效中的本次星光囚笼，达芙宁可自由移动。',
    position: `你的原身体${f.playerNode === 'ROOM' ? '在原教学室' : '在六米外原庭院，须本人普通步行返回'}；原达芙宁${f.companionNode === 'WAITING' ? '在等待位置' : '已本人步行两米至原地面标记，须本人步行返回'}。`, history,
  };
}

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).sort().join('|') === [...keys].sort().join('|');
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
/** Validate actual original locations and knowledge separately: closing never erases a real observation. */
export function validateStarMysticLife(s: SliceState): boolean {
  const m = s.starMystic;
  if (!record(m) || !record(m.cases) || !shape(m.cases, STAR_MYSTIC_CASE_IDS) || !record(m.practice) || !record(m.encounter) || !record(s.seer) || !Array.isArray(s.seer.completedSources)) return false;
  const f = m.practice, promoted = (s.progression.pathwayId==='hermit'&&(s.progression.sequence===5||(s.progression.sequence===4||s.progression.sequence===3))), firstWeek = m.promotionWeek ?? s.week;
  if (!shape(f, ['lenses', 'screen', 'markerSeen', 'cageActive', 'companionNode', 'playerNode', 'weatherSeen'])) return false;
  if (!['SUPPLIER', 'WORN', 'HELD'].includes(f.lenses) || !['SHUT', 'OPEN'].includes(f.screen) || !['WAITING', 'MARK'].includes(f.companionNode) || !['ROOM', 'COURTYARD'].includes(f.playerNode) || [f.markerSeen, f.cageActive, f.weatherSeen].some(v => typeof v !== 'boolean')) return false;
  let open = 0, prepared = 0, resolved = 0;
  for (const [index, p] of CASES.entries()) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status) || !integer(r.withdrawals, 0) || !integer(r.closes, 0, Math.max(0, s.week - firstWeek + 1)) || typeof r.contactOpen !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || r.attemptWeek !== null && !integer(r.attemptWeek, firstWeek, s.week)) return false;
    if (p.id === 'uncertain-chart' && r.method === 'ABILITY') return false;
    if (s.seer.completedSources.filter(x => x === `star-mystic-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1) return false; }
    const outcome = p.id === 'veiled-marker' ? 'MARKER_CHECKED' : p.id === 'willing-cage' ? r.method === 'ABILITY' ? 'CAGE_CHECKED' : 'BOUNDARY_CHECKED' : 'WEATHER_CHECKED';
    if (succeeded(r.status)) { if (r.attemptWeek === null || r.method === null || r.outcome !== outcome) return false; }
    else if (r.outcome !== 'NONE') return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null || r.attemptWeek === s.week || p.id === 'veiled-marker' && r.method === 'ABILITY' && f.lenses !== 'WORN') return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen)) return false;
    if (r.status === 'OBSERVED' && r.attemptWeek === null && r.method !== null) return false;
    if (r.attemptWeek !== null && ((!r.contactOpen && r.closes < 1) || r.closes > r.attemptWeek - firstWeek + 1)) return false;
    if (r.attemptWeek !== null && r.status === 'OBSERVED' && r.method === null && r.withdrawals === 0) return false;
    if (r.contactOpen) {
      open += 1;
      if (!['OBSERVED', 'EXAMINED'].includes(r.status) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND' || r.closes >= r.attemptWeek - firstWeek + 1) return false;
    }
    if (index > 0 && r.status !== 'AVAILABLE' && m.cases[CASES[index - 1]!.id]!.status !== 'RESOLVED') return false;
    if (!promoted && (r.status !== 'AVAILABLE' || r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
  }
  if (open > 1 || prepared > 1 || open && prepared) return false;
  const marker = m.cases['veiled-marker']!, cage = m.cases['willing-cage']!, weather = m.cases['uncertain-chart']!;
  if (f.screen !== (marker.contactOpen && marker.method === 'ORDINARY' ? 'OPEN' : 'SHUT')) return false;
  const battleFocus = m.encounter.status === 'FIGHTING' && m.encounter.focused === true && s.combat?.encounterId === 'STAR_MYSTIC_DISPUTE';
  if ((f.lenses === 'HELD') !== (marker.contactOpen && marker.method === 'ABILITY' || battleFocus)) return false;
  if (marker.method === 'ABILITY' && f.lenses === 'SUPPLIER') return false;
  if (f.markerSeen !== succeeded(marker.status)) return false;
  if (f.cageActive !== (cage.contactOpen && cage.method === 'ABILITY' && succeeded(cage.status))) return false;
  if (f.companionNode !== (cage.contactOpen ? 'MARK' : 'WAITING')) return false;
  if (f.playerNode !== (weather.contactOpen ? 'COURTYARD' : 'ROOM') || f.weatherSeen !== (weather.attemptWeek !== null)) return false;
  if (typeof m.reflected !== 'boolean' || s.seer.completedSources.filter(x => x === 'star-mystic-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (!promoted && (m.reflected || f.lenses !== 'SUPPLIER' || f.screen !== 'SHUT' || f.markerSeen || f.cageActive || f.companionNode !== 'WAITING' || f.playerNode !== 'ROOM' || f.weatherSeen)) return false;
  if (promoted && ((s.progression.sequence===4||s.progression.sequence===3)?s.mystic.starMysticActingAtPromotion:s.progression.acting) !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  return true;
}
