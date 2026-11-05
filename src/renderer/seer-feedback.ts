import type { SliceEnvelope, SliceReceipt } from '../shared/slice-contracts';
import type { SliceProjection, SliceRecord } from '../domain/slice/types';
import { SEER_MENTOR } from '../domain/seer/content';

/** Display labels only. Historical source strings and chronicle records stay replay-stable. */
export function seerReadableText(text: string): string {
  return text.replace(/(?:原瓶)?seer-batch-(\d+):bottle/g, '第$1批原瓶')
    .replace(/(?<![A-Za-z0-9_:-])(同一原物|原道具外套)?FC6-PROP-COAT-1(?![A-Za-z0-9_:-])/g,
      (_match: string, prefix: string | undefined) => `${prefix === '同一原物' ? '同一件' : ''}原排练道具外套`)
    .replace(/seer-batch-(\d+)/g, '第$1批备料')
    .replace(/(?<![A-Za-z0-9_:-])(?:原瓶)?clown-batch-([1-9]\d*):bottle(?![A-Za-z0-9_:-])/g, '第$1批小丑原瓶')
    .replace(/(?<![A-Za-z0-9_:-])clown-batch-([1-9]\d*)(?![A-Za-z0-9_:-])/g, '第$1批备料')
    .replace(/(?:原瓶)?magician-batch-(\d+):bottle/g, '第$1批魔术师原瓶')
    .replace(/magician-batch-(\d+)/g, '第$1批备料')
    .replace(/(?<![A-Za-z0-9_:-])(?:原瓶)?faceless-batch-(\d+):bottle(?![A-Za-z0-9_:-])/g, '第$1批无面人原瓶')
    .replace(/(?<![A-Za-z0-9_:-])faceless-batch-(\d+)(?![A-Za-z0-9_:-])/g, '第$1批备料')
    .replace(/(?<![A-Za-z0-9_:-])(?:原瓶)?marionettist-batch-(\d+):bottle(?![A-Za-z0-9_:-])/g, '第$1批秘偶大师原瓶')
    .replace(/(?<![A-Za-z0-9_:-])marionettist-batch-(\d+)(?![A-Za-z0-9_:-])/g, '第$1批备料')
    .replace(/(?<![A-Za-z0-9_:-])(?:原瓶)?audience-batch-(\d+):bottle(?![A-Za-z0-9_:-])/g, '第$1批观众原瓶')
    .replace(/(?<![A-Za-z0-9_:-])audience-batch-(\d+)(?![A-Za-z0-9_:-])/g, '第$1批备料')
    .replace(/(?<![A-Za-z0-9_:-])(?:原瓶)?mindreader-batch-(\d+):bottle(?![A-Za-z0-9_:-])/g, '第$1批读心者原瓶')
    .replace(/(?<![A-Za-z0-9_:-])mindreader-batch-(\d+)(?![A-Za-z0-9_:-])/g, '第$1批备料')
    .replace(/(?<![A-Za-z0-9_:-])(?:第(\d+)瓶现成魔药|原瓶)?hunter-potion-(\d+)(?![A-Za-z0-9_:-])/g,
      (match: string, describedNumber: string | undefined, bottleNumber: string) => {
        if (describedNumber) return describedNumber === bottleNumber ? `第${bottleNumber}瓶现成猎人魔药` : match;
        return `第${bottleNumber}瓶猎人原瓶`;
      })
    .replace(/(?<![A-Za-z0-9_:-])(?:第(\d+)瓶序列8成品魔药|原瓶)?provoker-potion-(\d+)(?![A-Za-z0-9_:-])/g,
      (match: string, describedNumber: string | undefined, bottleNumber: string) => {
        if (describedNumber) return describedNumber === bottleNumber ? `第${bottleNumber}瓶序列8挑衅者成品魔药` : match;
        return `第${bottleNumber}瓶挑衅者原瓶`;
      });
}

// Only known public practice sentences are relabeled; commands and saved prose remain untouched.
const RELEASE_CHOICES = '“实际停止能力、释放并退开”或“结束本次接触并回到生活”';
const MARIONETTIST_PRACTICE_COPY: Readonly<Record<string, string>> = {
  'PREPARE只核对本人同意与稳定站位，PERFORM才开始真实接触。': '“准备有限灵体之线实践”只核对本人同意与稳定站位，“实际进行短时能力实践”才开始真实接触。',
  '初控成功会使思维、动作变慢，你的专注也限制自身动作；个体抗性可使尝试失败。必须0行动CLOSE或WITHDRAW实际释放后才可报告。': `初控成功会使思维、动作变慢，你的专注也限制自身动作；个体抗性可使尝试失败。必须以0行动选择${RELEASE_CHOICES}，实际释放后才可报告。`,
  '真实短时初控尚未释放，须0行动CLOSE或WITHDRAW；原人成为秘偶的完整转化没有发生。': `真实短时初控尚未释放，须以0行动选择${RELEASE_CHOICES}；原人成为秘偶的完整转化没有发生。`,
};
export function marionettistPracticeText(text: string): string {
  return Object.hasOwn(MARIONETTIST_PRACTICE_COPY, text) ? MARIONETTIST_PRACTICE_COPY[text]! : text;
}
export function marionettistEnvironmentText(text: string): string {
  const known = '准备时站位稳定，没有施术；实际接触从PERFORM开始。CLOSE与WITHDRAW均0行动，实际停止能力、释放并退开；未实施准备取消不退款。';
  return text.replace(known, `准备时站位稳定，没有施术；实际接触从“实际进行短时能力实践”开始。${RELEASE_CHOICES}均为0行动，实际停止能力、释放并退开；未实施准备取消不退款。`);
}
const MARIONETTIST_OBSERVATION_STORY = "成年搬运工乔纳·里德在同一原排练室内自愿参与，与你相距3米，范围始终小于新晋5米起控参考。双方只约定约20秒有限初控及实际释放，绝不推进约5分钟完整转化；原人始终存活。";
const MARIONETTIST_OBSERVATION_FACTS = ["PREPARE只核对本人同意与稳定站位，PERFORM才开始真实接触。", "初控成功会使思维、动作变慢，你的专注也限制自身动作；个体抗性可使尝试失败。必须0行动CLOSE或WITHDRAW实际释放后才可报告。"];
const MARIONETTIST_SUCCESS_COPY: ReadonlyArray<readonly [string, string, string]> = [
  ['同一成人与无生命木偶的对照', '你真实观察到阿伦的灵体之线，同时确认原普通木偶没有灵体之线；记录只限原现场两个已知对象，不产生秘偶或后台知识。', '先0行动CLOSE或WITHDRAW真实结束本次接触，再报告。'],
  ['约定打断后的自主行动复核', '阿伦在本次真实初控中按约拍肩叫停，专注实际中断；乔纳恢复，并由本人自主抬手、走离原站位，已亲眼核实。全部仍为原成年人，没有任何秘偶。', '先0行动CLOSE或WITHDRAW真实结束本次接触，再报告。'],
  ['五米内短暂初控并主动放开', '在原5米内对自愿成年乔纳实际短时初控，思维和动作变慢，你也因专注受行动限制。未推进完整转化；', '现在须0行动CLOSE或WITHDRAW实际释放并核实自主行动，不能带着控制离场或过周。'],
];

/** Add the current scene around the saved result without rewriting any saved fact. */
export function seerFeedbackText(record: Pick<SliceRecord, 'title' | 'text'>, firstCaseResolved: boolean): string {
  const text = seerReadableText(record.text);
  if (record.title === "五米内短暂初控并主动放开"
    && record.text === MARIONETTIST_OBSERVATION_STORY + MARIONETTIST_OBSERVATION_FACTS.join(' ')) {
    return MARIONETTIST_OBSERVATION_STORY + MARIONETTIST_OBSERVATION_FACTS.map(marionettistPracticeText).join(' ');
  }
  const practice = MARIONETTIST_SUCCESS_COPY.find(([title, prefix, tail]) => record.title === title && record.text === prefix + tail);
  if (practice) return practice[1] + (practice[0] === '五米内短暂初控并主动放开'
    ? `现在须以0行动选择${RELEASE_CHOICES}，实际释放并核实自主行动，不能带着控制离场或过周。`
    : `先以0行动选择${RELEASE_CHOICES}，真实结束本次接触，再报告。`);
  if (record.title === '扮演结束后记住自己'
    && record.text === '角色片段已经完成；还须明确复原本人外貌与原声，才足以提交自我报告。先0行动结束练习。') {
    return '角色片段已经完成；先0行动结束练习。结束练习后，按当前外貌与原服状态完成必要的复原和归还，再提交自我报告。';
  }
  // The public receipt has no selected-method field; keep retry advice method-neutral.
  const facelessRetryTail = '下周可再准备，也可改走普通方法。';
  if (['经过同意的舞台替身', '熟人认出的一个小习惯', '扮演结束后记住自己'].includes(record.title)
    && record.text.startsWith('这次练习不足以支持结论。') && record.text.endsWith(facelessRetryTail)) {
    return text.slice(0, -facelessRetryTail.length) + '下周可再次准备；普通方法也是可选路线。';
  }
  if (record.title === '一扇安静的门' && record.text.startsWith('你拜访了占卜俱乐部指导者。')) {
    return `俱乐部散场后，${SEER_MENTOR}把你领进带着旧纸气味的侧室。他需要有人接手那些费工夫、报酬微薄的查验委托，不愿再见学徒拿模糊预感吓唬客人。“先学会把不知道的事说清楚。”${text}`;
  }
  // Already-saved newer narrative is shown as it was, without doubling the scene.
  if (!record.text.startsWith('原瓶seer-batch-')) return text;
  if (record.title === '成为占卜家') {
    return `苦涩沿着舌根散开，钟摆声忽然近得像在耳边。你重新握稳玻璃杯，${SEER_MENTOR}才松开扶着椅背的手：“先坐稳，别急着证明自己。”${text}马洛压低声音叮嘱：你只是在扮演，不要把自己完全当成另一个人，也别向不知情的人宣讲这些经验。${firstCaseResolved ? '首案已收尾，马洛请你恢复后从一条蓝布书签的委托开始。' : '首案尚未收尾；新的能力只会帮助你检查已有线索，不会替你给出结论。'}`;
  }
  if (record.title === '魔药发生排异' || record.title === '指导者中断了晋升') {
    return `${record.title === '指导者中断了晋升' ? '钟摆声碎成刺耳的重音，椅背在你眼前扭曲。' : '胃里一阵翻搅，杯沿在眼前晃出重影。'}${SEER_MENTOR}扶住你：“先把呼吸放慢。这瓶已经用完，今天先休养。”${text}`;
  }
  return text;
}

/** Correct only a newly confirmed unread discussion's display copy, never saved history. */
export function mindreaderDiscussionFeedback(record: SliceRecord, current: SliceProjection | null,
  envelope: SliceEnvelope, receipt: SliceReceipt): SliceRecord {
  const next = receipt.state;
  if (!current || receipt.replayed || current.runId !== envelope.runId || receipt.runId !== envelope.runId
    || next.runId !== envelope.runId || current.revision !== envelope.expectedRevision
    || receipt.intentId !== envelope.intentId || receipt.previousRevision !== current.revision
    || receipt.newRevision !== next.revision || next.revision <= current.revision
    || current.progression.pathwayId !== 'audience' || current.progression.sequence !== 8
    || next.progression.pathwayId !== 'audience' || next.progression.sequence !== 8 || !next.mindreader.promoted
    || envelope.payload.type !== 'MINDREADER' || envelope.payload.command.type !== 'DISCUSS') return record;
  const { caseId } = envelope.payload.command;
  const titles: Readonly<Record<string, string>> = {
    'lost-key': '阅览室的最后一把钥匙', 'curtain-call': '登台前的停顿', 'harbor-message': '码头的未签收信件',
  };
  const known = '这次没有取得共同确认。已读到的历史片段保留，但不代表对方现在仍在想同一件事；原物与本人决定没有变化，下周可再谈。';
  if (!Object.hasOwn(titles, caseId) || record.title !== titles[caseId] || record.text !== known
    || current.chronicle.some(row => row.id === record.id)
    || !next.chronicle.some(row => row.id === record.id && row.title === record.title && row.text === record.text)
    || !next.mindreader.scenes.some(scene => scene.id === caseId && scene.title === record.title && scene.status === 'OBSERVED')
    // The public READ action exists only while this particular scene has no successful reading.
    || !next.mindreader.actions.some(action => action.command.type === 'READ' && action.command.caseId === caseId)) return record;
  return { ...record, text: '这次没有取得共同确认。尚未读到本次浅层片段；原物与本人决定没有变化，下周可再谈。' };
}

// Exact public narrative signatures: unknown or changed copy fails closed.
const CLOWN_FEEDBACK_LESSONS=[
 {id:'quiet-support',title:'把自己的失落暂放一旁',body:'老道具师没有通过返聘，你陪他收拾确实属于他的工具。你承认自己的失落，以平稳表情听完告别，不假装他的困难已经解决。',stat:'will' as const},
 {id:'unexpected-stage',title:'失误后的最后一幕',body:'公开排练的一处普通道具故障让演出暂停。你从安全低台下来，向观众如实说明，以受控的身体动作完成临时收场；失败不假称无人察觉。',stat:'perception' as const},
 {id:'balance-rehearsal',title:'停在窄台边缘',body:'道具师朱迪丝借出剧院内一块离地很低的排练台，你先检查干燥台面，再练习控制每一步的重心；旁边留有正常下台的空间。',stat:'perception' as const},
 {id:'paper-target',title:'一张纸与固定靶',body:'指导者把厚软木靶固定在无人通行的练习区。只使用你实际买来的普通纸，投出的一张不回库存，也不对真人练刀。',stat:'physique' as const},
 {id:'composed-apology',title:'在责备声中把话说完',body:'你在整理剧院告示时漏掉了排练时刻，朱迪丝当面提出责备。练习稳住表情并诚实道歉，不把角色表情当作自己没有难过，也不否认这次疏漏。',stat:'will' as const},
];

/** Attach only this fresh command's public roll to a display copy, never to saved history. */
export function clownCheckFeedback(record: SliceRecord, current: SliceProjection | null,
  envelope: SliceEnvelope, receipt: SliceReceipt): SliceRecord {
  const next = receipt.state, check = next.lastCheck;
  if (!current || receipt.replayed || current.runId !== envelope.runId || receipt.runId !== envelope.runId
    || next.runId !== envelope.runId || current.revision !== envelope.expectedRevision
    || receipt.intentId !== envelope.intentId || receipt.previousRevision !== current.revision
    || receipt.newRevision !== next.revision || next.revision !== current.revision + 1
    || current.progression.pathwayId !== 'diviner' || current.progression.sequence !== 8
    || next.progression.pathwayId !== 'diviner' || next.progression.sequence !== 8
    || envelope.payload.type !== 'CLOWN' || !check
    || record.week !== current.week || current.chronicle.some(row => row.id === record.id)
    || !next.chronicle.some(row => row.id === record.id && row.week === record.week
      && row.title === record.title && row.text === record.text)) return record;
  const command = envelope.payload.command;
  if (command.type !== 'PRACTICE' && command.type !== 'RESCUE_TALK') return record;
  if (!current.clown.actions.some(action => action.enabled && action.command.type === command.type
    && (command.type !== 'PRACTICE' || action.command.type === 'PRACTICE'
      && action.command.practiceId === command.practiceId))) return record;
  const success = check.tier === 'SUCCESS' || check.tier === 'GREAT_SUCCESS';
  let title: string, text: string, ability: 'will' | 'perception' | 'physique', difficulty = 12;
  if (command.type === 'RESCUE_TALK') {
    ability = 'will'; difficulty = 14;
    title = success ? '快递员走出巷口' : '交涉没有奏效';
    text = success ? '你没有虚构身份或付出并不存在的费用。当面的坚定交涉让对方退让，艾尔西仍持自己的原包裹走向送货街道。扮演+20，掌握+8。'
      : '对方不肯退让。艾尔西仍持原包裹，现场没有凭空转移；你可稍后再谈，或明确选择有风险的介入。';
  } else if (command.practiceId === 'retreat-reflection') {
    ability = 'will'; title = '撤离后的复盘与自控';
    text = `你重新梳理亲历的撤离，承认害怕与未能完成护送的失落，练习稳住表情和呼吸，不把自控说成事情已获解决。本次${success ? `完成实践，扮演${current.progression.acting}→${Math.min(100, current.progression.acting + 20)}/100；不额外增加能力掌握。` : '未能稳定完成，已消耗1行动，没有成长奖励，下周可重试。'}护送仍是撤离，快递员和包裹的后续仍待确认。`;
  } else {
    const lesson = CLOWN_FEEDBACK_LESSONS.find(row => row.id === command.practiceId);
    if (!lesson) return record;
    ability = lesson.stat; title = lesson.title;
    text = `${lesson.body} 本次${success ? '完成练习，扮演+16；已知能力中一项掌握+8。' : '未能稳定完成，没有成长奖励，下周可以再试。'}${lesson.id === 'paper-target' ? '投出的原纸已经消耗。' : ''}`;
  }
  if (record.title !== title || record.text !== text || check.ability !== ability
    || check.difficulty !== difficulty || check.baseAbility !== current.character.coreStats[ability]
    || check.modifiers.length !== 0 || check.effectiveAbility !== check.baseAbility
    || !Number.isInteger(check.roll) || check.roll < 1 || check.roll > 100
    || !Number.isInteger(check.chance) || check.chance < 5 || check.chance > 95
    || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(check.tier)) return record;
  const labels = { will: '意志', perception: '感知', physique: '体质' };
  return { ...record, text: `${labels[ability]}难度${check.difficulty} · 成功率${check.chance}% · 骰点${check.roll}。${record.text}` };
}

// Exact public S7 narrative signatures only; inherited S6/S5 records stay unchanged.
const MAGICIAN_FEEDBACK_PRACTICES = [
  {
    id: 'lamplit-step', title: '两盏原灯之间的一步',
    story: '指导者借出空排练区：场方原有常燃灯与实际灌油点燃的随身油灯相距2米，地面无遮挡。先牵动随身灯的真实火焰，再借另一盏原灯短距离跳跃，最后由你与指导者熄灭随身灯。没有凭空火源，也不穿墙。',
    result: '你先完成火焰操纵，再借2米内的另一盏真实灯火调位，两次法术分别消耗2与3灵性。仍在同一公开排练区，未制造新火焰流。',
    stat: 'perception', spirituality: 5, paper: false, lamp: true,
  },
  {
    id: 'air-target', title: '空场里的固定靶',
    story: '指导者在无人穿行的封闭练习方向固定一块厚软木靶，靶后有原木挡板。你从标线向固定靶施展空气弹，场内没有作为练习目标的人或动物。',
    result: '空气弹打在眼前原固定靶上，指导者核对这一次落点；没有自动命中远处敌人，也没有获得枪支或弹药。',
    stat: 'perception', spirituality: 2, paper: false, lamp: false,
  },
  {
    id: 'consenting-audience', title: '观众知道这是幻象',
    story: '几位成年剧场工作人员事先同意观看感官幻术。你在原空桌上呈现彩色花影、短促铃声与花香，结束后请他们分别说出见到、听到和闻到的内容。',
    result: '观众分别辨认了颜色、声音与气味，演示结束后仍知道原桌是空的。没有真实花束、心智控制或记忆改写。',
    stat: 'will', spirituality: 2, paper: false, lamp: false,
  },
  {
    id: 'shallow-water', title: '水面下的一次呼吸',
    story: '场方开放岸边有台阶的浅水练习池，指导者在岸上照看。你只到水面下1米处，维持一条真实通向眼前水面的空气管道，随后沿原台阶上岸；不进入超过5米的深处。',
    result: '你借通往水面的空气管道完成短暂水下呼吸，再沿原台阶上岸；没有无限深潜、隔绝空气或跨水域移动。',
    stat: 'will', spirituality: 2, paper: false, lamp: false,
  },
  {
    id: 'loose-rope', title: '随时能解开的绳圈',
    story: '一位成年道具师征得你的同意后，用原道具绳在手腕外留出松绳圈，并站在伸手可及处随时解开。没有锁、勒颈或强制捆绑；你练习骨骼软化退出原绳圈，失败就由本人解开。',
    result: '你通过骨骼软化退出眼前的松绳圈，道具师收回自己的原绳；没有隔空开锁或穿过实体障碍。',
    stat: 'physique', spirituality: 2, paper: false, lamp: false,
  },
  {
    id: 'paper-weapon', title: '原纸只能用这一次',
    story: '在同一无人靶区，将实际持有的一张原纸暂时化为纸张武器，向固定软木靶完成一次动作。用后的纸收进场方废纸盒，不成为永久装备，也不回到库存。',
    result: '你用这一张真实原纸完成暂时武器的动作，原纸已经消耗；没有复制纸料或永久增加装备。',
    stat: 'physique', spirituality: 1, paper: true, lamp: false,
  },
] as const;
const MAGICIAN_FEEDBACK_DISPUTE = '成年道具搬运工莉亚正抱着剧院原道具箱经过公开侧巷，普通工人莫里持短棍拦住原通路，要求一笔拿不出凭据的搬运费。箱子始终由莉亚持有并归剧院；你可以当面请他核对原通行记录，也可以承担真实伤亡风险介入。撤退不会把莉亚或道具箱自动带走。';

/** Attach only this fresh command's public roll to a display copy, never to saved history. */
export function magicianCheckFeedback(record: SliceRecord, current: SliceProjection | null,
  envelope: SliceEnvelope, receipt: SliceReceipt): SliceRecord {
  const next = receipt.state, check = next.lastCheck;
  if (!current || receipt.replayed || current.runId !== envelope.runId || receipt.runId !== envelope.runId
    || next.runId !== envelope.runId || current.revision !== envelope.expectedRevision
    || receipt.intentId !== envelope.intentId || receipt.previousRevision !== current.revision
    || receipt.newRevision !== next.revision || next.revision !== current.revision + 1
    || current.progression.pathwayId !== 'diviner' || current.progression.sequence !== 7
    || next.progression.pathwayId !== 'diviner' || next.progression.sequence !== 7
    || envelope.payload.type !== 'MAGICIAN' || !check
    || record.week !== current.week || current.chronicle.some(row => row.id === record.id)
    || !next.chronicle.some(row => row.id === record.id && row.week === record.week
      && row.title === record.title && row.text === record.text)) return record;
  const command = envelope.payload.command;
  if (command.type !== 'PRACTICE' && command.type !== 'ENCOUNTER_TALK') return record;
  if (!current.magician.actions.some(action => action.enabled && action.command.type === command.type
    && (command.type !== 'PRACTICE' || action.command.type === 'PRACTICE'
      && action.command.practiceId === command.practiceId))) return record;
  const success = check.tier === 'SUCCESS' || check.tier === 'GREAT_SUCCESS';
  let title: string, text: string, ability: 'will' | 'perception' | 'physique';
  const difficulty = 14;
  if (command.type === 'ENCOUNTER_TALK') {
    ability = 'will';
    title = success ? '原道具箱沿原路送达' : '当面交涉暂未奏效';
    text = `${MAGICIAN_FEEDBACK_DISPUTE} ${success
      ? '你请莉亚出示当面持有的原通行记录，莫里核对后让开。莉亚自己抱着原箱走回剧院；扮演+20，单项掌握+8，没有战利品或心智控制。'
      : '莫里没有让路，莉亚仍在现场抱着原箱。没有凭空移动人或物，也没有成长奖励；下周可再谈。'}`;
  } else {
    const lesson = MAGICIAN_FEEDBACK_PRACTICES.find(row => row.id === command.practiceId);
    if (!lesson) return record;
    ability = lesson.stat; title = lesson.title;
    text = `${lesson.story} ${success ? `${lesson.result} 扮演+12，已知能力中一项掌握+8。` : '这一次未能稳定完成。指导者停止练习，沿原通路收场；没有新增伤势或成长，下周才能重试。'} 本次行动与${lesson.spirituality}灵性已经消耗${lesson.paper ? '，用过的原纸不退回' : ''}${lesson.lamp ? '，随身油灯已经熄灭，原灯油不退回' : ''}。`;
  }
  if (record.title !== title || record.text !== text || check.ability !== ability
    || check.difficulty !== difficulty || check.baseAbility !== current.character.coreStats[ability]
    || check.modifiers.length !== 0 || check.effectiveAbility !== check.baseAbility
    || !Number.isInteger(check.roll) || check.roll < 1 || check.roll > 100
    || !Number.isInteger(check.chance) || check.chance < 5 || check.chance > 95
    || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(check.tier)) return record;
  const labels = { will: '意志', perception: '感知', physique: '体质' };
  return { ...record, text: `${labels[ability]}难度${check.difficulty} · 成功率${check.chance}% · 骰点${check.roll}。${record.text}` };
}

// Exact public S6 preparation and narrative signatures; unknown methods fail closed.
const FACELESS_FEEDBACK_CASES = [
  {
    id: 'stage-double', title: '经过同意的舞台替身', stat: 'perception',
    ability: '准备观察过的舞台模板；须另明确变化外貌与声线、借原外套，再按排练顺序发出已经听过的短句。',
    ordinary: '以本人原貌原声读台词，靠原台本、走位和普通配合完成替身排练，不冒充本人。',
    result: '这次替身只在约定排练内成立。外貌与声音相似没有带来阿伦的记忆、知识、身份或服装；原道具服仍须真实归还。',
  },
  {
    id: 'familiar-manner', title: '熟人认出的一个小习惯', stat: 'knowledge',
    ability: '准备已见的搬运工模板；另变化外貌与声线、借同一原道具外套，真实读出示范短句并核对熟人指出的步态差别。',
    ordinary: '以本人原貌原声按原台本排练，用普通观察比较左右脚习惯，接受同伴指出差别。',
    result: '艾达指出了举止差别。你记录“外形相似，熟人仍能识破习惯”，没有把通过判定写成完美冒充或获得他人的知识。',
  },
  {
    id: 'remember-self', title: '扮演结束后记住自己', stat: 'will',
    ability: '用已观察的搬运工模板和真实借来的原外套完成角色片段，再明确复原本人外貌与原声，归还同一原外套后报告。',
    ordinary: '以本人原貌原声读角色台本，区分角色经历与自己的真实经历，再结束练习并报告。',
    result: '你明确区分了自己与台本角色。本人原姓名、经历和生理器官没有被外貌模板改写；若曾变化，本次确实主动恢复了本人外貌与原声。',
  },
] as const;

/** Bind the public roll to this fresh S6 action's display copy only. */
export function facelessCheckFeedback(record: SliceRecord, current: SliceProjection | null,
  envelope: SliceEnvelope, receipt: SliceReceipt): SliceRecord {
  const next = receipt.state, check = next.lastCheck;
  if (!current || receipt.replayed || current.runId !== envelope.runId || receipt.runId !== envelope.runId
    || next.runId !== envelope.runId || current.revision !== envelope.expectedRevision
    || receipt.intentId !== envelope.intentId || receipt.previousRevision !== current.revision
    || receipt.newRevision !== next.revision || next.revision !== current.revision + 1
    || current.progression.pathwayId !== 'diviner' || current.progression.sequence !== 6
    || next.progression.pathwayId !== 'diviner' || next.progression.sequence !== 6
    || envelope.payload.type !== 'FACELESS' || !check
    || record.week !== current.week || current.chronicle.some(row => row.id === record.id)
    || !next.chronicle.some(row => row.id === record.id && row.week === record.week
      && row.title === record.title && row.text === record.text)) return record;
  const command = envelope.payload.command;
  if (command.type !== 'PERFORM' && command.type !== 'ENCOUNTER_TALK') return record;
  if (!current.faceless.actions.some(action => action.enabled && action.command.type === command.type
    && (command.type !== 'PERFORM' || action.command.type === 'PERFORM'
      && action.command.caseId === command.caseId))) return record;
  const success = check.tier === 'SUCCESS' || check.tier === 'GREAT_SUCCESS';
  const caseId = command.type === 'PERFORM' ? command.caseId : 'faceless-dispute';
  const before = current.faceless.cases.find(row => row.id === caseId);
  const after = next.faceless.cases.find(row => row.id === caseId);
  if (!before || !after) return record;
  let title: string, text: string, ability: 'will' | 'perception' | 'knowledge', difficulty: number;
  if (command.type === 'ENCOUNTER_TALK') {
    if (before.title !== '原排练室后门的交接误会' || after.title !== before.title
      || before.status !== 'AVAILABLE' || after.status !== (success ? 'RESOLVED' : 'AVAILABLE')
      || before.contactOpen !== '没有进行中的后门战斗' || after.contactOpen !== before.contactOpen
      || after.result !== (success ? '争议已有结果，原短棍没有转为你的物品。' : '此前交涉没有让对方同意，原现场与退出路线保留。')) return record;
    ability = 'will'; difficulty = 16;
    title = success ? '原通路重新开放' : '达恩仍不愿让路';
    text = success ? '达恩接受交接澄清并自行让路；没有改写他的记忆，没有额外扮演奖励，当前外貌仍保留。'
      : '本次交涉花费1行动，未改写对方意愿；可以离开，之后下周再交涉，或选择承担真实战斗风险。';
  } else {
    const lesson = FACELESS_FEEDBACK_CASES.find(row => row.id === command.caseId);
    if (!lesson || before.title !== lesson.title || after.title !== lesson.title
      || before.status !== 'PREPARED' || after.status !== (success ? 'EXAMINED' : 'OBSERVED')
      || before.contactOpen !== '没有尚未结束的练习；当前外貌另行记录'
      || after.contactOpen !== '本次练习尚未结束；可0行动停止或主动复原'
      || after.preparation !== null
      || after.result !== (success ? lesson.id === 'remember-self'
        ? '角色片段已完成，尚须按当前状态结束、复原并归还原服，才可报告。' : lesson.result
        : '此前练习不足，已付成本、原外貌与原服历史保留，可在下一周再准备。')) return record;
    if (before.preparation === lesson.ability) { ability = lesson.stat; difficulty = 10; }
    else if (before.preparation === lesson.ordinary) { ability = 'knowledge'; difficulty = 12; }
    else return record;
    title = lesson.title;
    text = success ? `${lesson.id === 'remember-self'
      ? '角色片段已经完成；还须明确复原本人外貌与原声，才足以提交自我报告。' : lesson.result}先0行动结束练习。`
      : `这次练习不足以支持结论。${check.tier === 'GREAT_FAILURE' ? '额外疲劳，精神损失至多5。' : ''}外貌与原服装仍保持，已付成本不返还；先实际结束接触，下周可再准备，也可改走普通方法。`;
  }
  if (record.title !== title || record.text !== text || check.ability !== ability
    || check.difficulty !== difficulty || check.baseAbility !== current.character.coreStats[ability]
    || check.modifiers.length !== 0 || check.effectiveAbility !== check.baseAbility
    || !Number.isInteger(check.roll) || check.roll < 1 || check.roll > 100
    || !Number.isInteger(check.chance) || check.chance < 5 || check.chance > 95
    || !['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'].includes(check.tier)) return record;
  const labels = { will: '意志', perception: '感知', knowledge: '知识' };
  return { ...record, text: `${labels[ability]}难度${check.difficulty} · 成功率${check.chance}% · 骰点${check.roll}。${seerFeedbackText(record, false)}` };
}
