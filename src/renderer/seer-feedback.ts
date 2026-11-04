import type { SliceEnvelope, SliceReceipt } from '../shared/slice-contracts';
import type { SliceProjection, SliceRecord } from '../domain/slice/types';
import { SEER_MENTOR } from '../domain/seer/content';

/** Display labels only. Historical source strings and chronicle records stay replay-stable. */
export function seerReadableText(text: string): string {
  return text.replace(/(?:原瓶)?seer-batch-(\d+):bottle/g, '第$1批原瓶')
    .replace(/seer-batch-(\d+)/g, '第$1批备料')
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
const MARIONETTIST_SUCCESS_COPY: ReadonlyArray<readonly [string, string, string]> = [
  ['同一成人与无生命木偶的对照', '你真实观察到阿伦的灵体之线，同时确认原普通木偶没有灵体之线；记录只限原现场两个已知对象，不产生秘偶或后台知识。', '先0行动CLOSE或WITHDRAW真实结束本次接触，再报告。'],
  ['约定打断后的自主行动复核', '阿伦在本次真实初控中按约拍肩叫停，专注实际中断；乔纳恢复，并由本人自主抬手、走离原站位，已亲眼核实。全部仍为原成年人，没有任何秘偶。', '先0行动CLOSE或WITHDRAW真实结束本次接触，再报告。'],
  ['五米内短暂初控并主动放开', '在原5米内对自愿成年乔纳实际短时初控，思维和动作变慢，你也因专注受行动限制。未推进完整转化；', '现在须0行动CLOSE或WITHDRAW实际释放并核实自主行动，不能带着控制离场或过周。'],
];

/** Add the current scene around the saved result without rewriting any saved fact. */
export function seerFeedbackText(record: Pick<SliceRecord, 'title' | 'text'>, firstCaseResolved: boolean): string {
  const text = seerReadableText(record.text);
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
