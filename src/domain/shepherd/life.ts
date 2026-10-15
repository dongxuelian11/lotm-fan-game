import type { SliceState } from '../slice/types.js';
import type { SeerContext } from '../seer/index.js';
import { applyRoseBishopActivity, roseBishopActions, roseBishopInside } from '../rose-bishop/life.js';
import type { RoseBishopActivityCommand } from '../rose-bishop/types.js';
import { SHEPHERD_GUIDE, SHEPHERD_SPIRITS } from './content.js';
import { applyShepherdEncounter, blockShepherdEncounter, SHEPHERD_ENCOUNTER_STORY } from './encounter.js';
import { validateShepherdCommand } from './index.js';
import { SHEPHERD_CASE_IDS, type ShepherdCommand, type ShepherdActivityCommand, type ShepherdAction, type ShepherdProjection } from './types.js';

const IRIS = 'SH5-IRIS-1', CEDRIC = 'SH5-CEDRIC-1';
const CAPACITY = 7;
const CASES = [
  {
    id: 'paper-guidance', title: '同一原纸的两米移动',
    story: `${SHEPHERD_GUIDE}在贝克兰德原旧物间把自己的一张原纸SH5-PAPER-1放在原桌面，明确同意本次把它移动到两米外原地面标记，再取回原桌。原纸始终归导师；原普通地面净空可步行。（原创G）`,
    facts: ['同一张原纸、原桌面与两米外原标记实际在场；观察和准备都不移动纸或身体。', '能力只借当前驱使的伊芮斯原灵所选轻触术，2灵性、知识14；成功才使同一原纸到原标记，你仍在桌旁。', '普通方法由你本人实际步行两米到原标记，亲手移动同一原纸，知识10；失败纸仍在原桌，但你的身体已在标记处。', '无论成败都须0行动实际取回原纸并普通步行回桌旁；不传送、不复制、不转移所有权，不退已付成本。'],
    ability: '准备借当前伊芮斯已选轻触术移动同一原纸；实施才耗2灵性，知识14，准备本身不移动纸或身体。',
    ordinary: '准备本人普通步行两米并亲手移动同一原纸；实施0灵性、知识10，原纸仍归导师。',
  },
  {
    id: 'willing-chorus', title: '文森本次愿意听的一小段歌',
    story: '原创成年文森（Venson）本人在原旧物间两米外，明确同意听你本人唱一小段有限鼓励，或作普通交谈。此处没有其他听众，他随时可以拒绝继续。这份同意只覆盖本次实践。（原创G）',
    facts: ['你和文森的原身体均已实际在场；没有新增或召唤一具灵魂身体。', '能力只借当前塞德里克原灵已选勇气之歌，由你本人实际唱出，2灵性、知识14；失败仍须停止已开始的声音。', '成功只以文森本人公开反馈较为镇定为结果，不读取思想、不强迫信仰，也不把同意扩大到其他人。', '普通方法仅为知识10的普通交谈，0灵性，没有非凡歌声；收束实际停止声音和反馈。'],
    ability: '准备借当前塞德里克已选勇气之歌，由你本人唱给本次明确同意的原文森；实施2灵性、知识14。',
    ordinary: '准备与原文森作一次普通鼓励交谈并听取本人反馈；实施0灵性、知识10，不施法或迫使相信。',
  },
  {
    id: 'limited-account', title: '只写已见记录的同一原说明',
    story: `${SHEPHERD_GUIDE}提供一张原说明纸SH5-NOTE-1，请你只整理前两项已经发生且报告过的记录。本项没有新法术或秘密信息；收束时须把实际写过的同一原说明交给导师。（原创G）`,
    facts: ['仅普通书写：1行动、0灵性、知识10；成败都已经在同一原说明纸上写字。', '失败文字保留，仍须0行动把同一原说明交给导师，不复制纸张或替换成一份成功文本。', '若下一真实周重试，导师在实际实施开始时交回同一原说明，你在原纸上继续修改后再次交还。', '说明只包含此前公开可核对的有限事实，不授予他途径法术、不制造灵魂、纸张或现金奖励。'],
    ability: null,
    ordinary: '准备在同一原说明纸SH5-NOTE-1上整理已观察的有限记录；实施0灵性、知识10，不复制纸张或施法。',
  },
] as const;
type Case = typeof CASES[number];
type SupplyCommand = Extract<RoseBishopActivityCommand, { type: 'BUY_RATION' | 'TAKE_RATION' }>;
const isSupply = (c: { type: string }): c is SupplyCommand => c.type === 'BUY_RATION' || c.type === 'TAKE_RATION';
const active = (s: SliceState) => s.progression.pathwayId === 'hanged-man' && (s.progression.sequence === 5||(s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)));
const succeeded = (status: string) => status === 'EXAMINED' || status === 'RESOLVED';
const sourceFor = (id: string) => SHEPHERD_SPIRITS.find(spirit => spirit.id === id);
const spiritFor = (s: SliceState, id: string) => s.shepherd.grazing.spirits.find(spirit => spirit.id === id);
const validGrazedSource = (s: SliceState, id: string) => {
  const spirit = spiritFor(s, id), source = sourceFor(id);
  return s.shepherd.grazing.met && !!source && !!spirit && spirit.status === 'GRAZED'
    && integer(spirit.acquiredWeek, s.shepherd.promotionWeek ?? s.week, s.week) && spirit.attemptWeek === spirit.acquiredWeek && spirit.releasedWeek === null
    && Array.isArray(spirit.selectedAbilities) && spirit.selectedAbilities.length >= 1 && spirit.selectedAbilities.length <= 3
    && new Set(spirit.selectedAbilities).size === spirit.selectedAbilities.length
    && spirit.selectedAbilities.every(id => source.knownAbilities.some(ability => ability.id === id));
};
const hasSelected = (s: SliceState, id: string, abilityId: string) => {
  return validGrazedSource(s, id) && s.shepherd.grazing.activeSpiritId === id && spiritFor(s, id)!.selectedAbilities.includes(abilityId);
};
const requiredAbility = (id: string): readonly [string, string] => id === 'paper-guidance' ? [IRIS, 'light-touch'] : [CEDRIC, 'courage-song'];

export const SHEPHERD_ENVIRONMENT = '真正牧羊人最多放牧7灵，每灵至多选择3项该原灵实际掌握的能力，一次只驱使1灵，同时仍可用自身能力；切换即时，不额外扣行动、灵性或推进时间。本作当前只有导师实际保存的两位已故成年原创原灵，先会面后各自尝试放牧，绝非晋升赠满7槽或免费法术库。原灵的有限明确同意只属于本作这条原创G路线，不宣称原著放牧普遍需要同意。放牧每原灵每真实周至多一次，1行动、3灵性、知识14，失败照耗；成功不自动驱使。释放须独立确认，该原灵在当前来源永久离开且不能重新取得，保留历史选择，不是复活或退款。三项实践为同一原纸的两米移动、本人唱给文森的有限鼓励、同一原说明的普通书写。观察、准备、实施、报告各1行动；能力实施2灵性知识14，普通0灵性知识10。失败照耗，0行动真实取回纸、普通步行返回、停声或交还原说明后才能生活和换周。三份报告各G扮演25，前两项成功能力报告各一次已有知识池掌握8，普通不伪增掌握；反思25，可无放牧全普通和平100。血肉储备只沿用原动物来源份额，不赠物；没有序列4黑骑士能力、灵肉之刃或统御阴影。全部新增人物、物件、距离和数值为原创G。' + SHEPHERD_ENCOUNTER_STORY;

export const shepherdInside = (s: SliceState) => {
  const m = s.shepherd, f = m.practice;
  return Object.values(m.cases).some(r => r.contactOpen) || f.paper === 'MARK' || f.chorusOpen || f.playerNode === 'MARK' || f.note === 'WRITTEN';
};
export const isShepherdActivity = (c: ShepherdCommand): c is ShepherdActivityCommand => typeof c === 'object' && c !== null && ['MEET_SPIRITS', 'GRAZE', 'ACTIVATE_SPIRIT', 'RELEASE_SPIRIT', 'BUY_RATION', 'TAKE_RATION', 'OBSERVE', 'PREPARE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW', 'REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].includes(c.type);

function activationBlock(s: SliceState, spiritId: string | null): string | null {
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (!active(s)) return '先完成牧羊人晋升。';
  if (s.activeEvent) return '先处理当前事件。';
  if (s.combat && !((s.combat.encounterId==='SHEPHERD_DISPUTE'&&s.shepherd.encounter.status==='FIGHTING')||(s.combat.encounterId==='BLACK_KNIGHT_DISPUTE'&&s.blackKnight.encounter.status==='FIGHTING')||(s.combat.encounterId==='THREE_HEADED_TEMPLAR_DISPUTE'&&s.threeHeadedTemplar.encounter.status==='FIGHTING'))) return '当前不是同一牧羊人遭遇，不能在此切换。';
  if (shepherdInside(s) || roseBishopInside(s) || s.roseBishop.practice.shape !== 'NORMAL') return '先实际结束原现场接触并恢复本人正常形态。';
  if (spiritId !== null && !validGrazedSource(s, spiritId)) return '只能驱使实际已经放牧且尚未释放的同一原灵。';
  return null;
}

/** Also used immediately before one COMBAT_ROUND: no AP, spirituality, time, random draw or soul movement. */
export function activateShepherdSpirit(s: SliceState, spiritId: string | null, ctx: SeerContext): void {
  if (spiritId !== null && typeof spiritId !== 'string') throw new Error('原灵选择无效。');
  const reason = activationBlock(s, spiritId); if (reason) throw new Error(reason);
  if (s.shepherd.grazing.activeSpiritId === spiritId) return;
  s.shepherd.grazing.activeSpiritId = spiritId;
  ctx.note('即时选择本次驱使的同一原灵', spiritId === null ? '0行动、0灵性，不推进时间；停止借用原灵能力，仍保留实际已放牧原灵与自身能力，没有释放或退款。' : `0行动、0灵性，不推进时间；现在只驱使${sourceFor(spiritId)!.name}（${spiritId}）及其当初实际选择的能力，同时可用自己的能力。其他原灵不同时生效；没有外放独立身体、重新放牧、永久复制或全技能解锁。`);
}

function blocked(s: SliceState, c: ShepherdActivityCommand): string | null {
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (!active(s)) return '先完成牧羊人晋升。';
  if((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))&&!['MEET_SPIRITS','GRAZE','ACTIVATE_SPIRIT','RELEASE_SPIRIT','BUY_RATION','TAKE_RATION'].includes(c.type))return '原牧羊人经历已经归档，请到黑骑士页继续。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗；战斗只在回合选择中切换原灵。';
  const m = s.shepherd, r = 'caseId' in c ? m.cases[c.caseId] : null;
  if (s.world.city !== 'BACKLUND') return '先真实返回贝克兰德伊森的原旧物间。';
  if (c.type === 'CLOSE') return r?.contactOpen ? null : '没有尚待实际结束的本次接触。';
  if (shepherdInside(s)) return '先0行动真实取回原纸、普通步行返回、停止歌声或交还原说明，并结束本次接触。';
  if (roseBishopInside(s) || s.roseBishop.practice.shape !== 'NORMAL') return '先实际结束原蔷薇主教现场并恢复本人正常形态。';
  if (c.type === 'ACTIVATE_SPIRIT') return activationBlock(s, c.spiritId);
  if (c.type === 'RELEASE_SPIRIT') return spiritFor(s, c.spiritId)?.status === 'GRAZED' ? null : '只能永久释放实际已放牧且仍在的同一原灵。';
  if (c.type === 'WITHDRAW') return r?.status === 'PREPARED' ? null : '没有尚未实施的准备。';
  if (Object.entries(m.cases).some(([id, value]) => value.status === 'PREPARED' && (!('caseId' in c) || id !== c.caseId))) return '先实施或0行动取消另一项尚未实施的准备。';
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') return blockShepherdEncounter(s, c);
  if (isSupply(c)) {
    const action = roseBishopActions(s).find(({ command }) => command.type === c.type && (c.type === 'BUY_RATION' || command.type === 'TAKE_RATION' && command.packetId === c.packetId));
    return action ? action.reason : '只能继续实际原动物来源份额的购买或取用，旧实践不在本阶重开。';
  }
  if (s.health <= 0 || s.mind <= 0) return '先休养恢复身体与精神。';
  if (s.actionsRemaining < 1) return '需要1行动。';
  if (c.type === 'MEET_SPIRITS') return m.grazing.met ? '已会面过这两位同一原灵，不能生成新来源。' : null;
  if (c.type === 'GRAZE') {
    const spirit = spiritFor(s, c.spiritId), source = sourceFor(c.spiritId);
    if (!m.grazing.met || !source || spirit?.status !== 'AVAILABLE') return '先会面，并选择仍在导师实际来源中可放牧的同一原灵；已释放者不能重新取得。';
    if (spirit.attemptWeek === s.week) return '本真实周已尝试这位原灵，下一真实周再试。';
    if (m.grazing.spirits.filter(value => value.status === 'GRAZED').length >= CAPACITY) return '最多同时保留7位已放牧原灵。';
    if (!Array.isArray(c.abilityIds) || c.abilityIds.length < 1 || c.abilityIds.length > 3 || new Set(c.abilityIds).size !== c.abilityIds.length || c.abilityIds.some(id => !source.knownAbilities.some(ability => ability.id === id))) return '只能选择该原灵实际掌握的1至3项不同能力，不能借别人的或虚构技能。';
    return s.spirituality < 3 ? '放牧需要3灵性，不能透支。' : null;
  }
  if (c.type === 'REFLECT') return m.reflected ? '已经回看这三项经历。' : CASES.some(p => m.cases[p.id]!.status !== 'RESOLVED') ? '先完成三项真实报告。' : null;
  if (!r) return '未知原现场。';
  if (r.status === 'RESOLVED') return '本项已经报告，不能重复取得奖励。';
  if (c.type === 'OBSERVE') {
    const previous = CASES[CASES.findIndex(p => p.id === c.caseId) - 1];
    return r.status !== 'AVAILABLE' ? '原观察已经保留。' : previous && m.cases[previous.id]!.status !== 'RESOLVED' ? '先完成上一项真实报告。' : null;
  }
  if (c.type === 'REPORT') return r.status === 'EXAMINED' ? null : '先取得真实结果，再实际收束本次接触。';
  if (c.type === 'PREPARE') {
    if (r.status !== 'OBSERVED') return '先核对原现场与本人本次同意。';
    if (r.attemptWeek === s.week) return '本周已实际尝试，下一真实周再准备。';
    if (c.method === 'ABILITY') {
      if (c.caseId === 'limited-account') return '原说明只有普通书写，没有新法术。';
      if (!hasSelected(s, ...requiredAbility(c.caseId))) return '先驱使实际放牧并选有本项能力的同一原灵，或选择普通方法。';
    }
    return null;
  }
  if (r.status !== 'PREPARED' || r.method === null) return '先准备本次有限方法。';
  if (r.attemptWeek === s.week) return '本真实周已经实施，下一真实周才能重试。';
  if (r.method === 'ABILITY') {
    if (c.caseId === 'limited-account' || !hasSelected(s, ...requiredAbility(c.caseId))) return '本次实施需要当前驱使的同一原灵确实持有已选择的对应能力。';
    if (s.spirituality < 2) return '本次能力需要2灵性；可0行动取消准备。';
  }
  return null;
}

function resultText(p: Case, method: 'ABILITY' | 'ORDINARY'): string {
  if (p.id === 'paper-guidance') return method === 'ABILITY' ? '实施时你借当时驱使的原伊芮斯已选轻触术，把同一原纸SH5-PAPER-1实际移到两米外原标记；实施时你本人仍在原桌旁，纸仍属导师。' : '实施时你从原桌旁亲手拿起同一原纸SH5-PAPER-1，携纸沿普通地面实际步行两米到原标记并放下；没有施法或转移所有权。';
  if (p.id === 'willing-chorus') return method === 'ABILITY' ? '实施时你借当时驱使的原塞德里克已选勇气之歌，由自己实际唱出一小段鼓励；文森本人公开反馈较为镇定。只记录这次反馈，不声称读取思想、强迫信仰或永久控制。' : '你与原文森作普通交谈，他本人确认听懂本次鼓励；没有非凡歌声、灵魂施法或思想强制。';
  return '你在同一原说明纸SH5-NOTE-1上普通写下前两项已见记录与有限边界，完成一次可核对的说明；没有新知识来源、法术、复制纸或现金奖励。';
}

export function applyShepherdActivity(s: SliceState, c: ShepherdActivityCommand, ctx: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void): void {
  if (!validateShepherdCommand(c) || !isShepherdActivity(c)) throw new Error('牧羊人实践命令无效。');
  const reason = blocked(s, c); if (reason) throw new Error(reason);
  if (c.type === 'ENCOUNTER_TALK' || c.type === 'ENCOUNTER_FIGHT') { applyShepherdEncounter(s, c, ctx); return; }
  if (isSupply(c)) { applyRoseBishopActivity(s, c, ctx, award); return; }
  if (c.type === 'ACTIVATE_SPIRIT') { activateShepherdSpirit(s, c.spiritId, ctx); return; }
  const m = s.shepherd, f = m.practice;
  if (c.type === 'RELEASE_SPIRIT') {
    const spirit = spiritFor(s, c.spiritId)!; spirit.status = 'RELEASED'; spirit.releasedWeek = s.week;
    if (m.grazing.activeSpiritId === spirit.id) m.grazing.activeSpiritId = null;
    ctx.note('经独立确认永久释放同一原灵', `你已确认并实际释放${sourceFor(spirit.id)!.name}（${spirit.id}）。这位原灵在当前实际来源中永久离开，不能重新放牧或变回可用；旧选择仅作历史保留，此后不能再借其能力。0行动，不退款、不复活、不生成替代灵魂。`); return;
  }
  if (c.type === 'CLOSE') {
    const r = m.cases[c.caseId]!;
    let action: string;
    if (c.caseId === 'paper-guidance') {
      action = f.paper === 'MARK' ? (f.playerNode === 'DESK' ? '你本人沿原普通地面实际步行两米到原标记，' : '你本人已在原标记处，') + '亲手取起同一原纸SH5-PAPER-1，再沿原路普通步行两米回桌旁，将原纸实际放回原桌。' : f.playerNode === 'MARK' ? '同一原纸SH5-PAPER-1仍在原桌；你本人沿原路普通步行两米回到桌旁，核对原纸原位。' : '同一原纸SH5-PAPER-1与本人都仍在原桌旁，核对原纸原位并实际结束接触，没有虚构取纸或移动。';
      f.paper = 'TABLE'; f.playerNode = 'DESK';
    } else if (c.caseId === 'willing-chorus') {
      action = f.chorusOpen ? '你本人实际停止已开始的歌声，结束与原文森本次反馈；无论是否成功，已经发出的声音与已付灵性不抹去。' : '你和原文森实际结束这次普通交谈与反馈，尊重其本人意愿；没有虚构非凡歌声。';
      f.chorusOpen = false;
    } else {
      f.note = 'HANDED_OVER';
      action = `你将实际写过的同一原说明纸SH5-NOTE-1亲手交给${SHEPHERD_GUIDE}；${succeeded(r.status) ? '这次已写说明' : '这次尚未通过核对的失败文字'}原样保留，没有擦除、复制、重写成功文本或新生成纸张。`;
    }
    r.contactOpen = false; r.closes += 1;
    ctx.note('实际收束原现场', '0行动；收束包含在本次预付实践时间内。' + action + '已付成本不退，不治疗、不补灵性或奖励。'); return;
  }
  if (c.type === 'WITHDRAW') {
    const r = m.cases[c.caseId]!; r.status = 'OBSERVED'; r.method = null; r.withdrawals += 1;
    ctx.note('取消尚未实施的准备', '0行动取消准备。原纸、原说明、原身体没有因准备而移动；没有唱歌、重新放牧或释放原灵，旧观察与已付成本保留。'); return;
  }
  s.actionsRemaining -= 1;
  if (c.type === 'MEET_SPIRITS') {
    m.grazing.met = true; for (const spirit of m.grazing.spirits) spirit.status = 'AVAILABLE';
    ctx.note('实际会面两位有限原灵', `${SHEPHERD_GUIDE}分别介绍原容器中已经存在的已故成年伊芮斯（${IRIS}，巫师7）与塞德里克（${CEDRIC}，歌颂者9）。两人已在故事开始前死亡，分别对这条原创G路线作出有限明确同意；不杀死或生成任何活人。这只公开各自实际掌握的有限方法，尚未放牧、驱使或学会其法术，也没有转交尸体或装备。`); return;
  }
  if (c.type === 'GRAZE') {
    const spirit = spiritFor(s, c.spiritId)!; spirit.attemptWeek = s.week; s.spirituality -= 3;
    const result = ctx.check('knowledge', 14);
    if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
      spirit.status = 'GRAZED'; spirit.acquiredWeek = s.week; spirit.selectedAbilities = [...c.abilityIds];
      ctx.note('实际放牧同一原灵并固定能力选择', `已耗1行动、3灵性，将实际原灵${sourceFor(spirit.id)!.name}（${spirit.id}）纳入体内驱使范围，只选择${spirit.selectedAbilities.join('、')}。没有外放身体、转交尸体装备、永久学习全部法术或自动激活；须另行明确选择当前驱使者。`);
    } else ctx.note('本次放牧未成', `已耗1行动、3灵性；同一原灵${spirit.id}仍在导师的原容器中可用，没有取得能力、改变当前驱使者或生成新来源。下一真实周才能对这位原灵再试。`);
    return;
  }
  if (c.type === 'REFLECT') {
    m.reflected = true; s.seer.completedSources.push('shepherd-reflection'); s.progression.acting = Math.min(100, s.progression.acting + 25);
    ctx.note('回看真实来源、有限能力与本人意愿', '三份实际报告区分了同一原纸的真实位置、原文森本人公开反馈与同一原说明的普通书写。G扮演+25；不赠原灵或技能，不补储备，不要求伤害他人，不下放序列4黑骑士能力。'); return;
  }
  const p = CASES.find(value => value.id === c.caseId)!, r = m.cases[p.id]!;
  if (c.type === 'OBSERVE') { r.status = 'OBSERVED'; ctx.note(p.title, p.story + p.facts.join(' ')); return; }
  if (c.type === 'PREPARE') { r.status = 'PREPARED'; r.method = c.method; ctx.note(p.title, c.method === 'ABILITY' ? p.ability! : p.ordinary); return; }
  if (c.type === 'REPORT') {
    r.status = 'RESOLVED'; s.progression.acting = Math.min(100, s.progression.acting + 25);
    const source = `shepherd-case:${p.id}`;
    if (r.method === 'ABILITY') award(source, 8); else s.seer.completedSources.push(source);
    ctx.note(p.title, resultText(p, r.method!) + '上述实施已经真实收束，原物已归位或交还、声音已停。G扮演+25；' + (r.method === 'ABILITY' ? '本次能力报告一次已有知识池单项掌握+8，借用不成为永久复制。' : '普通报告不伪增能力掌握。')); return;
  }
  r.attemptWeek = s.week; r.contactOpen = true;
  if (r.method === 'ABILITY') {
    s.spirituality -= 2;
    if (p.id === 'willing-chorus') f.chorusOpen = true;
    ctx.note('实际支付本次借用能力成本', `2灵性已经由你本人支付，只借当前同一原灵的已选能力。${p.id === 'willing-chorus' ? '你本人已开始唱有限歌声，无论反馈是否成功都须实际停声。' : '只有判定成功才移动同一原纸；你本人仍在桌旁。'}失败不退款，没有独立灵魂身体或他人替你支付。`);
  } else if (p.id === 'paper-guidance') {
    f.playerNode = 'MARK';
    ctx.note('本人实际执行普通携纸与步行', '你在原桌旁亲手拿起同一原纸SH5-PAPER-1，携纸沿原普通地面实际步行两米到原标记，核对并尝试完成指定放置。若未能完成，须在本次预付时间内亲手携纸沿原路返回两米放回原桌，再本人步行两米回标记核对失败位置；没有隔空移动原纸。');
  }
  if (p.id === 'limited-account') {
    const returned = f.note === 'HANDED_OVER'; f.note = 'WRITTEN';
    ctx.note('同一原说明已经实际写过', (returned ? '导师先将上次收到且保留原文字的同一原说明纸SH5-NOTE-1亲手交回，你继续在原纸上修改。' : '你在实际原说明纸SH5-NOTE-1上开始普通书写。') + '只用前两项已观察记录，知识10；失败仍保留本次文字并须交还同一原件，没有复制纸或新法术。');
  }
  const result = ctx.check('knowledge', r.method === 'ABILITY' ? 14 : 10);
  if (result.tier === 'SUCCESS' || result.tier === 'GREAT_SUCCESS') {
    if (p.id === 'paper-guidance') f.paper = 'MARK';
    r.status = 'EXAMINED';
    r.outcome = p.id === 'paper-guidance' ? 'PAPER_CHECKED' : p.id === 'willing-chorus' ? r.method === 'ABILITY' ? 'CHORUS_CHECKED' : 'TALK_CHECKED' : 'ACCOUNT_CHECKED';
    ctx.note(p.title, resultText(p, r.method!) + '本次接触仍打开，先0行动真实收束再报告。'); return;
  }
  r.status = 'OBSERVED'; r.outcome = 'NONE';
  if (p.id === 'paper-guidance' && r.method === 'ORDINARY') ctx.note('普通失败仍按原路实际归纸', '本次指定放置未成，你亲手携同一原纸沿原路普通步行两米回原桌并放回，再本人实际步行两米回原标记核对。纸在原桌，你在原标记；收束仍须本人走回桌旁，不传送或抹去这次行程。');
  ctx.note(p.title, (p.id === 'paper-guidance' ? '本次移动未成，同一原纸仍在原桌；已经发生的本人步行与成本保留。' : p.id === 'willing-chorus' ? '文森本人未给出可报告反馈或拒绝继续，不能声称歌声产生了效果；若已唱出声音仍须实际停止。' : '这次普通说明尚未通过核对，原纸已经写过，失败文字仍保留并须交还导师。') + '先0行动实际收束，下一真实周再准备；不退款、不补成功。');
}

export function shepherdActions(s: SliceState): ShepherdAction[] {
  if (!active(s)) return [];
  const out: ShepherdAction[] = [];
  const add = (id: string, label: string, cost: string, command: ShepherdActivityCommand) => { const reason = blocked(s, command); out.push({ id, label, cost, command, enabled: reason === null, reason }); };
  if (!s.shepherd.grazing.met) add('shepherd-meet-spirits', '请伊森介绍实际保存的两位原灵', '1行动 · 只会面 · 不赠能力', { type: 'MEET_SPIRITS' });
  else for (const source of SHEPHERD_SPIRITS) {
    const spirit = spiritFor(s, source.id)!;
    if (spirit.status === 'AVAILABLE') {
      add(`graze-${source.id}`, `放牧${source.name}并选其实际已知${source.knownAbilities.length}项能力`, '1行动 · 3灵性 · 知识14 · 失败照耗 · 每原灵每真实周一次', { type: 'GRAZE', spiritId: source.id, abilityIds: source.knownAbilities.map(ability => ability.id) });
      if (source.id === IRIS) add(`graze-${source.id}-first`, `放牧${source.name}，只选轻触术`, '1行动 · 3灵性 · 知识14 · 不自动获得其余能力', { type: 'GRAZE', spiritId: source.id, abilityIds: ['light-touch'] });
    }
    if (spirit.status === 'GRAZED') {
      if (s.shepherd.grazing.activeSpiritId !== source.id) add(`activate-${source.id}`, `只驱使${source.name}的已选能力`, '0行动 · 0灵性 · 即时切换 · 保留自身能力', { type: 'ACTIVATE_SPIRIT', spiritId: source.id });
      add(`release-${source.id}`, `永久释放${source.name}`, '0行动 · 须独立确认 · 当前来源永久失去该原灵，不能重获', { type: 'RELEASE_SPIRIT', spiritId: source.id, confirmed: true });
    }
  }
  if (s.shepherd.grazing.activeSpiritId !== null) add('shepherd-deactivate', '停止借用，只用自身能力', '0行动 · 0灵性 · 不释放原灵', { type: 'ACTIVATE_SPIRIT', spiritId: null });
  for (const action of roseBishopActions(s)) if (isSupply(action.command)) add(`shepherd-${action.id}`, action.label, action.cost, action.command);
  if((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2)))return out;
  for (const p of CASES) {
    const r = s.shepherd.cases[p.id]!;
    if (r.contactOpen) add(`${p.id}-close`, p.id === 'paper-guidance' ? '实际取回原纸并普通步行返回' : p.id === 'willing-chorus' ? '实际停声并结束本人反馈' : '把写过的同一原说明交还导师', '0行动 · 原物与实际接触收束 · 不退款', { type: 'CLOSE', caseId: p.id });
    if (r.status === 'AVAILABLE') add(`${p.id}-observe`, '核对原现场、原物与本次同意', '1行动', { type: 'OBSERVE', caseId: p.id });
    if (r.status === 'OBSERVED') {
      if (p.ability && s.shepherd.grazing.met) add(`${p.id}-ability`, p.id === 'paper-guidance' ? '准备借伊芮斯已选轻触术' : '准备借塞德里克已选勇气之歌', '1行动 · 不移动原物或唱歌', { type: 'PREPARE', caseId: p.id, method: 'ABILITY' });
      add(`${p.id}-ordinary`, p.id === 'paper-guidance' ? '准备本人普通步行与亲手移动' : p.id === 'willing-chorus' ? '准备普通鼓励交谈' : '准备普通书写同一原说明', '1行动 · 0灵性 · 不要求放牧', { type: 'PREPARE', caseId: p.id, method: 'ORDINARY' });
    }
    if (r.status === 'PREPARED') {
      add(`${p.id}-perform`, '实际实施本次有限方法', r.method === 'ABILITY' ? '1行动 · 2灵性 · 知识14 · 失败照耗' : '1行动 · 0灵性 · 知识10', { type: 'PERFORM', caseId: p.id });
      add(`${p.id}-withdraw`, '取消尚未实施的准备', '0行动 · 不返已付成本', { type: 'WITHDRAW', caseId: p.id });
    }
    if (r.status === 'EXAMINED') add(`${p.id}-report`, '报告真实结果与有限边界', '1行动 · 先实际收束', { type: 'REPORT', caseId: p.id });
  }
  if (!s.shepherd.reflected) add('shepherd-reflect', '回看真实来源、已选能力与本人意愿', '1行动 · 三份真实报告后', { type: 'REFLECT' });
  if (s.shepherd.encounter.status === 'AVAILABLE') {
    add('shepherd-encounter-talk', '到原门廊外院当面澄清', '1行动 · 本人可拒绝 · 不加扮演', { type: 'ENCOUNTER_TALK' });
    add('shepherd-encounter-fight', '到原门廊外院承担冲突', '1行动 · 真实伤势与死亡风险 · 原出口可退', { type: 'ENCOUNTER_FIGHT' });
  }
  return out;
}

export function shepherdCases(s: SliceState): ShepherdProjection['cases'] {
  if (!active(s)) return [];
  return CASES.map(p => { const r = s.shepherd.cases[p.id]!; return {
    id: p.id, title: p.title, story: p.story, observations: r.status === 'AVAILABLE' ? [] : p.facts.filter(fact => s.shepherd.grazing.met || !fact.includes('伊芮斯') && !fact.includes('塞德里克')),
    preparation: r.status === 'PREPARED' ? r.method === 'ABILITY' ? p.ability : p.ordinary : null,
    result: succeeded(r.status) ? resultText(p, r.method!) : r.attemptWeek !== null ? '上次没有可报告结果，实际位置、已唱声音或原说明文字与成本保留，须收束后等下一真实周再试。' : r.withdrawals ? '准备已取消，没有实施或退还之前成本。' : null,
    status: r.status, contactOpen: r.contactOpen ? '本次实际接触未结束，先0行动收束原人原物与声音' : '没有尚未结束的本次接触', closes: r.closes,
  }; });
}
export function shepherdPractice(s: SliceState): ShepherdProjection['practice'] {
  if (!active(s)) return null;
  const f = s.shepherd.practice, history: string[] = [];
  for (const p of CASES) { const r = s.shepherd.cases[p.id]!; if (succeeded(r.status)) history.push('已发生的有限记录：' + resultText(p, r.method!)); }
  if (f.note === 'HANDED_OVER' && !succeeded(s.shepherd.cases['limited-account']!.status)) history.push('同一原说明SH5-NOTE-1的失败文字已经实际交给导师并保留；未变成成功内容，下次实施须由导师交回原件。');
  return {
    paper: `同一原纸SH5-PAPER-1${f.paper === 'TABLE' ? '在原桌面' : '已实际在两米外原标记，须取回'}，始终归导师。`,
    chorus: f.chorusOpen ? '你本人已经开始有限歌声，须实际停止；不据声音存在推断文森已受影响。' : '没有尚未停止的本次歌声。',
    position: f.playerNode === 'DESK' ? '你的原身体在原桌旁。' : '你的原身体已普通步行两米到原标记，须沿原路实际返回。',
    note: `同一原说明SH5-NOTE-1${f.note === 'BLANK' ? '尚未书写' : f.note === 'WRITTEN' ? '已经实际写过，须把这同一原件交给导师' : '已实际交给导师，原文字保留'}。`, history,
  };
}
export function shepherdGrazing(s: SliceState): ShepherdProjection['grazing'] {
  if (!active(s)) return null;
  const g = s.shepherd.grazing;
  return { met: g.met, capacity: CAPACITY, activeSpiritId: g.activeSpiritId,
    spirits: g.met ? SHEPHERD_SPIRITS.map(source => { const spirit = spiritFor(s, source.id)!; return { id: source.id, name: source.name, source: source.source, status: spirit.status, selectedAbilities: [...spirit.selectedAbilities], knownAbilities: source.knownAbilities.map(ability => ({ ...ability })), attemptWeek: spirit.attemptWeek, acquiredWeek: spirit.acquiredWeek, releasedWeek: spirit.releasedWeek }; }) : [],
    summary: g.met ? `当前实际放牧${g.spirits.filter(spirit => spirit.status === 'GRAZED').length}/7灵；这条来源只有会面过的两位原灵。每灵至多选3项实际已知能力，一次只驱使1灵；释放不可逆。` : '尚未会面原灵；容量上限7不代表拥有7灵，当前没有赠送或自动填充的能力来源。',
  };
}
export function projectShepherdLife(s: SliceState): Pick<ShepherdProjection, 'actions' | 'cases' | 'practice' | 'grazing' | 'insideCase' | 'environment'> {
  return { actions: shepherdActions(s), cases: shepherdCases(s), practice: shepherdPractice(s), grazing: shepherdGrazing(s), insideCase: shepherdInside(s), environment: active(s) ? SHEPHERD_ENVIRONMENT : '' };
}

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const shape = (v: Record<string, unknown>, fields: readonly string[]) => Object.keys(v).sort().join('|') === [...fields].sort().join('|');
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;

/** Source-bound souls, actual original positions, one active source and durable historical outcomes. */
export function validateShepherdLife(s: SliceState): boolean {
  const m = s.shepherd;
  if (!record(m) || !record(m.cases) || !shape(m.cases, SHEPHERD_CASE_IDS) || !record(m.practice) || !record(m.grazing) || !record(s.seer) || !Array.isArray(s.seer.completedSources)) return false;
  const f = m.practice, g = m.grazing, promoted = active(s), firstWeek = m.promotionWeek ?? s.week;
  if (!shape(g, ['met', 'activeSpiritId', 'spirits']) || typeof g.met !== 'boolean' || !Array.isArray(g.spirits) || g.spirits.length !== SHEPHERD_SPIRITS.length) return false;
  for (const [index, spirit] of g.spirits.entries()) {
    const source = SHEPHERD_SPIRITS[index]!;
    if (!record(spirit) || !shape(spirit, ['id', 'status', 'attemptWeek', 'acquiredWeek', 'releasedWeek', 'selectedAbilities']) || spirit.id !== source.id || !['UNMET', 'AVAILABLE', 'GRAZED', 'RELEASED'].includes(spirit.status) || !Array.isArray(spirit.selectedAbilities)) return false;
    if (spirit.selectedAbilities.length > 3 || new Set(spirit.selectedAbilities).size !== spirit.selectedAbilities.length || spirit.selectedAbilities.some(id => typeof id !== 'string' || !source.knownAbilities.some(ability => ability.id === id))) return false;
    if (spirit.attemptWeek !== null && !integer(spirit.attemptWeek, firstWeek, s.week)) return false;
    if (spirit.status === 'UNMET') { if (g.met || spirit.attemptWeek !== null || spirit.acquiredWeek !== null || spirit.releasedWeek !== null || spirit.selectedAbilities.length !== 0) return false; }
    else if (!g.met || !promoted) return false;
    if (spirit.status === 'AVAILABLE' && (spirit.acquiredWeek !== null || spirit.releasedWeek !== null || spirit.selectedAbilities.length !== 0)) return false;
    if (spirit.status === 'GRAZED' || spirit.status === 'RELEASED') {
      if (!integer(spirit.acquiredWeek, firstWeek, s.week) || spirit.acquiredWeek !== spirit.attemptWeek || spirit.selectedAbilities.length < 1) return false;
      if (spirit.status === 'GRAZED' ? spirit.releasedWeek !== null : !integer(spirit.releasedWeek, spirit.acquiredWeek!, s.week)) return false;
    }
  }
  if (g.spirits.filter(spirit => spirit.status === 'GRAZED').length > CAPACITY || g.activeSpiritId !== null && (typeof g.activeSpiritId !== 'string' || !g.spirits.some(spirit => spirit.id === g.activeSpiritId && spirit.status === 'GRAZED'))) return false;
  if (!promoted && (g.met || g.activeSpiritId !== null)) return false;
  if (!shape(f, ['paper', 'chorusOpen', 'note', 'playerNode']) || !['TABLE', 'MARK'].includes(f.paper) || typeof f.chorusOpen !== 'boolean' || !['BLANK', 'WRITTEN', 'HANDED_OVER'].includes(f.note) || !['DESK', 'MARK'].includes(f.playerNode)) return false;
  let open = 0, prepared = 0, resolved = 0;
  for (const [index, p] of CASES.entries()) {
    const r = m.cases[p.id];
    if (!record(r) || !shape(r, ['status', 'attemptWeek', 'method', 'withdrawals', 'outcome', 'contactOpen', 'closes'])) return false;
    if (!['AVAILABLE', 'OBSERVED', 'PREPARED', 'EXAMINED', 'RESOLVED'].includes(r.status) || !integer(r.withdrawals, 0) || !integer(r.closes, 0, Math.max(0, s.week - firstWeek + 1)) || typeof r.contactOpen !== 'boolean') return false;
    if (r.method !== null && !['ABILITY', 'ORDINARY'].includes(r.method) || r.attemptWeek !== null && !integer(r.attemptWeek, firstWeek, s.week)) return false;
    if (p.id === 'limited-account' && r.method === 'ABILITY') return false;
    if (s.seer.completedSources.filter(source => source === `shepherd-case:${p.id}`).length !== (r.status === 'RESOLVED' ? 1 : 0)) return false;
    if (r.status === 'RESOLVED') { resolved += 1; if (r.contactOpen || r.closes < 1) return false; }
    const outcome = p.id === 'paper-guidance' ? 'PAPER_CHECKED' : p.id === 'willing-chorus' ? r.method === 'ABILITY' ? 'CHORUS_CHECKED' : 'TALK_CHECKED' : 'ACCOUNT_CHECKED';
    if (succeeded(r.status)) { if (r.attemptWeek === null || r.method === null || r.outcome !== outcome) return false; }
    else if (r.outcome !== 'NONE') return false;
    if (r.status === 'PREPARED') { prepared += 1; if (r.method === null || r.attemptWeek === s.week) return false; }
    if (r.status === 'AVAILABLE' && (r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
    if (r.attemptWeek === null && (r.closes !== 0 || r.contactOpen)) return false;
    if (r.status === 'OBSERVED' && r.attemptWeek === null && r.method !== null) return false;
    if (r.attemptWeek !== null && ((!r.contactOpen && r.closes < 1) || r.closes > r.attemptWeek - firstWeek + 1)) return false;
    if (r.attemptWeek !== null && r.status === 'OBSERVED' && r.method === null && r.withdrawals === 0) return false;
    if (r.method === 'ABILITY' && (r.contactOpen || succeeded(r.status))) {
      const [spiritId, abilityId] = requiredAbility(p.id), spirit = spiritFor(s, spiritId);
      if (!spirit || !['GRAZED', 'RELEASED'].includes(spirit.status) || !spirit.selectedAbilities.includes(abilityId) || spirit.acquiredWeek === null || spirit.acquiredWeek > r.attemptWeek! || spirit.releasedWeek !== null && spirit.releasedWeek < r.attemptWeek!) return false;
    }
    if (r.contactOpen) {
      open += 1;
      if (!['OBSERVED', 'EXAMINED'].includes(r.status) || r.attemptWeek !== s.week || r.method === null || s.activeEvent !== null || s.combat !== null || s.status !== 'ACTIVE' || s.world.city !== 'BACKLUND' || r.closes >= r.attemptWeek - firstWeek + 1) return false;
      if (r.method === 'ABILITY' && !hasSelected(s, ...requiredAbility(p.id))) return false;
    }
    if (index > 0 && r.status !== 'AVAILABLE' && m.cases[CASES[index - 1]!.id]!.status !== 'RESOLVED') return false;
    if (!promoted && (r.status !== 'AVAILABLE' || r.method !== null || r.attemptWeek !== null || r.withdrawals !== 0 || r.closes !== 0 || r.contactOpen)) return false;
  }
  if (open > 1 || prepared > 1 || open && prepared) return false;
  const paper = m.cases['paper-guidance']!, chorus = m.cases['willing-chorus']!, account = m.cases['limited-account']!;
  if (f.paper !== (paper.contactOpen && succeeded(paper.status) ? 'MARK' : 'TABLE')) return false;
  if (f.playerNode !== (paper.contactOpen && paper.method === 'ORDINARY' ? 'MARK' : 'DESK')) return false;
  if (f.chorusOpen !== (chorus.contactOpen && chorus.method === 'ABILITY')) return false;
  if (f.note !== (account.contactOpen ? 'WRITTEN' : account.attemptWeek !== null ? 'HANDED_OVER' : 'BLANK')) return false;
  if (typeof m.reflected !== 'boolean' || s.seer.completedSources.filter(source => source === 'shepherd-reflection').length !== (m.reflected ? 1 : 0) || m.reflected && resolved !== 3) return false;
  if (!promoted && (m.reflected || f.paper !== 'TABLE' || f.chorusOpen || f.playerNode !== 'DESK' || f.note !== 'BLANK')) return false;
  if (promoted && ((s.progression.sequence===4||(s.progression.sequence===3||s.progression.sequence===2))?s.blackKnight.shepherdActingAtPromotion:s.progression.acting) !== resolved * 25 + (m.reflected ? 25 : 0)) return false;
  return true;
}
