/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { WriterPanel, type WriterPanelProps } from '../../src/renderer/WriterPanel.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { projectWriter } from '../../src/domain/writer/index.js';
import { WRITER_ABILITIES, WRITER_CONSUMPTION_RISK, WRITER_INHERITED_ABILITIES, WRITER_PREPARATIONS } from '../../src/domain/writer/content.js';
import type { WriterAction, WriterCommand, WriterProjection } from '../../src/domain/writer/types.js';

afterEach(cleanup);

// Renderer-only UNIT projections. Start with the real default projector and set
// finite public presentation inputs explicitly. These are neither valid saves
// nor a natural campaign. No predecessor history, RNG or promotion is invented.
function action(command: WriterCommand, label: string, cost = '0行动', enabled = true, reason: string | null = null): WriterAction {
  return { id: JSON.stringify(command), command, label, cost, enabled, reason };
}
let defaultProjection: WriterProjection | undefined;
function fixture(promoted = false): WriterProjection {
  const value = structuredClone(defaultProjection ??= projectWriter(createSliceRun('writer-panel-unit', sliceDefaultCreationSelection, 'writer-panel-unit')));
  Object.assign(value, {
    title: '作家·观众序列1', characterName: '莉娜', discovered: true, guidanceKnown: promoted, promoted,
    story: '指导者介绍独立封存的作家成品魔药。', supplies: '每瓶6400便士，完成本瓶五项劳动后支付900便士。',
    nextStep: '按实际状态决定下一步。', preparedWeek: null,
    digestion: promoted ? '作家扮演0/100，普通完成同样可以报告。' : '洞悉者消化100，晋升后须12整周。',
    pollution: 0, risk: WRITER_CONSUMPTION_RISK, acting: 0,
    resources: { health: 98, maxHealth: 100, mind: 98, maxMind: 100, spirituality: 120, maxSpirituality: 120, cash: '560便士', actionsRemaining: 1 },
    injuries: [], injuryRisk: 0, currentGender: 'FEMALE', originalGender: 'FEMALE',
    appearanceRecord: '当前女性，原年龄、特质与已有身体记录保留。', inheritedHistory: [],
    inheritedTools: '旧人物与原物维持各自的实际去向。', insideCase: false,
    environment: '原书与阅读室中的人各有唯一身份。',
  } satisfies Partial<WriterProjection>);
  value.bottles = [1, 2, 3].map(number => ({ id: `writer-potion-${number}`, title: `第${number}瓶 · 作家成品魔药`,
    source: `第${number}瓶独立封存，单独交付与耗用。`, status: '供应方保管 · 劳动0/5', chance: 68,
    command: { type: 'CONSUME', bottleId: `writer-potion-${number}`, confirmed: true } }));
  value.preparations = WRITER_PREPARATIONS.map(item => ({ taskId: item.id, title: item.title, completedWeek: null }));
  // Eight zero entries are explicit finite renderer inputs, not claims about a replay.
  value.abilities = promoted ? [...WRITER_INHERITED_ABILITIES.map((item, index) => ({ ...item, mastery: index < 8 ? 0 : 8 })),
    ...WRITER_ABILITIES.map(item => ({ ...item, mastery: 0 }))] : [];
  value.actions = promoted ? [
    action({ type: 'OBSERVE', caseId: 'mutual-clue' }, '观察原书与现有记录', '1行动'),
    action({ type: 'OBSERVE', caseId: 'scheduled-return' }, '观察原还书路线', '1行动', false, '先完成上一案。'),
    action({ type: 'ENCOUNTER_TALK' }, '亲自到石庭交谈', '1行动', false, '先完成三份报告与反思。'),
  ] : [action({ type: 'LEARN_GUIDANCE' }, '听取作家成品与专业准备指导', '1行动 · 500便士')];
  value.preferredActionId = value.actions[0]!.id;
  if (promoted) {
    value.life.title = '两个名字与一本原书';
    value.life.source = '同一阅读室中的三项有限实践。';
    value.life.environment = '本人、原书与两位成年人须实际走完六米通路，撤回许可后只按当前同意普通办理。';
    value.life.cases = ([
      { id: 'mutual-clue', title: '互知线索与原书标记', story: '先当面介绍姓名与已完成的原报告，再按当前同意核对原书。' },
      { id: 'scheduled-return', title: '一次待发生的还书', story: '托马斯本来想归还伊芙琳的原书。' },
      { id: 'withdrawn-request', title: '撤回之后普通归还', story: '超凡许可可撤回，原书仍须按当前许可普通归还。' },
    ] as const).map<WriterProjection['life']['cases'][number]>(item => ({ ...item, observations: [], status: 'AVAILABLE', contactOpen: false,
      permission: { ability: 'UNKNOWN', material: 'UNKNOWN' }, preparation: null, result: null, returned: false, attempts: [] }));
  }
  return value;
}
function show(value = fixture(), extra: Partial<WriterPanelProps> = {}) {
  const onCommand = vi.fn();
  return { ...render(<WriterPanel value={value} busy={false} onCommand={onCommand} {...extra} />), onCommand };
}
const primary = () => within(screen.getByRole('region', { name: '当前主要操作' })).getByRole('button');
const disabled = (control: HTMLElement) => (control as HTMLButtonElement).disabled;
const picker = () => screen.getByRole('combobox', { name: '作家目标' });
const resources = () => screen.getAllByRole('region', { name: '作家当前资源' })[0]!;
function openPrimary() { fireEvent.click(primary()); return screen.getByRole('dialog', { name: '作家操作确认' }); }
function confirm(dialog = screen.getByRole('dialog')) { return within(dialog).getByRole('button', { name: /^(确认执行这一次操作|确认服用这一原瓶|确认开始真实交战)$/ }); }
function chooseExtra(id: string) {
  const select = screen.getByRole('combobox', { name: '作家其他操作', hidden: true });
  (select.closest('details') as HTMLDetailsElement).open = true;
  fireEvent.change(select, { target: { value: id } });
}
const editorial = /候选|原创G|本作G|原文未核|编号推断|\b(NEAR|FAR|READING_ROOM|COURT|RESISTING)\b|"command"|"before"/;

describe('Writer panel: compact stages, exact original bottles and inherited facts', () => {
  it('shows finite actual resources without inventing an injury or a clinic requirement', () => {
    const value = fixture(), before = structuredClone(value), view = show(value);
    expect(screen.getByRole('heading', { name: value.title })).toBeTruthy();
    expect(resources().textContent).toContain('健康98/100 · 精神98/100 · 灵性120/120 · 排异0');
    expect(resources().textContent).toContain('560便士 · 本周行动1 · 现有伤势0处 · 累计风险0');
    expect(screen.getByRole('region', { name: '作家阶段总览' }).textContent).toContain('专业准备0/3');
    expect(within(picker()).getAllByRole('option')).toHaveLength(3);
    expect(primary().textContent).toContain('1行动 · 500便士');
    expect(view.container.textContent).not.toMatch(/必须诊疗|先去诊所/);
    expect(view.container.textContent).not.toMatch(editorial);
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('shows existing injury severity, treatment and risk without modifying them', () => {
    const value = fixture(); value.injuries = [{ id: 'unit-old-injury', severity: 'HEAVY', treated: true }]; value.injuryRisk = 9;
    const before = structuredClone(value), view = show(value);
    expect(resources().textContent).toContain('现有伤势1处 · 累计风险9');
    expect(resources().textContent).toContain('伤势1：重伤 · 已经实际治疗');
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('uses the preferred public action and keeps secondary choices collapsed', () => {
    const value = fixture(); value.actions.push(action({ type: 'PREPARE_TASK', taskId: 'CHECK_LIMITS' }, '检查互知与安排边界', '1行动'));
    value.preferredActionId = value.actions[1]!.id;
    const view = show(value);
    expect(primary().textContent).toContain('检查互知与安排边界');
    expect((screen.getByText('其他操作与普通替代').closest('details') as HTMLDetailsElement).open).toBe(false);
    chooseExtra(value.actions[0]!.id); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('selects the exact owned original bottle during paid preparation and submits once only after confirmation', () => {
    const value = fixture(); value.preparedWeek = 138; value.insideCase = true;
    value.bottles[0]!.status = value.bottles[1]!.status = '已交付，尚未服用';
    value.actions = value.bottles.slice(0, 2).map(bottle => action(bottle.command, `独立确认服用${bottle.title}`, '0行动 · 当周准备已付140便士'));
    value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value);
    expect(disabled(picker())).toBe(false); fireEvent.change(picker(), { target: { value: value.bottles[1]!.id } });
    expect(view.onCommand).not.toHaveBeenCalled();
    const dialog = openPrimary(); expect(dialog.textContent).toContain('第2瓶独立封存');
    expect(dialog.textContent).toContain('当前成功率68%'); expect(dialog.textContent).toContain('健康−15、精神−25、排异+30');
    expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备');
    fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith(value.bottles[1]!.command); expect(value).toEqual(before);
  });

  it('keeps a locally selected original bottle after a changed saved projection', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<WriterPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.change(picker(), { target: { value: 'writer-potion-2' } });
    const saved = structuredClone(value); saved.bottles[1]!.status = '供应方保管 · 劳动1/5';
    view.rerender(<WriterPanel value={saved} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('第2瓶独立封存');
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('劳动1/5'); expect(onCommand).not.toHaveBeenCalled();
  });

  it('shows all 23 inherited masteries including eight zeros and both new zero-masteries unchanged', () => {
    const value = fixture(true), before = structuredClone(value), view = show(value);
    const fold = screen.getByText('能力、消化与继承经历').closest('details')!; fold.open = true;
    expect(value.abilities).toHaveLength(25); expect(value.abilities.slice(0, 23).filter(item => item.mastery === 0)).toHaveLength(8);
    for (const ability of value.abilities) expect(within(fold).getByRole('heading', { name: `${ability.label} · 掌握${ability.mastery}` })).toBeTruthy();
    expect(view.container.textContent).not.toMatch(editorial); expect(value).toEqual(before);
  });

  it('preserves a custom character name exactly in identity fields and interpolated prose', () => {
    const value = fixture(); value.characterName = '原创G候选'; value.appearanceRecord = `${value.characterName}保有自己的身份。`;
    value.actions[0]!.label = `请${value.characterName}听取指导`;
    const view = show(value); expect(resources().textContent).toContain('原创G候选');
    expect(primary().textContent).toContain('请原创G候选听取指导');
    expect(view.container.textContent).toContain('原创G候选保有自己的身份。');
  });

  it('shows saved failed-potion damage and the spent original without another consumption', () => {
    const value = fixture(), bottle = value.bottles[0]!; value.preparedWeek = 138; value.insideCase = true;
    value.actions = [action(bottle.command, '独立确认服用第1瓶作家魔药')];
    const onCommand = vi.fn(), view = render(<WriterPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(confirm(openPrimary()));
    view.rerender(<WriterPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    const saved = structuredClone(value); saved.bottles[0]!.status = '原瓶已耗尽 · 排异，仍为洞悉者';
    saved.preparedWeek = null; saved.insideCase = false; saved.resources!.health = 83; saved.resources!.mind = 73; saved.pollution = 30;
    saved.actions = [action({ type: 'BUY_POTION', bottleId: saved.bottles[1]!.id }, '取得第2瓶原药', '6400便士')];
    view.rerender(<WriterPanel value={saved} busy={false} onCommand={onCommand} />);
    fireEvent.change(picker(), { target: { value: bottle.id } });
    expect(resources().textContent).toContain('健康83/100 · 精神73/100 · 灵性120/120 · 排异30');
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('原瓶已耗尽');
    expect(screen.queryByRole('dialog')).toBeNull(); expect(saved.injuries).toEqual([]);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(bottle.command);
  });
});

describe('Writer panel: real confirmation, focus and same-save retry protection', () => {
  it('traps focus, disables background controls and restores the initiating control on cancel and Escape', () => {
    const onClose = vi.fn(), view = show(fixture(), { onClose }), button = primary(), dialog = openPrimary();
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: '听取作家成品与专业准备指导' }));
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(confirm(dialog));
    fireEvent.keyDown(dialog, { key: 'Tab' }); expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    expect(disabled(picker())).toBe(true); expect(disabled(screen.getByRole('button', { name: '返回普通生活' }))).toBe(true);
    expect(button.closest('[inert]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(button);
    fireEvent.keyDown(openPrimary(), { key: 'Escape' }); expect(document.activeElement).toBe(button);
    expect(onClose).not.toHaveBeenCalled(); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('does not release a submitted intent when rerendered with identical facts', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<WriterPanel value={value} busy={false} onCommand={onCommand} />);
    const dialog = openPrimary(); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    view.rerender(<WriterPanel value={structuredClone(value)} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true); expect(disabled(within(dialog).getByRole('button', { name: '取消，返回查看' }))).toBe(true);
    fireEvent.keyDown(dialog, { key: 'Escape' }); expect(screen.getByRole('dialog')).toBe(dialog);
    expect(screen.getByRole('status').textContent).toContain('正在结算并保存');
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEARN_GUIDANCE' });
  });

  it('closes an unsubmitted confirmation on an error without dispatching', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<WriterPanel value={value} busy={false} onCommand={onCommand} />);
    openPrimary(); view.rerender(<WriterPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(disabled(primary())).toBe(true);
    expect(screen.getByRole('alert').textContent).toContain('上次已保存的记录');
    expect(screen.getByRole('alert').textContent).toContain('同一次保存'); expect(onCommand).not.toHaveBeenCalled();
  });

  it('keeps an intent locked across failure and error clearing until a changed committed projection arrives', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<WriterPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(confirm(openPrimary()));
    view.rerender(<WriterPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    view.rerender(<WriterPanel value={value} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true); fireEvent.click(primary()); expect(onCommand).toHaveBeenCalledTimes(1);
    const saved = structuredClone(value); saved.guidanceKnown = true; saved.resources!.cash = '60便士'; saved.resources!.actionsRemaining = 0;
    saved.actions = [action({ type: 'PREPARE_TASK', taskId: 'REVIEW_RECORDS' }, '核对八阶原瓶与既往报告', '1行动', false, '本周行动不足。')];
    view.rerender(<WriterPanel value={saved} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('status')).toBeNull(); expect(document.activeElement).toBe(screen.getByRole('heading', { name: saved.title }));
    expect(resources().textContent).toContain('60便士'); expect(disabled(primary())).toBe(true); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it('waits for busy to clear before releasing a saved change', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<WriterPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(confirm(openPrimary())); const saved = structuredClone(value); saved.resources!.cash = '60便士';
    view.rerender(<WriterPanel value={saved} busy onCommand={onCommand} />); expect(disabled(primary())).toBe(true);
    view.rerender(<WriterPanel value={saved} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(false); expect(screen.queryByRole('status')).toBeNull(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it('invalidates a stale confirmation when an action id is reused with a different command', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<WriterPanel value={value} busy={false} onCommand={onCommand} />);
    const stale = confirm(openPrimary()), changed = structuredClone(value); changed.actions[0]!.command = { type: 'PREPARE_TASK', taskId: 'MARK_EXIT' };
    view.rerender(<WriterPanel value={changed} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull(); fireEvent.click(stale); expect(onCommand).not.toHaveBeenCalled();
  });

  it.each([{ busy: true }, { blocked: true }, { error: '尚未保存' }])('prevents actions and view exit while externally locked: %j', extra => {
    const onClose = vi.fn(), view = show(fixture(), { ...extra, onClose });
    expect(disabled(primary())).toBe(true); fireEvent.click(primary()); fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(screen.queryByRole('dialog')).toBeNull(); expect(view.onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps a dead body read-only even if a stale action still says enabled', () => {
    const value = fixture(true); value.resources!.health = 0; const view = show(value);
    expect(disabled(primary())).toBe(true); expect(view.container.textContent).toContain('本周目已经死亡');
    fireEvent.click(primary()); expect(view.onCommand).not.toHaveBeenCalled();
  });
});

describe('Writer panel: original people, physical ordinary alternatives and pending return', () => {
  function inside(caseId: 'mutual-clue' | 'scheduled-return' | 'withdrawn-request' = 'mutual-clue') {
    const value = fixture(true); value.insideCase = value.life.insideCase = true;
    value.life.practice.activeCase = caseId; value.life.practice.ownerNode = 'FAR';
    value.life.practice.ownerWalkedMetres = 6; value.life.practice.elapsedSeconds = 12;
    value.life.practice.participants.forEach(person => { person.present = true; person.node = person.id === 'WR1-EVELYN' ? 'FAR' : 'NEAR'; });
    value.life.practice.record.node = 'FAR';
    const entry = value.life.cases.find(item => item.id === caseId)!; entry.status = 'ACTIVE'; entry.contactOpen = true;
    return value;
  }

  it('shows independent originals and actual positions without moving anything on render or close', () => {
    const value = inside(), before = structuredClone(value), onClose = vi.fn(), view = show(value, { onClose });
    expect(disabled(picker())).toBe(true); expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    const originals = screen.getByRole('region', { name: '原书、门铃与实际位置' });
    expect(originals.textContent).toContain('本人在六米外原远桌，已实际步行6米');
    expect(originals.textContent).toContain('现场累计经过12秒');
    expect(screen.getByRole('region', { name: '阅读室原两位成年人' }).textContent).toContain('伊芙琳·赛尔');
    expect(screen.getByRole('region', { name: '阅读室原两位成年人' }).textContent).toContain('托马斯·里德');
    expect(view.container.textContent).not.toMatch(editorial); expect(value).toEqual(before); expect(onClose).not.toHaveBeenCalled();
  });

  it('uses current revoked permission, keeps existing facts, and submits only the projected ordinary return', () => {
    const value = inside('withdrawn-request'), entry = value.life.cases.find(item => item.id === 'withdrawn-request')!;
    entry.permission = { ability: 'WITHDRAWN', material: 'GRANTED' };
    entry.attempts = [{ invitedWeek: 140, method: 'ORDINARY', outcome: null,
      evidence: { abilityAttempted: false, abilityApplied: false, returned: false, aborted: false, permission: { ability: 'WITHDRAWN', material: 'GRANTED' }, result: 'NONE' }, receipts: [] }];
    value.actions = [action({ type: 'ORDINARY_RETURN' }, '按当前许可普通归还原书', '0行动 · 实际步行与交接')];
    const before = structuredClone(value), view = show(value);
    const consent = screen.getByRole('region', { name: '本次许可与实际消耗' });
    expect(consent.textContent).toContain('超凡许可已经撤回'); expect(consent.textContent).toContain('原物操作许可：当前明确同意');
    fireEvent.click(confirm(openPrimary())); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'ORDINARY_RETURN' }); expect(value).toEqual(before);
  });

  it('shows paid failed ability costs without awarding mastery or redoing the result', () => {
    const value = inside(), entry = value.life.cases[0]!;
    entry.permission = { ability: 'GRANTED', material: 'GRANTED' };
    entry.attempts = [{ invitedWeek: 140, method: 'ABILITY', outcome: 'FAILURE',
      evidence: { abilityAttempted: true, abilityApplied: false, returned: false, aborted: false,
        permission: { ability: 'GRANTED', material: 'GRANTED' }, result: 'NONE' },
      // Finite public receipt fields exercise display only, not journal validation.
      receipts: [{ week: 140, date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 2, day: 26 }, revision: 700,
        randomCursor: 20, randomBefore: 20, randomAfter: 21, checkBase: 20, check: null,
        command: { type: 'MUTUAL_INSIGHT' }, outcome: 'FAILURE',
        before: { health: 98, mind: 98, spirituality: 120, cash: 540, actions: 1 },
        after: { health: 98, mind: 96, spirituality: 114, cash: 540, actions: 1 },
        elapsedSeconds: 5, ownerWalkedMetres: 0, bookTravelMetres: 0, participantWalks: [] }] }];
    value.resources!.mind = 96; value.resources!.spirituality = 114;
    value.life.practice.abilityUses['audience.s1.reciprocal-insight'] = { attempts: 1, successes: 0, applied: 0 };
    value.actions = [action({ type: 'TAKE_BOOK' }, '按许可亲取原书普通核对', '0行动')];
    const before = structuredClone(value), view = show(value);
    const costs = screen.getByRole('region', { name: '本次许可与实际消耗' });
    expect(costs.textContent).toContain('能力判定：失败'); expect(costs.textContent).toContain('没有计作能力成功');
    expect(costs.textContent).toContain('本次实耗6灵性、2精神、0健康、0便士');
    expect(view.container.textContent).toContain('互知线索：尝试1次、成功0次、实际生效0次');
    fireEvent.click(confirm(openPrimary())); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'TAKE_BOOK' }); expect(value).toEqual(before);
  });

  it('shows a remaining pending window without executing or inventing a completed return', () => {
    const value = inside('scheduled-return'), p = value.life.practice; p.elapsedSeconds = 22;
    p.pendingArrangement = { caseId: 'scheduled-return', createdAt: 12, executeAt: 42, doorRevision: p.door.revision, permissionRevision: 1 };
    value.actions = [action({ type: 'WAIT_ARRANGEMENT' }, '明确等待本次安排', '0行动 · 经过剩余20秒'),
      { ...action({ type: 'CANCEL_ARRANGEMENT' }, '取消待发生安排', '0行动 · 不退款'), cleanup: true }];
    value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value);
    expect(screen.getByRole('region', { name: '合理安排的当前窗口' }).textContent).toContain('还剩20秒');
    expect(screen.getByRole('region', { name: '合理安排的当前窗口' }).textContent).toContain('关门或撤回许可可使它失效');
    const cancel = within(screen.getByRole('region', { name: '恢复与收尾' })).getByRole('button');
    fireEvent.click(cancel); fireEvent.click(confirm()); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'CANCEL_ARRANGEMENT' }); expect(value).toEqual(before);
  });

  it('exposes every cleanup option and keeps safe abort an actual separate command', () => {
    const value = inside(); value.actions = [action({ type: 'INTRODUCE' }, '亲自介绍并展示原报告'),
      ...([['CANCEL_ARRANGEMENT', '取消待发生安排'], ['RETURN_BOOK', '亲自归还原书'], ['RETURN_HOME', '沿原路返回'], ['ABORT', '安全归还并中止']] as const).map(([type, label]) => ({ ...action({ type }, label, '0行动 · 保留代价'), cleanup: true }))];
    value.preferredActionId = value.actions[0]!.id; const view = show(value);
    const options = within(screen.getByRole('region', { name: '恢复与收尾' })).getAllByRole('button'); expect(options).toHaveLength(4);
    fireEvent.click(options[3]!); fireEvent.click(confirm()); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'ABORT' });
  });
});

describe('Writer panel: independent encounter and ordinary exit', () => {
  function ready() {
    const value = fixture(true); value.life.reflected = true; value.encounter.status = 'READY'; value.encounter.inside = value.insideCase = true;
    value.encounter.preparation = { week: 142, actionsPaid: 1 }; value.encounter.scene.playerLocation = 'COURT';
    value.encounter.scene.playerCoordinate = 6; value.encounter.scene.playerTravelMetres = 6; value.encounter.scene.clockSeconds = 6;
    value.encounter.scene.knownPlayerName = value.characterName;
    value.actions = [action({ type: 'ENCOUNTER_FIGHT' }, '选择与卢西安真实交战', '1行动'),
      action({ type: 'SET_POLICY', policy: 'BOTH' }, '允许两项有限技巧', '0行动 · 实际施放另付成本'),
      action({ type: 'LEAVE_ENCOUNTER' }, '沿普通出口和平离开', '0行动 · 实际步行6米')];
    value.encounter.actions = value.actions; value.preferredActionId = value.actions[0]!.id; return value;
  }

  it('allows local viewing of the optional encounter and its blocked reason', () => {
    const view = show(fixture(true)); fireEvent.change(picker(), { target: { value: 'encounter' } });
    expect(screen.getByRole('region', { name: '作家可选真实交战' })).toBeTruthy();
    expect(disabled(primary())).toBe(true); expect(primary().textContent).toContain('亲自到石庭交谈');
    expect(view.container.textContent).toContain('先完成三份报告与反思'); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('requires explicit real-battle confirmation with the independent adult and death consequences', () => {
    const value = ready(), view = show(value), dialog = openPrimary();
    expect(dialog.textContent).toContain('卢西安·维尔'); expect(dialog.textContent).toContain('普通死亡终结本周目');
    expect(view.onCommand).not.toHaveBeenCalled(); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'ENCOUNTER_FIGHT' });
  });

  it('preserves exact policy intent and paid damaged-body/original-rod facts', () => {
    const value = ready(); value.encounter.enemy.health = 63; value.encounter.enemy.mind = 72; value.encounter.enemy.spirituality = 97;
    value.encounter.materials.weapon.location = 'COURT';
    const before = structuredClone(value), view = show(value);
    expect(view.container.textContent).toContain('健康63/100、精神72/100、灵性97/120');
    expect(screen.getByRole('region', { name: '对手的同一原杖' }).textContent).toContain('已落在原石庭地面，完整度100/100');
    expect(view.container.textContent).toContain('两位成年人和旧相识没有到场');
    chooseExtra(value.actions[1]!.id); fireEvent.click(screen.getByRole('button', { name: /允许两项有限技巧/ })); fireEvent.click(confirm());
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'SET_POLICY', policy: 'BOTH' }); expect(value).toEqual(before);
  });

  it('keeps peaceful six-metre departure separate from view navigation and preserves its exact command', () => {
    const value = ready(), onClose = vi.fn(), view = show(value, { onClose });
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    const exit = within(screen.getByRole('region', { name: '恢复与收尾' })).getByRole('button');
    expect(exit.textContent).toContain('实际步行6米'); fireEvent.click(exit); fireEvent.click(confirm());
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEAVE_ENCOUNTER' }); expect(value.encounter.scene.playerCoordinate).toBe(6); expect(onClose).not.toHaveBeenCalled();
  });
});
