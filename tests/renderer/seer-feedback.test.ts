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

 it('formats magician provenance and failure text without altering the recorded outcome', () => {
  const record = { title: '魔术师魔药发生排异', text: '原瓶magician-batch-1:bottle已耗尽。意志判定58/54，失败：精神−20、健康−10、排异+25。' };
  const before = JSON.stringify(record);
  expect(seerFeedbackText(record, false)).toBe('第1批魔术师原瓶已耗尽。意志判定58/54，失败：精神−20、健康−10、排异+25。');
  expect(JSON.stringify(record)).toBe(before);
  const source = '第24周；仅由magician-batch-2的六项材料调配，原瓶magician-batch-2:bottle';
  const readable = seerReadableText(source);
  expect(readable).toBe('第24周；仅由第2批备料的六项材料调配，第2批魔术师原瓶');
  expect(seerReadableText(readable)).toBe(readable);
 });

 it('formats faceless provenance and outcomes without changing original records', () => {
  const source = '第40周；仅由faceless-batch-12的六项材料调配，原瓶faceless-batch-12:bottle';
  const readable = seerReadableText(source);
  expect(readable).toBe('第40周；仅由第12批备料的六项材料调配，第12批无面人原瓶');
  expect(seerReadableText(readable)).toBe(readable);
  expect(seerReadableText('faceless-batch-12:bottle')).toBe('第12批无面人原瓶');
  const record = { title: '无面人魔药发生排异', text: '原瓶faceless-batch-1:bottle已耗尽。意志判定58/48，失败：精神−20、健康−10、排异+25。' };
  const before = JSON.stringify(record);
  expect(seerFeedbackText(record, false)).toBe('第1批无面人原瓶已耗尽。意志判定58/48，失败：精神−20、健康−10、排异+25。');
  expect(JSON.stringify(record)).toBe(before);
  expect(source).toContain('faceless-batch-12:bottle');
  for (const unknown of ['unrelated-batch-1:bottle', 'faceless-batch-x:bottle', 'faceless-batch-12:unknown', 'faceless-batch-12:bottle-extra', 'other-faceless-batch-12:bottle']) {
    expect(seerReadableText(unknown)).toBe(unknown);
  }
 });


describe('Faceless failed-practice method-neutral retry wording', () => {
  const tail = '下周可再准备，也可改走普通方法。';
  const replacement = '下周可再次准备；普通方法也是可选路线。';
  const titles = ['经过同意的舞台替身', '熟人认出的一个小习惯', '扮演结束后记住自己'];
  it.each(titles)('changes only the known retry tail for %s without assuming a selected method', title => {
    for (const fatigue of ['', '额外疲劳，精神损失至多5。']) {
      const prefix = `这次练习不足以支持结论。${fatigue}外貌与原服装仍保持，已付成本不返还；先实际结束接触，`;
      const record = { title, text: prefix + tail }, before = JSON.stringify(record);
      const display = seerFeedbackText(record, false);
      expect(display).toBe(prefix + replacement);
      expect(JSON.stringify(record)).toBe(before);
      expect(seerFeedbackText({ title, text: display }, false)).toBe(display);
    }
  });
  it.each([
    { title: '其他练习', text: '这次练习不足以支持结论。' + tail },
    { title: titles[0]!, text: '这次练习成功。' + tail },
    { title: titles[1]!, text: '这次练习不足以支持结论。其他新提示。' },
    { title: titles[2]!, text: '这次练习不足以支持结论。' + tail + '新增后续说明。' },
  ])('preserves an unknown title, prefix or tail: $title / $text', record => {
    expect(seerFeedbackText(record, false)).toBe(record.text);
  });
});


describe('Faceless self-report success wording', () => {
  const text = '角色片段已经完成；还须明确复原本人外貌与原声，才足以提交自我报告。先0行动结束练习。';
  it('keeps completion and the zero-action exit without assuming restoration is required', () => {
    const record = { title: '扮演结束后记住自己', text }, before = JSON.stringify(record);
    const display = seerFeedbackText(record, false);
    expect(display).toBe('角色片段已经完成；先0行动结束练习。结束练习后，按当前外貌与原服状态完成必要的复原和归还，再提交自我报告。');
    expect(JSON.stringify(record)).toBe(before);
    expect(seerFeedbackText({ ...record, text: display }, false)).toBe(display);
  });
  it.each([
    { title: '经过同意的舞台替身', text },
    { title: '扮演结束后记住自己', text: text + '其他说明。' },
    { title: '扮演结束后记住自己', text: '其他新成功文案。' },
  ])('preserves unmatched public text: $title / $text', record => {
    expect(seerFeedbackText(record, false)).toBe(record.text);
  });
});


it('formats only known marionettist bottle and material identifiers without changing raw receipts', () => {
  const source = '第52周；仅由marionettist-batch-12的六项材料调配，原瓶marionettist-batch-12:bottle';
  const readable = '第52周；仅由第12批备料的六项材料调配，第12批秘偶大师原瓶';
  expect(seerReadableText(source)).toBe(readable);
  expect(seerReadableText(readable)).toBe(readable);
  expect(seerReadableText('marionettist-batch-12:bottle')).toBe('第12批秘偶大师原瓶');
  const record = { title: '一瓶秘偶大师魔药', text: '六项材料已全部消耗，得到独立原瓶marionettist-batch-1:bottle，尚未服用。无面人扮演100且晋升后满12整周才能确认服药。' };
  const before = JSON.stringify(record);
  expect(seerFeedbackText(record, false)).toBe('六项材料已全部消耗，得到独立第1批秘偶大师原瓶，尚未服用。无面人扮演100且晋升后满12整周才能确认服药。');
  expect(JSON.stringify(record)).toBe(before);
  for (const unknown of ['marionettist-batch-x:bottle', 'marionettist-batch-12:unknown', 'marionettist-batch-12:bottle-extra', 'other-marionettist-batch-12:bottle']) {
    expect(seerReadableText(unknown)).toBe(unknown);
  }
});


it('formats known audience provenance and current receipts without modifying raw records', () => {
  const source = '第3周；仅由audience-batch-12的六项材料调配，原瓶audience-batch-12:bottle';
  const readable = '第3周；仅由第12批备料的六项材料调配，第12批观众原瓶';
  expect(seerReadableText(source)).toBe(readable);
  expect(seerReadableText(readable)).toBe(readable);
  expect(seerReadableText('audience-batch-12:bottle')).toBe('第12批观众原瓶');
  const record = { title: '成为观众', text: '原瓶audience-batch-1:bottle已耗尽。意志判定20/72，成功。' };
  const before = JSON.stringify(record);
  expect(seerFeedbackText(record, false)).toBe('第1批观众原瓶已耗尽。意志判定20/72，成功。');
  expect(JSON.stringify(record)).toBe(before);
  for (const unknown of ['audience-batch-x:bottle', 'audience-batch-12:unknown', 'audience-batch-12:bottle-extra', 'other-audience-batch-12:bottle', 'audience-batch-123extra']) {
    expect(seerReadableText(unknown)).toBe(unknown);
  }
});


it('labels only exact hunter original bottle IDs and preserves recorded facts', () => {
  expect(seerReadableText('原瓶hunter-potion-12。hunter-potion-1')).toBe('第12瓶猎人原瓶。第1瓶猎人原瓶');
  const record = { title: '猎人原瓶交付', text: '导师将第1瓶现成魔药hunter-potion-1交到你手中，支付60便士，0行动。原瓶尚未服用。' };
  const before = JSON.stringify(record), readable = seerFeedbackText(record, false);
  expect(readable).toBe('导师将第1瓶现成猎人魔药交到你手中，支付60便士，0行动。原瓶尚未服用。');
  expect(JSON.stringify(record)).toBe(before);
  expect(seerReadableText(readable)).toBe(readable);
  for (const unknown of ['第2瓶现成魔药hunter-potion-1', '第1瓶现成魔药hunter-potion-1-extra', 'hunter-potion-x', 'hunter-potion-12:bottle', 'hunter-potion-12-extra', 'other-hunter-potion-12', 'hunter-potion-123extra']) expect(seerReadableText(unknown)).toBe(unknown);
});
