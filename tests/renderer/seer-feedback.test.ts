import { describe, expect, it } from 'vitest';
import { seerFeedbackText, seerReadableText, marionettistPracticeText, marionettistEnvironmentText } from '../../src/renderer/seer-feedback';

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


it('labels exact Provoker originals and same-number finished-potion delivery without changing raw receipts', () => {
  const raw = '原瓶provoker-potion-12；provoker-potion-1';
  expect(seerReadableText(raw)).toBe('第12瓶挑衅者原瓶；第1瓶挑衅者原瓶');
  const record = { title: '挑衅者原瓶交付', text: '导师将第1瓶序列8成品魔药provoker-potion-1交到你手中，支付170便士，0行动。原瓶尚未服用。' };
  const before = JSON.stringify(record);
  const shown = seerFeedbackText(record, true);
  expect(shown).toBe('导师将第1瓶序列8挑衅者成品魔药交到你手中，支付170便士，0行动。原瓶尚未服用。');
  expect(JSON.stringify(record)).toBe(before);
  expect(seerReadableText(shown)).toBe(shown);
  for (const unknown of ['第2瓶序列8成品魔药provoker-potion-1', '第1瓶序列8成品魔药provoker-potion-1-extra', 'provoker-potion-x', 'provoker-potion-12:bottle', 'provoker-potion-12-extra', 'other-provoker-potion-12', 'provoker-potion-123extra']) expect(seerReadableText(unknown)).toBe(unknown);
});

it('labels exact Mindreader provenance and actual brew receipt without changing recorded facts', () => {
  const source = '阅览室观察导师调配台，第12周；仅由mindreader-batch-1的六项材料调配，原瓶mindreader-batch-1:bottle';
  expect(seerReadableText(source)).toBe('阅览室观察导师调配台，第12周；仅由第1批备料的六项材料调配，第1批读心者原瓶');
  const record = { title: '一瓶读心者魔药', text: '花费1行动、60便士，在导师指导下将第1批六项原材料调配成药。调配须遵守当前导师指导，不能自行把清单排列当作投料顺序。六项材料已全部消耗，得到独立原瓶mindreader-batch-1:bottle，尚未服用。观众扮演100且晋升后满6整周才能确认服药。' };
  const before = JSON.stringify(record), shown = seerFeedbackText(record, false);
  expect(shown).toBe(record.text.replace('原瓶mindreader-batch-1:bottle', '第1批读心者原瓶'));
  expect(JSON.stringify(record)).toBe(before);
  expect(seerReadableText(shown)).toBe(shown);
  expect(seerReadableText('mindreader-batch-12:bottle')).toBe('第12批读心者原瓶');
  expect(seerReadableText('由mindreader-batch-12的六项材料调配')).toBe('由第12批备料的六项材料调配');
  for (const unknown of ['mindreader-batch-x:bottle', 'mindreader-batch-1:unknown', 'mindreader-batch-1:bottle-extra', 'other-mindreader-batch-1:bottle', 'mindreader-batch-123extra', 'mindreader-batch-1:bottle_v2', 'prefixmindreader-batch-1', 'mindreader-batch-1:bottle:next']) {
    expect(seerReadableText(unknown)).toBe(unknown);
  }
});

it('keeps existing potion label outputs while adding Mindreader labels', () => {
  const raw = 'seer-batch-1:bottle；magician-batch-2:bottle；faceless-batch-3:bottle；marionettist-batch-4:bottle；audience-batch-5:bottle；hunter-potion-6；provoker-potion-7；mindreader-batch-8:bottle';
  expect(seerReadableText(raw)).toBe('第1批原瓶；第2批魔术师原瓶；第3批无面人原瓶；第4批秘偶大师原瓶；第5批观众原瓶；第6瓶猎人原瓶；第7瓶挑衅者原瓶；第8批读心者原瓶');
});

it.each([
  ['同一成人与无生命木偶的对照', '你真实观察到阿伦的灵体之线，同时确认原普通木偶没有灵体之线；记录只限原现场两个已知对象，不产生秘偶或后台知识。先0行动CLOSE或WITHDRAW真实结束本次接触，再报告。'],
  ['约定打断后的自主行动复核', '阿伦在本次真实初控中按约拍肩叫停，专注实际中断；乔纳恢复，并由本人自主抬手、走离原站位，已亲眼核实。全部仍为原成年人，没有任何秘偶。先0行动CLOSE或WITHDRAW真实结束本次接触，再报告。'],
  ['五米内短暂初控并主动放开', '在原5米内对自愿成年乔纳实际短时初控，思维和动作变慢，你也因专注受行动限制。未推进完整转化；现在须0行动CLOSE或WITHDRAW实际释放并核实自主行动，不能带着控制离场或过周。'],
])('relabels only the exact saved public success receipt for %s', (title, text) => {
  const record = { title, text }, before = JSON.stringify(record), shown = seerFeedbackText(record, true);
  expect(shown).toContain('0行动选择“实际停止能力、释放并退开”或“结束本次接触并回到生活”');
  expect(shown).not.toMatch(/CLOSE|WITHDRAW/);
  expect(shown).toContain(title === '五米内短暂初控并主动放开' ? '不能带着控制离场或过周。' : '真实结束本次接触，再报告。');
  expect(seerFeedbackText({ title: '其他事件', text }, true)).toBe(text);
  expect(seerFeedbackText({ title, text: text + '未知后续。' }, true)).toBe(text + '未知后续。');
  expect(seerFeedbackText({ title, text: text.replace('CLOSE', 'CLOSE_EXTRA') }, true)).toBe(text.replace('CLOSE', 'CLOSE_EXTRA'));
  expect(seerFeedbackText({ title, text: shown }, true)).toBe(shown);
  expect(JSON.stringify(record)).toBe(before);
});

it('preserves unknown practice sentences, object identifiers and surrounding environment prose', () => {
  const known = '准备时站位稳定，没有施术；实际接触从PERFORM开始。CLOSE与WITHDRAW均0行动，实际停止能力、释放并退开；未实施准备取消不退款。';
  const input = '1行动、3灵性，失败照付。M5-WOOD-1。' + known + '失败须下一真实周再准备，已付灵性不返还。';
  const shown = marionettistEnvironmentText(input);
  expect(shown).toContain('1行动、3灵性，失败照付。M5-WOOD-1。');
  expect(shown).toContain('未实施准备取消不退款。失败须下一真实周再准备，已付灵性不返还。');
  expect(shown).not.toMatch(/PERFORM|CLOSE|WITHDRAW/);
  expect(marionettistEnvironmentText(input.replace('PERFORM', 'PERFORM_EXTRA'))).toBe(input.replace('PERFORM', 'PERFORM_EXTRA'));
  for (const text of ['PERFORM CLOSE WITHDRAW PREPARE', '未知CLOSE_EXTRA说明', 'M5-WOOD-1', '__proto__']) expect(marionettistPracticeText(text)).toBe(text);
});


it('formats only the exact actual rev226 observation receipt without changing stored facts', () => {
  const record = {"id": "record-226-369", "week": 58, "title": "五米内短暂初控并主动放开", "text": "成年搬运工乔纳·里德在同一原排练室内自愿参与，与你相距3米，范围始终小于新晋5米起控参考。双方只约定约20秒有限初控及实际释放，绝不推进约5分钟完整转化；原人始终存活。PREPARE只核对本人同意与稳定站位，PERFORM才开始真实接触。 初控成功会使思维、动作变慢，你的专注也限制自身动作；个体抗性可使尝试失败。必须0行动CLOSE或WITHDRAW实际释放后才可报告。"};
  const before = JSON.stringify(record);
  const shown = seerFeedbackText(record, true);
  expect(shown.startsWith("成年搬运工乔纳·里德在同一原排练室内自愿参与，与你相距3米，范围始终小于新晋5米起控参考。双方只约定约20秒有限初控及实际释放，绝不推进约5分钟完整转化；原人始终存活。")).toBe(true);
  expect(shown).toContain(marionettistPracticeText("PREPARE只核对本人同意与稳定站位，PERFORM才开始真实接触。"));
  expect(shown).toContain(marionettistPracticeText("初控成功会使思维、动作变慢，你的专注也限制自身动作；个体抗性可使尝试失败。必须0行动CLOSE或WITHDRAW实际释放后才可报告。"));
  expect(shown).not.toMatch(/PREPARE|PERFORM|CLOSE|WITHDRAW/);
  expect(JSON.stringify(record)).toBe(before);
  expect(seerFeedbackText({ ...record, text: shown }, true)).toBe(shown);
  for (const changed of [
    { ...record, title: '其他观察' },
    { ...record, text: '未知前缀' + record.text },
    { ...record, text: record.text + '未知后缀' },
    { ...record, text: record.text.replace('PERFORM', 'PERFORM_EXTRA') },
    { ...record, text: record.text.replace('乔纳', '其他人') },
  ]) expect(seerFeedbackText(changed, true)).toBe(changed.text);
});


// Exact loan/return wording observed in read-only rev214, records 207-343 and 210-346.
describe('Faceless original rehearsal coat display label', () => {
  it.each([
    ['FC6-PROP-COAT-1', '原排练道具外套'],
    ['同一原物FC6-PROP-COAT-1，已借1次、已还1次。', '同一件原排练道具外套，已借1次、已还1次。'],
    ['原道具外套FC6-PROP-COAT-1还在衣架上，变脸不能把外套变到身上。', '原排练道具外套还在衣架上，变脸不能把外套变到身上。'],
    ['FC6-PROP-COAT-1从原衣架交到你手中并穿好，0行动。第1次借用只用于约定练习，不因变脸新增或复制衣物。', '原排练道具外套从原衣架交到你手中并穿好，0行动。第1次借用只用于约定练习，不因变脸新增或复制衣物。'],
    ['FC6-PROP-COAT-1脱下并交回原保管员、放回原衣架，0行动。已借1次、已还1次；当前外貌与声线没有改变。', '原排练道具外套脱下并交回原保管员、放回原衣架，0行动。已借1次、已还1次；当前外貌与声线没有改变。'],
  ])('maps only the known original object in %s', (text, expected) => {
    const record = { title: '实际借还原道具', text }; const before = JSON.stringify(record);
    expect(seerReadableText(text)).toBe(expected);
    expect(seerReadableText(expected)).toBe(expected);
    expect(seerFeedbackText(record, false)).toBe(expected);
    expect(JSON.stringify(record)).toBe(before);
  });
  it.each(['FC6-PROP-COAT-10', 'FC6-PROP-COAT-2', 'xFC6-PROP-COAT-1', 'FC6-PROP-COAT-1:copy', 'FC6-PROP-COAT-1_extra'])('preserves unknown object %s', text => {
    expect(seerReadableText(text)).toBe(text);
  });
});

describe('Clown public bottle labels without changing real saved receipts', () => {
  // Observed native run: public records record-57-94 and record-58-95, week 16.
  const records = [
    { title: '一瓶小丑魔药', text: '花费1行动、80便士，把第1批五项辅材依次加入，再投入完整人脸玫瑰，最后加入独角结晶。七项材料已全部消耗，得到独立原瓶clown-batch-1:bottle，尚未服用。占卜家扮演100且晋升后满6整周才能确认服药。' },
    { title: '成为小丑', text: '原瓶clown-batch-1:bottle已耗尽。意志判定41/62，成功：精神−10，体质+6、感知+4、意志+2、知识+1。四项占卜家掌握完整继承，五项小丑能力从0开始；占卜家消化成果保留，小丑扮演从0开始。灵性上限提高到45，当前灵性没有补满。' },
  ];
  it.each(records)('preserves every saved fact in $title while relabeling the original bottle', record => {
    Object.freeze(record);
    const snapshot = JSON.stringify(record);
    const expected = record.text.replace('原瓶clown-batch-1:bottle', '第1批小丑原瓶');
    expect(seerFeedbackText(record, true)).toBe(expected);
    expect(seerReadableText(record.text)).toBe(expected);
    expect(seerReadableText(expected)).toBe(expected);
    expect(JSON.stringify(record)).toBe(snapshot);
  });
  it('labels bottle provenance and later batches while leaving outcome prose intact', () => {
    const source = '占卜俱乐部指导者调配台，第16周；仅由clown-batch-12的七项材料调配，原瓶clown-batch-12:bottle';
    expect(seerReadableText(source)).toBe('占卜俱乐部指导者调配台，第16周；仅由第12批备料的七项材料调配，第12批小丑原瓶');
    expect(seerReadableText('clown-batch-12:bottle')).toBe('第12批小丑原瓶');
    const failure = '原瓶clown-batch-2:bottle已耗尽。意志判定99/62，灾难：精神−40、健康−20、排异+50。你仍是占卜家。';
    expect(seerFeedbackText({ title: '指导者中断了小丑晋升', text: failure }, false)).toBe(failure.replace('原瓶clown-batch-2:bottle', '第2批小丑原瓶'));
  });
  it.each(['clown-batch-x:bottle', 'clown-batch-0:bottle', 'clown-batch-01:bottle', 'clown-batch-12:unknown', 'clown-batch-12:bottle-extra', 'other-clown-batch-12:bottle', 'clown-batch-12_extra', 'clown-batch-123extra'])('keeps unfamiliar identifiers unchanged: %s', unknown => {
    expect(seerReadableText(unknown)).toBe(unknown);
  });
});
