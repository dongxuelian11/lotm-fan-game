import type { PublicCheckResult, PublicCoreStatKey } from '../../shared/contracts.js';
import { computeCheckChance } from '../../resolution/normal-check.js';
import type { SliceState } from '../slice/types.js';
import type { SeerContext } from './index.js';
import type { SeerAbilityId } from './types.js';

export type SeerPracticeCommand =
  | { type: 'PRACTICE'; caseId: string; approachId: string }
  | { type: 'REFLECT' };
export interface SeerPracticeCaseRecord {
  id: string;
  originalId: string;
  owner: string;
  originalStatus: 'WITH_OWNER' | 'RETURNED';
  status: 'AVAILABLE' | 'FAILED' | 'COMPLETED';
  attemptWeek: number | null;
  outcome: PublicCheckResult['tier'] | null;
  approachId: string | null;
}
export interface SeerPracticeState { cases: SeerPracticeCaseRecord[]; reflected: boolean }
export interface SeerPracticeChoice {
  id: string; label: string; cost: string; enabled: boolean; reason: string | null;
  command: SeerPracticeCommand;
}
export interface SeerPracticeProjection {
  title: string; body: string; completed: number; total: number;
  cases: { id: string; title: string; body: string; status: string; choices: SeerPracticeChoice[] }[];
  reflection: SeerPracticeChoice;
}
interface PracticeApproach {
  id: string; label: string; ability: SeerAbilityId | null; spirituality: number;
  stat: PublicCoreStatKey; difficulty: number; success: string; failure: string;
}
interface PracticeCase {
  id: string; title: string; owner: string; originalId: string; originalName: string;
  body: string; approaches: [PracticeApproach, PracticeApproach];
}

export const SEER_PRACTICE_CASE_IDS = [
  'folded-bookmark', 'packing-list', 'loose-display', 'copied-warning',
  'mourning-ribbon', 'uncertain-journey', 'stage-rehearsal', 'mixed-catalogue',
] as const;
export const SEER_PRACTICE_REWARD = 12;

/** Original side stories. Named clients, their originals and observable facts are fixed;
 * outcome prose is not published until that particular approach succeeds. */
const CASES: PracticeCase[] = [
  {
    id: 'folded-bookmark', title: '书签折痕里的冷意', owner: '装订匠艾达·沃恩',
    originalId: 'practice-original:ada-bookmark', originalName: '蓝布书签',
    body: '装订匠艾达·沃恩带来自己的蓝布书签。它曾放在俱乐部一次已结束的灵性演示旁，此后她总说折痕发冷。她允许你当面检查整条书签，只想知道该如何描述这件事。检查范围是眼前的布、折痕与实际残留，不能据此找出施术者。',
    approaches: [
      { id: 'sight', label: '开启灵视，比较折痕与布面', ability: 'diviner.s9.spiritual-sight', spirituality: 2, stat: 'perception', difficulty: 10,
        success: '你在折痕附近辨出微弱灵性残留，其他布面没有同样表现。你把观察范围写给艾达，注明这无法认定来源、施术者或所谓诅咒。',
        failure: '你无法稳定区分残留与自己的感受，只留下“尚未确认”的记录。' },
      { id: 'inspect', label: '检查布料，说明普通检查的边界', ability: null, spirituality: 0, stat: 'perception', difficulty: 13,
        success: '你核对布料、湿痕与折边，写下能够重复观察的外观，没有把“摸起来发冷”当成诅咒证据。艾达接受这份有限的检查记录。',
        failure: '你未能把几处布痕整理成可复核的记录，艾达暂不结案。' },
    ],
  },
  {
    id: 'packing-list', title: '装箱单上少掉的一行', owner: '文具商亨利·佩恩',
    originalId: 'practice-original:henry-packing-list', originalName: '手写装箱单',
    body: '文具商亨利·佩恩带来自己的手写装箱单，并在俱乐部侧室摆开两只属于他的敞口纸箱。箱内只有公开可点数的便笺纸。他授权你重数，想在发货前核实漏记。可用线索只有这张原单、眼前纸箱和他的装箱经过，不涉及未在场的仓库或收货人。',
    approaches: [
      { id: 'divine', label: '围绕两只已见纸箱占卜，再实际复点', ability: 'diviner.s9.divination', spirituality: 3, stat: 'knowledge', difficulty: 11,
        success: '模糊的预示让你选择先复点右箱；真正的确认来自逐包计数：一包便笺没有写入原单。亨利亲自补记，你注明占卜只是核查方向，点数才是依据。',
        failure: '预示互相矛盾，余下核点也未完成。你没有凭印象替亨利补上数字。' },
      { id: 'count', label: '逐箱点数，与原单逐行比对', ability: null, spirituality: 0, stat: 'knowledge', difficulty: 14,
        success: '你把两箱便笺逐包点完，找出右箱漏记的一包。亨利在原单补上这一行，依据是当面的实际数量。',
        failure: '你在复点时混淆了已数和未数的纸包，无法给出可靠总数。' },
    ],
  },
  {
    id: 'loose-display', title: '橱窗前摇晃的陈列架', owner: '钟表店主露西·黑尔',
    originalId: 'practice-original:lucy-display-plan', originalName: '陈列架位置草图',
    body: '钟表店主露西·黑尔把自己的陈列草图交给你，并带你查看正在布置的店面。空架在摆上钟表前已经发出轻响，底脚和固定件都能从地面看见。她只要一份现场风险记录，不要求你搬重物或保证架子永远安全。',
    approaches: [
      { id: 'intuition', label: '留意临近危险，从安全距离核查', ability: 'diviner.s9.spiritual-intuition', spirituality: 1, stat: 'perception', difficulty: 10,
        success: '在架子再次倾动前，一阵危险感让你停下靠近。你从侧面看见后脚没有贴地，把可见问题标在草图上，建议露西先停用、再请木匠处理。直觉没有代替修理。',
        failure: '你虽感到不安，却不能把它对应到可靠的观察，便保持距离而没有宣布架子安全。' },
      { id: 'observe', label: '观察底脚与固定件，绘出可见问题', ability: null, spirituality: 0, stat: 'perception', difficulty: 13,
        success: '你沿地面视线逐项看过底脚与固定件，发现后脚悬空，将位置标给露西。她先把陈列安排撤下，等木匠处理；你没有作结构安全担保。',
        failure: '光线与遮挡使记录不够清楚，你请露西继续停用，等下周重看。' },
    ],
  },
  {
    id: 'copied-warning', title: '被抄反的注意事项', owner: '俱乐部抄写员奥文·里德',
    originalId: 'practice-original:owen-warning-copy', originalName: '注意事项手抄页',
    body: '俱乐部抄写员奥文·里德拿来自己的注意事项手抄页，以及你已经在指导中读过的公开入门说明。他发现一处用词可能抄反，想在张贴前复核。两页都摊在桌上，只校订这段已学的安全说明，不补写任何未知仪式或配方。',
    approaches: [
      { id: 'memory', label: '运用神秘学记忆复核已读说明', ability: 'diviner.s9.mysticism-memory', spirituality: 1, stat: 'knowledge', difficulty: 9,
        success: '你忆起已读说明的上下文，再对照原页，指出手抄页把“停止”误写成“继续”。奥文当面更正；你的依据止于这两页已接触的文字。',
        failure: '相近措辞干扰了记忆，你无法确认应改哪一字，因此没有凭空补写。' },
      { id: 'collate', label: '逐字校对两页，不凭记忆补句', ability: null, spirituality: 0, stat: 'knowledge', difficulty: 12,
        success: '你逐字对照两页，在“停止”与“继续”的差异处作出校注。奥文按眼前原页更正了抄写错误。',
        failure: '你漏过了关键差异，校对清单尚不能交付。' },
    ],
  },
  {
    id: 'mourning-ribbon', title: '纪念丝带上的疑问', owner: '花店主玛莎·贝尔',
    originalId: 'practice-original:martha-ribbon', originalName: '旧黑丝带',
    body: '花店主玛莎·贝尔带来自己保存的一条旧黑丝带。它曾在一场追思会中被使用，她问残留的异样是否意味着逝者有话要说。她允许观察丝带，未提供通灵仪式或亡者的其他资料。委托只覆盖眼前丝带与检查结果，不能替亡者传话或解释其意愿。',
    approaches: [
      { id: 'sight', label: '查看实际残留，明确不替逝者传话', ability: 'diviner.s9.spiritual-sight', spirituality: 2, stat: 'perception', difficulty: 11,
        success: '你观察到丝带一端留有淡薄灵性痕迹，却没有可辨认的信息。你清楚告诉玛莎：这一观察不能证明逝者在场，也不表达任何意愿。她收下了这份如实说明。',
        failure: '你未辨出可靠残留，坦承这次观察没有结果，没有用安慰的话冒充讯息。' },
      { id: 'boundaries', label: '记录来历与外观，拒绝编造讯息', ability: null, spirituality: 0, stat: 'will', difficulty: 12,
        success: '你耐心核对丝带来历，说明普通观察能记录磨损，却不能验证亡者的意愿。玛莎接受了范围明确的书面答复，你没有把她的期待当作事实。',
        failure: '你没能把能确定与不能确定的内容解释清楚，双方决定暂不作结论。' },
    ],
  },
  {
    id: 'uncertain-journey', title: '一趟不能保证的旅程', owner: '采购员西蒙·克拉克',
    originalId: 'practice-original:simon-itinerary', originalName: '行程便条',
    body: '采购员西蒙·克拉克拿来自己的行程便条、公开班次表和已写明的会面时间。他想听一句“肯定不会误事”。你只接手核对这些已知安排，并说明临时延误不在任何保证之内；没有远方现场、他人思想或尚未发生事情的确定情报。',
    approaches: [
      { id: 'divine', label: '围绕已知行程占卜，交付有边界的建议', ability: 'diviner.s9.divination', spirituality: 3, stat: 'knowledge', difficulty: 12,
        success: '你得到需要留出余裕的模糊感受，随后用眼前班次表核对出转乘间隔很短。报告把这个可核实的时间风险与不确定的预示分开，并明确没有保证未来。西蒙决定自行调整安排。',
        failure: '占卜没有形成可用指引，班次衔接也未核完；你没有出售“肯定顺利”的承诺。' },
      { id: 'timetable', label: '只核对班次和会面时间，拒绝必然承诺', ability: null, spirituality: 0, stat: 'knowledge', difficulty: 14,
        success: '你按公开班次表算出转乘余裕不足，把时刻与误差范围写入便条。西蒙接受了普通的行程风险报告；是否出发仍由他自己决定。',
        failure: '你未能核清班次的适用日期，不能交付可靠的衔接计算。' },
    ],
  },
  {
    id: 'stage-rehearsal', title: '排练室里的突然一拉', owner: '戏院道具师朱迪丝·格兰特',
    originalId: 'practice-original:judith-prop-cue', originalName: '道具排练提示单',
    body: '戏院道具师朱迪丝·格兰特带来自己的排练提示单，请你在空场观看一次低位布景移动。绳路和演员站位均已公开，她说拉动时偶有反常阻力。只观察这次现场，不猜测工作人员动机，不在危险处逞强，也不接管机械修理。',
    approaches: [
      { id: 'intuition', label: '以灵性直觉警惕临近风险，及时示停', ability: 'diviner.s9.spiritual-intuition', spirituality: 1, stat: 'perception', difficulty: 11,
        success: '绳索将要绷紧时，你感到危险并示意停止。停下后，朱迪丝在你标出的视线范围内发现提示单安排的站位挨着绳路。你交付停演节点记录，让她另请工匠检查机械。',
        failure: '直觉没有给出清楚的警示时点。你要求暂缓演示，没有把沉默解释为安全。' },
      { id: 'trace-cues', label: '核对绳路与站位，先做静态检查', ability: null, spirituality: 0, stat: 'perception', difficulty: 14,
        success: '你在不拉动布景的情况下对照提示单，发现一处站位挨着绳路。朱迪丝划掉该站位并暂停排练，等工匠复查；这份记录没有宣称机械故障已修好。',
        failure: '你未把提示单的标号与现场绳路对应清楚，记录仍需复核。' },
    ],
  },
  {
    id: 'mixed-catalogue', title: '借阅卡上混写的符号', owner: '藏书管理员费利克斯·摩尔',
    originalId: 'practice-original:felix-catalogue-card', originalName: '借阅目录卡',
    body: '藏书管理员费利克斯·摩尔交来自己保管的一张目录卡，旁边放着你已读过的两页公开符号索引。他担心装饰标记被误当成神秘学分类，导致一本普通图册错架。你只核对卡片与这两页索引，不从符号推断作者身份、隐秘组织或未学知识。',
    approaches: [
      { id: 'memory', label: '回忆已读分类，再用索引核实', ability: 'diviner.s9.mysticism-memory', spirituality: 1, stat: 'knowledge', difficulty: 10,
        success: '你忆起两类记号的区别，再用公开索引核对，确认目录卡把一枚装饰花押归进了术语栏。费利克斯修正分类，普通图册回到正确书架；没有新配方因此出现。',
        failure: '相似符号在记忆中混在一起，你没有把猜测登记成新的知识。' },
      { id: 'lookup', label: '逐项查索引，把无法证明的归类留空', ability: null, spirituality: 0, stat: 'knowledge', difficulty: 13,
        success: '你逐项查过两页索引，找出错放进术语栏的装饰花押，并把有依据的校订交给费利克斯。目录卡得到修正，没有增加索引之外的秘密条目。',
        failure: '你还不能排除两种相似记号，便把待核项留空，没有强行定类。' },
    ],
  },
];

export function createSeerPractice(): SeerPracticeState {
  return {
    cases: CASES.map(entry => ({
      id: entry.id, originalId: entry.originalId, owner: entry.owner,
      originalStatus: 'WITH_OWNER', status: 'AVAILABLE', attemptWeek: null,
      outcome: null, approachId: null,
    })),
    reflected: false,
  };
}
const promoted = (s: SliceState) => s.progression.pathwayId === 'diviner' && (s.progression.sequence === 9||s.progression.sequence === 8||s.progression.sequence === 7||s.progression.sequence === 6||s.progression.sequence === 5||(s.progression.sequence === 4 || (s.progression.sequence===3||s.progression.sequence===2||s.progression.sequence===1)));
const sourceId = (caseId: string) => `seer-practice:${caseId}`;
const successful = (tier: PublicCheckResult['tier']) => tier === 'GREAT_SUCCESS' || tier === 'SUCCESS';
const completedCount = (s: SliceState) => s.seer.practice.cases.filter(entry => entry.status === 'COMPLETED').length;

function commonBlock(s: SliceState): string | null {
  if (s.progression.pathwayId === 'diviner' && (s.progression.sequence === 4 || (s.progression.sequence===3||s.progression.sequence===2||s.progression.sequence===1))) return '占卜家委托卷宗已保留，请继续诡法师阶段的实践。';
  if (s.progression.sequence===8||s.progression.sequence===7||s.progression.sequence===6||s.progression.sequence===5) return '占卜家委托卷宗已保留，请继续小丑阶段的实践。';
  if (s.status !== 'ACTIVE') return '当前周目已结束。';
  if (s.activeEvent || s.combat) return '先处理当前事件或战斗。';
  if (s.health <= 0 || s.mind <= 0) return '先休养，恢复身体与精神。';
  if (s.arc.stage !== 'ENDED') return '先为首案作出收尾，再接俱乐部委托。';
  if (!promoted(s)) return '成为占卜家后才能接这些专业委托。';
  if (s.world.city !== 'BACKLUND') return '需要返回贝克兰德的占卜俱乐部。';
  if (s.actionsRemaining < 1) return '本周剩余行动不足。';
  return null;
}

function commandBlock(s: SliceState, command: SeerPracticeCommand): string | null {
  if (command.type !== 'PRACTICE' && command.type !== 'REFLECT') return '未知的俱乐部行动。';
  if (command.type === 'PRACTICE') {
    const entry = CASES.find(candidate => candidate.id === command.caseId);
    const approach = entry?.approaches.find(candidate => candidate.id === command.approachId);
    if (!entry || !approach) return '这项委托或处理方法不存在。';
    const record = s.seer.practice.cases.find(candidate => candidate.id === entry.id);
    if (!record || record.originalId !== entry.originalId || record.owner !== entry.owner) return '这项委托的原物与委托人记录不符。';
    if (record.status === 'COMPLETED' || s.seer.completedSources.includes(sourceId(entry.id))) return '这项委托已经交付，不能重复领奖。';
    if (record.attemptWeek !== null && record.attemptWeek >= s.week) return '本周已经尝试过，请等下周再来复核。';
    const common = commonBlock(s);
    if (common) return common;
    if (approach.ability && !Object.hasOwn(s.progression.mastery, approach.ability)) return '尚未拥有这项非凡能力。';
    if (s.spirituality < approach.spirituality) return `需要${approach.spirituality}点灵性。`;
    return null;
  }
  if (s.seer.practice.reflected) return '这份阶段反思已经完成。';
  if (completedCount(s) !== CASES.length) return '完成全部8项不同委托后，才能整理阶段反思。';
  return commonBlock(s);
}

/** Mutates only the slice's working copy. The caller injects the existing one-source
 * mastery award, keeping this content module independent of the seer command router. */
export function applySeerPractice(
  s: SliceState, command: SeerPracticeCommand, c: SeerContext,
  award: (sourceId: string, amount: 5 | 8) => void,
): void {
  const blocked = commandBlock(s, command);
  if (blocked) throw new Error(blocked);
  if (command.type === 'REFLECT') {
    s.actionsRemaining -= 1;
    s.seer.practice.reflected = true;
    const before = s.progression.acting;
    s.progression.acting = Math.min(100, before + 4);
    c.note('把经历整理成原则', `花费1行动。你重新阅读八份已交付记录：先有真实目标，再谈方法；预示不能代替核实，不确定时不作保证。扮演${before}→${s.progression.acting}/100。这次反思只记一次，不产生额外钱款或能力奖励，也不自动晋升。`);
    return;
  }
  const entry = CASES.find(candidate => candidate.id === command.caseId)!;
  const approach = entry.approaches.find(candidate => candidate.id === command.approachId)!;
  const record = s.seer.practice.cases.find(candidate => candidate.id === entry.id)!;
  s.actionsRemaining -= 1;
  s.spirituality -= approach.spirituality;
  const result = c.check(approach.stat, approach.difficulty);
  record.attemptWeek = s.week;
  record.approachId = approach.id;
  record.outcome = result.tier;
  // Originals are inspected in the owner's presence and handed back on either result.
  // They never become player inventory, nor a copy of an inaccessible first-case relic.
  record.originalStatus = 'RETURNED';
  const costs = `花费1行动、${approach.spirituality}灵性；${approach.stat === 'knowledge' ? '知识' : approach.stat === 'will' ? '意志' : '感知'}判定${result.roll}/${result.chance}`;
  if (!successful(result.tier)) {
    record.status = 'FAILED';
    c.note(`${entry.title} · 尚未完成`, `${costs}，${result.tier === 'GREAT_FAILURE' ? '灾难' : '失败'}。${approach.failure}${entry.originalName}原物已交还${entry.owner}，仍归本人所有。本次时间与灵性已经消耗，没有报酬、掌握或扮演奖励；下周可重新尝试。`);
    return;
  }
  record.status = 'COMPLETED';
  const beforeActing = s.progression.acting;
  s.progression.acting = Math.min(100, beforeActing + 12);
  s.cash += SEER_PRACTICE_REWARD;
  award(sourceId(entry.id), approach.ability ? 8 : 5);
  c.note(`${entry.title} · 已交付`, `${costs}，${result.tier === 'GREAT_SUCCESS' ? '大成功' : '成功'}。${approach.success}${entry.originalName}原物已交还${entry.owner}，报告交付，原物仍归本人所有。收取一次报酬${SEER_PRACTICE_REWARD}便士，扮演${beforeActing}→${s.progression.acting}/100；本案只记一次成长。`);
}

function choice(s: SliceState, id: string, label: string, cost: string, command: SeerPracticeCommand): SeerPracticeChoice {
  const reason = commandBlock(s, command);
  return { id, label, cost, command, enabled: reason === null, reason };
}
export function projectSeerPractice(s: SliceState): SeerPracticeProjection {
  const available = s.arc.stage === 'ENDED' && promoted(s);
  const completed = available ? completedCount(s) : 0;
  return {
    title: '俱乐部委托',
    body: available
      ? '八份有限委托，各有两种处理方法。每次1行动，失败也消耗时间与灵性，同案下周才能重试；成功交付一次12便士、扮演12，并将一份掌握成长分给已知能力。原物归委托人，不会收入背包。'
      : '首案收尾并成为占卜家后，可在贝克兰德接取有限的专业委托。',
    completed, total: CASES.length,
    cases: available ? CASES.map(entry => {
      const record = s.seer.practice.cases.find(candidate => candidate.id === entry.id)!;
      return {
        id: entry.id, title: entry.title, body: entry.body,
        status: record.status === 'COMPLETED' ? `已交付 · 原物已归还${entry.owner}`
          : record.status === 'FAILED' ? `第${record.attemptWeek}周未完成 · ${record.attemptWeek! >= s.week ? '下周可重试' : '现在可重试'}` : '待接取 · 原物由委托人持有',
        choices: record.status === 'COMPLETED' ? [] : entry.approaches.map(approach => choice(s, `${entry.id}:${approach.id}`, approach.label,
          `1行动 · ${approach.spirituality}灵性 · ${approach.stat === 'knowledge' ? '知识' : approach.stat === 'will' ? '意志' : '感知'}难度${approach.difficulty} · 成功率${computeCheckChance({ baseAbility: s.character.coreStats[approach.stat], difficulty: approach.difficulty, modifiers: [] })}% · 成功掌握+${approach.ability ? 8 : 5}`,
          { type: 'PRACTICE', caseId: entry.id, approachId: approach.id })),
      };
    }) : [],
    reflection: choice(s, 'seer-practice-reflection', '整理八份委托的共同原则', '1行动 · 扮演+4 · 仅一次', { type: 'REFLECT' }),
  };
}

/** Small persistence check for this finite content pack, not a replay ledger. */
export function validateSeerPractice(s: SliceState): boolean {
  const practice = s.seer?.practice;
  if (!practice || !Array.isArray(practice.cases) || practice.cases.length !== CASES.length || typeof practice.reflected !== 'boolean') return false;
  if (new Set(practice.cases.map(record => record?.id)).size !== CASES.length) return false;
  if (!Array.isArray(s.seer.completedSources)) return false;
  for (const entry of CASES) {
    const record = practice.cases.find(candidate => candidate?.id === entry.id);
    if (!record || record.originalId !== entry.originalId || record.owner !== entry.owner) return false;
    const sources = s.seer.completedSources.filter(id => id === sourceId(entry.id));
    if (record.status === 'AVAILABLE') {
      if (record.originalStatus !== 'WITH_OWNER' || record.attemptWeek !== null || record.outcome !== null || record.approachId !== null || sources.length !== 0) return false;
      continue;
    }
    if (record.status !== 'FAILED' && record.status !== 'COMPLETED') return false;
    if (record.originalStatus !== 'RETURNED' || !Number.isSafeInteger(record.attemptWeek) || record.attemptWeek! < 1 || record.attemptWeek! > s.week) return false;
    if (!entry.approaches.some(approach => approach.id === record.approachId)) return false;
    if (record.status === 'FAILED' && (record.outcome !== 'FAILURE' && record.outcome !== 'GREAT_FAILURE' || sources.length !== 0)) return false;
    if (record.status === 'COMPLETED' && (record.outcome !== 'SUCCESS' && record.outcome !== 'GREAT_SUCCESS' || sources.length !== 1)) return false;
  }
  const attempted = practice.cases.some(record => record.attemptWeek !== null);
  if (attempted && (!promoted(s) || s.arc.stage !== 'ENDED')) return false;
  return !practice.reflected || practice.cases.every(record => record.status === 'COMPLETED');
}
