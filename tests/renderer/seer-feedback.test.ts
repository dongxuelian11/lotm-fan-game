import { describe, expect, it } from 'vitest';
import { seerFeedbackText, seerReadableText } from '../../src/renderer/seer-feedback';

const discovered = { title: '一扇安静的门', text: '你拜访了占卜俱乐部指导者。对方愿意指导配方，并说明现有三批备料的购买与劳动交换方式。这次会面没有赋予你非凡能力。' };

describe('Seer scene presentation without rewriting historical records', () => {
  it('adds the named mentor and sensory introduction only to the matching discovery', () => {
    const bytes = JSON.stringify(discovered), text = seerFeedbackText(discovered, false);
    expect(text).toContain('旧纸气味');
    expect(text).toContain('马洛·里德');
    expect(text).toContain('先学会把不知道的事说清楚');
    expect(text.endsWith(discovered.text)).toBe(true);
    expect(JSON.stringify(discovered)).toBe(bytes);
    expect(seerFeedbackText({ ...discovered, text }, false)).toBe(text);
    expect(seerFeedbackText({ ...discovered, title: '其他访客' }, false)).toBe(discovered.text);
  });

  for (const [title, result] of [
    ['成为占卜家', '意志判定1/72，大成功：精神−5，感知+3、意志+2、知识+3。四项非凡能力从0掌握开始，灵性上限提高到30，当前灵性没有补满。'],
    ['成为占卜家', '意志判定20/72，成功：精神−10，感知+3、意志+2、知识+3。四项非凡能力从0掌握开始，灵性上限提高到30，当前灵性没有补满。'],
    ['魔药发生排异', '意志判定90/72，失败：精神−20、健康−10、排异+25。你仍是普通人。指导者处理了现场，未发生死亡；需要休养，重试须另备一瓶。'],
    ['指导者中断了晋升', '意志判定100/72，灾难：精神−40、健康−20、排异+50。你仍是普通人。指导者处理了现场，未发生死亡；需要休养，重试须另备一瓶。'],
  ] as const) it(`shows mentor reaction while preserving the exact ${result.slice(0, 18)} result`, () => {
    const record = { title, text: `原瓶seer-batch-2:bottle已耗尽。${result}` }, bytes = JSON.stringify(record);
    const text = seerFeedbackText(record, true);
    expect(text).toContain('马洛·里德');
    expect(text).toContain(`第2批原瓶已耗尽。${result}`);
    expect(text).not.toContain('seer-batch');
    expect(text).toContain(title === '成为占卜家' ? '蓝布书签' : '今天先休养');
    if (title === '成为占卜家') {
      expect(text).toContain('也别向不知情的人宣讲');
      expect(seerFeedbackText(record, false)).toContain('首案尚未收尾');
      expect(seerFeedbackText(record, false)).not.toContain('蓝布书签');
    }
    expect(JSON.stringify(record)).toBe(bytes);
    expect(seerFeedbackText({ ...record, text }, true)).toBe(text);
  });

  it('keeps existing narrative and unrelated results unchanged', () => {
    const record = { title: '成为占卜家', text: '苦涩沿着舌根散开，马洛·里德说：“先坐稳。”第1批原瓶已耗尽。' };
    expect(seerFeedbackText(record, true)).toBe(record.text);
    expect(seerFeedbackText({ title: '别的事件', text: '本周平静。' }, true)).toBe('本周平静。');
    expect(seerFeedbackText({ title: '其他魔药', text: '原瓶seer-batch-2:bottle已耗尽。' }, true)).toBe('第2批原瓶已耗尽。');
  });

  it('renders saved bottle provenance without internal batch IDs', () => {
    const source = '占卜俱乐部指导者调配台，第5周；仅由seer-batch-1的七项材料调配，原瓶seer-batch-1:bottle';
    expect(seerReadableText(source)).toBe('占卜俱乐部指导者调配台，第5周；仅由第1批备料的七项材料调配，第1批原瓶');
    expect(source).toContain('seer-batch-1:bottle');
  });
});
