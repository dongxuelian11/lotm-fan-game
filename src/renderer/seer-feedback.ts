import type { SliceRecord } from '../domain/slice/types';
import { SEER_MENTOR } from '../domain/seer/content';

/** Display labels only. Historical source strings and chronicle records stay replay-stable. */
export function seerReadableText(text: string): string {
  return text.replace(/(?:原瓶)?seer-batch-(\d+):bottle/g, '第$1批原瓶')
    .replace(/seer-batch-(\d+)/g, '第$1批备料');
}

/** Add the current scene around the saved result without rewriting any saved fact. */
export function seerFeedbackText(record: Pick<SliceRecord, 'title' | 'text'>, firstCaseResolved: boolean): string {
  const text = seerReadableText(record.text);
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
