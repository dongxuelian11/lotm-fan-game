import type { SliceRecord } from '../domain/slice/types';
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
    .replace(/(?<![A-Za-z0-9_:-])(?:第(\d+)瓶现成魔药|原瓶)?hunter-potion-(\d+)(?![A-Za-z0-9_:-])/g,
      (match: string, describedNumber: string | undefined, bottleNumber: string) => {
        if (describedNumber) return describedNumber === bottleNumber ? `第${bottleNumber}瓶现成猎人魔药` : match;
        return `第${bottleNumber}瓶猎人原瓶`;
      });
}

/** Add the current scene around the saved result without rewriting any saved fact. */
export function seerFeedbackText(record: Pick<SliceRecord, 'title' | 'text'>, firstCaseResolved: boolean): string {
  const text = seerReadableText(record.text);
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
