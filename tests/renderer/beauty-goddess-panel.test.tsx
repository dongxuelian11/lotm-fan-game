/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { BeautyGoddessPanel, type BeautyGoddessPanelProps } from '../../src/renderer/BeautyGoddessPanel.js';
import { originalLifeGiver } from '../domain/beauty-goddess-directed-helper.js';
import { projectBeautyGoddess } from '../../src/domain/beauty-goddess/index.js';
import { BEAUTY_GODDESS_ABILITIES, BEAUTY_GODDESS_CONSUMPTION_RISK, BEAUTY_GODDESS_INHERITED_ABILITIES, BEAUTY_GODDESS_PREPARATIONS } from '../../src/domain/beauty-goddess/content.js';
import type { BeautyGoddessAction, BeautyGoddessCommand, BeautyGoddessProjection } from '../../src/domain/beauty-goddess/types.js';

afterEach(cleanup);

// Renderer-only UNIT projections. Start with the real migrated-original projector and set
// finite public presentation inputs explicitly. These are neither valid saves
// nor a natural campaign. These public display inputs do not alter a save, predecessor history, RNG or mastery.
function action(command: BeautyGoddessCommand, label: string, cost = '0行动', enabled = true, reason: string | null = null): BeautyGoddessAction {
  return { id: JSON.stringify(command), command, label, cost, enabled, reason };
}
let defaultProjection: BeautyGoddessProjection | undefined;
function fixture(promoted = false): BeautyGoddessProjection {
  const value = structuredClone(defaultProjection ??= projectBeautyGoddess(originalLifeGiver()));
  Object.assign(value, {
    title: '美神·月亮序列1', characterName: '莉娜', discovered: true, guidanceKnown: promoted, promoted,
    story: '指导者介绍独立封存的美神成品魔药。', supplies: '每瓶6600便士，完成本瓶五项劳动后支付1100便士。',
    nextStep: '按实际状态决定下一步。', preparedWeek: null,
    digestion: promoted ? '美神扮演0/100，普通完成同样可以报告。' : '创生者消化100，晋升后须12整周。',
    pollution: 0, risk: BEAUTY_GODDESS_CONSUMPTION_RISK, acting: 0,
    resources: { health: 98, maxHealth: 100, mind: 98, maxMind: 100, spirituality: 120, maxSpirituality: 120, cash: '560便士', actionsRemaining: 1 },
    injuries: [], injuryRisk: 0, currentGender: 'FEMALE', originalGender: 'FEMALE',
    transformation: { originalGender: 'FEMALE', decision: promoted ? 'ACCEPTED' : 'UNDECIDED', acknowledgedWeek: promoted ? 132 : null, outcome: promoted ? 'FEMALE' : null },
    appearanceRecord: '当前女性，原年龄、特质与已有身体记录保留。', inheritedHistory: [],
    inheritedTools: '旧人物与原物维持各自的实际去向。', insideCase: false,
    environment: '门廊中的成年人、来客与原物各有唯一身份。',
  } satisfies Partial<BeautyGoddessProjection>);
  value.bottles = [1, 2, 3].map(number => ({ id: `beauty-goddess-potion-${number}`, title: `第${number}瓶 · 美神成品魔药`,
    source: `第${number}瓶独立封存，单独交付与耗用。`, status: '供应方保管 · 劳动0/5', chance: 68,
    command: { type: 'CONSUME', bottleId: `beauty-goddess-potion-${number}`, confirmed: true } }));
  value.preparations = BEAUTY_GODDESS_PREPARATIONS.map(item => ({ taskId: item.id, title: item.title, completedWeek: null }));
  // Seven zero entries are explicit finite renderer inputs, not claims about a replay.
  value.abilities = promoted ? [...BEAUTY_GODDESS_INHERITED_ABILITIES.map((item, index) => ({ ...item, mastery: index < 7 ? 0 : 8 })),
    ...BEAUTY_GODDESS_ABILITIES.map(item => ({ ...item, mastery: 0 }))] : [];
  value.actions = promoted ? [
    action({ type: 'OBSERVE', caseId: 'steady-hands' }, '观察门廊的玻璃配重', '1行动'),
    action({ type: 'OBSERVE', caseId: 'lit-crossing' }, '观察有灯的两米通路', '1行动', false, '先完成上一案。'),
    action({ type: 'ENCOUNTER_TALK' }, '亲自到门廊外交谈', '1行动', false, '先完成三份报告与反思。'),
  ] : [action({ type: 'LEARN_GUIDANCE' }, '听取美神成品与专业准备指导', '1行动 · 500便士')];
  value.preferredActionId = value.actions[0]!.id;
  if (promoted) {
    value.life.title = '玻璃屋门廊的三项实践';
    value.life.source = '同一玻璃屋门廊中的三项有限实践。';
    value.life.environment = '本人、达莉娅与流灯沿两米通路实际移动，撤回许可后普通收束。';

  }
  return value;
}
function show(value = fixture(), extra: Partial<BeautyGoddessPanelProps> = {}) {
  const onCommand = vi.fn();
  return { ...render(<BeautyGoddessPanel value={value} busy={false} onCommand={onCommand} {...extra} />), onCommand };
}
const primary = () => within(screen.getByRole('region', { name: '当前主要操作' })).getByRole('button');
const disabled = (control: HTMLElement) => (control as HTMLButtonElement).disabled;
const picker = () => screen.getByRole('combobox', { name: '美神目标' });
const resources = () => screen.getAllByRole('region', { name: '美神当前资源' })[0]!;
function openPrimary() { fireEvent.click(primary()); return screen.getByRole('dialog', { name: '美神操作确认' }); }
function confirm(dialog = screen.getByRole('dialog')) { return within(dialog).getByRole('button', { name: /^(确认执行这一次操作|确认服用这一原瓶|确认开始真实交战|确认接受晋升后的身体变化|确认拒绝，继续停留创生者)$/ }); }
function chooseExtra(id: string) {
  const select = screen.getByRole('combobox', { name: '美神其他操作', hidden: true });
  (select.closest('details') as HTMLDetailsElement).open = true;
  fireEvent.change(select, { target: { value: id } });
}
const editorial = /候选|原创G|本作G|原文未核|编号推断|\b(NEAR|FAR|HOME|WORKSHOP|YARD|RACK|PLAYER|RESISTING|SURRENDERED)\b|"command"|"before"/;

describe('BeautyGoddess panel: compact stages, exact original bottles and inherited facts', () => {
  it('shows finite actual resources without inventing an injury or a clinic requirement', () => {
    const value = fixture(), before = structuredClone(value), view = show(value);
    expect(screen.getByRole('heading', { name: value.title })).toBeTruthy();
    expect(resources().textContent).toContain('健康98/100 · 精神98/100 · 灵性120/120 · 排异0');
    expect(resources().textContent).toContain('560便士 · 本周行动1 · 现有伤势0处 · 累计风险0');
    expect(screen.getByRole('region', { name: '美神阶段总览' }).textContent).toContain('专业准备0/3');
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
    const value = fixture(); value.actions.push(action({ type: 'PREPARE_TASK', taskId: 'CHECK_LIMITS' }, '检查自身调息与定形的有限范围', '1行动'));
    value.preferredActionId = value.actions[1]!.id;
    const view = show(value);
    expect(primary().textContent).toContain('检查自身调息与定形的有限范围');
    expect((screen.getByText('其他操作与普通替代').closest('details') as HTMLDetailsElement).open).toBe(false);
    chooseExtra(value.actions[0]!.id); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('selects the exact owned original bottle during paid preparation and submits once only after confirmation', () => {
    const value = fixture(); value.transformation = { originalGender: 'FEMALE', decision: 'ACCEPTED', acknowledgedWeek: 137, outcome: null }; value.preparedWeek = 138; value.insideCase = true;
    value.bottles[0]!.status = value.bottles[1]!.status = '已交付，尚未服用';
    value.actions = value.bottles.slice(0, 2).map(bottle => action(bottle.command, `独立确认服用${bottle.title}`, '0行动 · 当周准备已付150便士'));
    value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value);
    expect(disabled(picker())).toBe(false); fireEvent.change(picker(), { target: { value: value.bottles[1]!.id } });
    expect(view.onCommand).not.toHaveBeenCalled();
    const dialog = openPrimary(); expect(dialog.textContent).toContain('第2瓶独立封存');
    expect(dialog.textContent).toContain('当前成功率68%'); expect(dialog.textContent).toContain('健康−15精神−25排异+30');
    expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备');
    fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith(value.bottles[1]!.command); expect(value).toEqual(before);
  });

  it('keeps a locally selected original bottle after a changed saved projection', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<BeautyGoddessPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.change(picker(), { target: { value: 'beauty-goddess-potion-2' } });
    const saved = structuredClone(value); saved.bottles[1]!.status = '供应方保管 · 劳动1/5';
    view.rerender(<BeautyGoddessPanel value={saved} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('第2瓶独立封存');
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('劳动1/5'); expect(onCommand).not.toHaveBeenCalled();
  });

  it('shows all 21 inherited masteries including seven zeros and both new zero-masteries unchanged', () => {
    const value = fixture(true), before = structuredClone(value), view = show(value);
    const fold = screen.getByText('能力、消化与继承经历').closest('details')!; fold.open = true;
    expect(value.abilities).toHaveLength(23); expect(value.abilities.slice(0, 21).filter(item => item.mastery === 0)).toHaveLength(7);
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
    const value = fixture(), bottle = value.bottles[0]!; value.transformation = { originalGender: 'FEMALE', decision: 'ACCEPTED', acknowledgedWeek: 137, outcome: null }; value.preparedWeek = 138; value.insideCase = true;
    value.actions = [action(bottle.command, '独立确认服用第1瓶美神魔药')];
    const onCommand = vi.fn(), view = render(<BeautyGoddessPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(confirm(openPrimary()));
    view.rerender(<BeautyGoddessPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    const saved = structuredClone(value); saved.bottles[0]!.status = '原瓶已耗尽 · 排异，仍为创生者';
    saved.preparedWeek = null; saved.insideCase = false; saved.resources!.health = 83; saved.resources!.mind = 73; saved.pollution = 30;
    saved.actions = [action({ type: 'BUY_POTION', bottleId: saved.bottles[1]!.id }, '取得第2瓶原药', '6600便士')];
    view.rerender(<BeautyGoddessPanel value={saved} busy={false} onCommand={onCommand} />);
    fireEvent.change(picker(), { target: { value: bottle.id } });
    expect(resources().textContent).toContain('健康83/100 · 精神73/100 · 灵性120/120 · 排异30');
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('原瓶已耗尽');
    expect(screen.queryByRole('dialog')).toBeNull(); expect(saved.injuries).toEqual([]);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(bottle.command);
  });
});

describe('BeautyGoddess panel: real confirmation, focus and same-save retry protection', () => {
  it('traps focus, disables background controls and restores the initiating control on cancel and Escape', () => {
    const onClose = vi.fn(), view = show(fixture(), { onClose }), button = primary(), dialog = openPrimary();
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: '听取美神成品与专业准备指导' }));
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
    const value = fixture(), onCommand = vi.fn(), view = render(<BeautyGoddessPanel value={value} busy={false} onCommand={onCommand} />);
    const dialog = openPrimary(); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    view.rerender(<BeautyGoddessPanel value={structuredClone(value)} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true); expect(disabled(within(dialog).getByRole('button', { name: '取消，返回查看' }))).toBe(true);
    fireEvent.keyDown(dialog, { key: 'Escape' }); expect(screen.getByRole('dialog')).toBe(dialog);
    expect(screen.getByRole('status').textContent).toContain('正在结算并保存');
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEARN_GUIDANCE' });
  });

  it('closes an unsubmitted confirmation on an error without dispatching', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<BeautyGoddessPanel value={value} busy={false} onCommand={onCommand} />);
    openPrimary(); view.rerender(<BeautyGoddessPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(disabled(primary())).toBe(true);
    expect(screen.getByRole('alert').textContent).toContain('上次已保存的记录');
    expect(screen.getByRole('alert').textContent).toContain('同一次保存'); expect(onCommand).not.toHaveBeenCalled();
  });

  it('keeps an intent locked across failure and error clearing until a changed committed projection arrives', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<BeautyGoddessPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(confirm(openPrimary()));
    view.rerender(<BeautyGoddessPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    view.rerender(<BeautyGoddessPanel value={value} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true); fireEvent.click(primary()); expect(onCommand).toHaveBeenCalledTimes(1);
    const saved = structuredClone(value); saved.guidanceKnown = true; saved.resources!.cash = '60便士'; saved.resources!.actionsRemaining = 0;
    saved.actions = [action({ type: 'PREPARE_TASK', taskId: 'REVIEW_RECORDS' }, '核对八阶经历与既往报告', '1行动', false, '本周行动不足。')];
    view.rerender(<BeautyGoddessPanel value={saved} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('status')).toBeNull(); expect(document.activeElement).toBe(screen.getByRole('heading', { name: saved.title }));
    expect(resources().textContent).toContain('60便士'); expect(disabled(primary())).toBe(true); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it('waits for busy to clear before releasing a saved change', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<BeautyGoddessPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(confirm(openPrimary())); const saved = structuredClone(value); saved.resources!.cash = '60便士';
    view.rerender(<BeautyGoddessPanel value={saved} busy onCommand={onCommand} />); expect(disabled(primary())).toBe(true);
    view.rerender(<BeautyGoddessPanel value={saved} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(false); expect(screen.queryByRole('status')).toBeNull(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it('invalidates a stale confirmation when an action id is reused with a different command', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<BeautyGoddessPanel value={value} busy={false} onCommand={onCommand} />);
    const stale = confirm(openPrimary()), changed = structuredClone(value); changed.actions[0]!.command = { type: 'PREPARE_TASK', taskId: 'MARK_EXIT' };
    view.rerender(<BeautyGoddessPanel value={changed} busy={false} onCommand={onCommand} />);
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

describe('BeautyGoddess panel: separate body acknowledgment and original identity', () => {
  it.each(['MALE', 'FEMALE'] as const)('explains the actual %s body consequence before a separate acknowledgment', gender => {
    // Explicit renderer-only body presentation input; this is not a rewritten historical save.
    const value = fixture(); value.currentGender = value.originalGender = gender;
    value.transformation = { originalGender: gender, decision: 'UNDECIDED', acknowledgedWeek: null, outcome: null };
    value.actions = [action({ type: 'CONFIRM_TRANSFORMATION', confirmed: true }, '了解并确认晋升后的身体变化')];
    value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value), dialog = openPrimary();
    const notice = within(dialog).getByRole('region', { name: '本次身体变化确认' });
    expect(notice.textContent).toContain(gender === 'MALE' ? '当前身体为男性。成功晋升美神后，身体会成为女性。' : '当前身体已经为女性。成功晋升美神后仍为女性。');
    expect(notice.textContent).toContain('服药失败不改变原有身体性别');
    expect(notice.textContent).toContain('姓名、年龄、性格与性取向不因这次晋升而改变');
    expect(notice.textContent).toContain('不会服药，也不会立即改变身体');
    expect(view.onCommand).not.toHaveBeenCalled(); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'CONFIRM_TRANSFORMATION', confirmed: true });
    expect(value).toEqual(before);
  });

  it('requires a new exact-bottle confirmation after the saved body acknowledgment', () => {
    const value = fixture(); value.currentGender = value.originalGender = 'MALE';
    value.transformation = { originalGender: 'MALE', decision: 'UNDECIDED', acknowledgedWeek: null, outcome: null };
    value.actions = [action({ type: 'CONFIRM_TRANSFORMATION', confirmed: true }, '了解并确认晋升后的身体变化')];
    value.preferredActionId = value.actions[0]!.id;
    const onCommand = vi.fn(), view = render(<BeautyGoddessPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(confirm(openPrimary()));
    const saved = structuredClone(value); saved.transformation.decision = 'ACCEPTED'; saved.transformation.acknowledgedWeek = 132;
    saved.preparedWeek = 132; saved.insideCase = true; saved.actions = [action(saved.bottles[0]!.command, '服用第1瓶美神魔药')]; saved.preferredActionId = saved.actions[0]!.id;
    view.rerender(<BeautyGoddessPanel value={saved} busy={false} onCommand={onCommand} />);
    expect(onCommand).toHaveBeenCalledTimes(1); expect(screen.queryByRole('dialog')).toBeNull();
    const dialog = openPrimary(); expect(dialog.textContent).toContain('已保存的身体变化确认不代替本次服药选择');
    expect(dialog.textContent).toContain('身体会成为女性'); expect(dialog.textContent).toContain('第1瓶独立封存');
    fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    expect(onCommand).toHaveBeenCalledTimes(2); expect(onCommand).toHaveBeenLastCalledWith(saved.bottles[0]!.command);
    expect(saved.currentGender).toBe('MALE'); expect(saved.transformation.outcome).toBeNull();
  });

  it('allows refusal without consuming a bottle or changing the body', () => {
    const value = fixture(); value.currentGender = value.originalGender = 'MALE';
    value.actions = [action({ type: 'DECLINE_TRANSFORMATION' }, '拒绝身体变化，继续停留创生者')]; value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value), dialog = openPrimary();
    expect(dialog.textContent).toContain('拒绝后继续停留序列2创生者，不服药、不改变身体');
    fireEvent.click(confirm(dialog)); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'DECLINE_TRANSFORMATION' }); expect(value).toEqual(before);
  });

  it('renders a saved failed male attempt with its original body unchanged', () => {
    const value = fixture(); value.currentGender = value.originalGender = 'MALE';
    value.transformation = { originalGender: 'MALE', decision: 'ACCEPTED', acknowledgedWeek: 132, outcome: null };
    value.bottles[0]!.status = '原瓶已耗尽 · 服药失败，仍为创生者'; value.resources!.health = 55; value.resources!.mind = 75; value.pollution = 30;
    const before = structuredClone(value), view = show(value);
    const body = screen.getByRole('region', { name: '美神身体变化记录' });
    expect(body.textContent).toContain('当前身体：男性'); expect(body.textContent).toContain('尚未发生成功服药后的身体变化');
    expect(resources().textContent).toContain('健康55/100 · 精神75/100');
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('does not manufacture resources or accept a stale enabled action when current resources are absent', () => {
    const value = fixture(); value.resources = null;
    const before = structuredClone(value), view = show(value);
    expect(resources().textContent).toContain('当前没有可核对的本人资源记录'); expect(disabled(primary())).toBe(true);
    expect(resources().textContent).not.toMatch(/健康100|精神100|灵性120|便士/);
    fireEvent.click(primary()); expect(view.onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});

describe('BeautyGoddess panel: independent people, finite light and actual return', () => {
  function inside(caseId: 'steady-hands' | 'lit-crossing' | 'withdrawn-moonlight' = 'steady-hands') {
    const value = fixture(true), p = value.life.practice;
    value.insideCase = value.life.insideCase = true; p.activeCase = caseId; p.playerLocation = 'HOME';
    p.playerTravelMetres = 60; p.elapsedSeconds = 60;
    const current = value.life.cases.find(item => item.id === caseId)!; current.status = 'ACTIVE'; current.contactOpen = true;
    value.actions = [action({ type: 'RETURN_WEIGHT' }, '亲手归还原玻璃镇纸')]; value.preferredActionId = value.actions[0]!.id;
    return value;
  }

  it('shows the original Lumen resources and only the actual paid rest history', () => {
    const value = fixture(true), before = structuredClone(value), view = show(value);
    const guest = screen.getByRole('region', { name: '同一流灯的当前资源' });
    expect(guest.textContent).toContain('健康100/100 · 精神92/100 · 精力88/100');
    expect(guest.textContent).toContain('第105周实付30便士'); expect(guest.textContent).toContain('第123周实付30便士');
    expect(guest.textContent).toContain('原声片仍属于流灯'); expect(view.container.textContent).not.toMatch(editorial);
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('distinguishes guest and caretaker permission from permission to use the player’s own power', () => {
    const value = inside(), current = value.life.cases[0]!;
    current.permission = { guest: 'DECLINED', caretaker: 'GRANTED', selfPower: 'GRANTED' };
    value.life.currentConsents = [{ id: 'SM3-LUMEN', consented: false }, { id: 'BG1-DARIA42', consented: true }, { id: 'PLAYER', consented: true }];
    const before = structuredClone(value), view = show(value), consent = screen.getByRole('region', { name: '本案的独立许可' });
    expect(consent.textContent).toContain('流灯的本次搬运：已拒绝');
    expect(consent.textContent).toContain('达莉娅的原物与光照范围：当前明确同意');
    expect(consent.textContent).toContain('本人使用自身能力：当前明确同意');
    expect(consent.textContent).toContain('本人调息不代表他人同意搬运');
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('does not present an old closed permission as active consent', () => {
    const value = fixture(true); value.life.cases[0]!.permission = { guest: 'GRANTED', caretaker: 'GRANTED', selfPower: 'GRANTED' };
    value.life.currentConsents = []; value.life.cases[0]!.contactOpen = false;
    show(value); const consent = screen.getByRole('region', { name: '本案的独立许可' });
    expect(consent.textContent).toContain('本案曾明确同意，当前无生效许可'); expect(consent.textContent).not.toContain('当前明确同意');
  });

  it('shows real paid oil, spent and returned pieces, shutter state and two-metre positions', () => {
    const value = inside('lit-crossing'), p = value.life.practice;
    p.ownerOffsetMetres = p.guestOffsetMetres = 2; p.weight.holder = 'SM3-LUMEN'; p.weight.location = 'TABLE';
    Object.assign(p.lamp, { holder: 'PLAYER', lit: true, fuelSeconds: 146, fuelBurnedSeconds: 34, oilPurchasedWeek: 132 });
    p.shutter.position = 'LOWERED'; Object.assign(p.pieces[0]!, { owner: 'PLAYER', status: 'SPENT', holder: 'RETURN_TRAY', purchasedWeek: 132, spentWeek: 132, caseId: 'lit-crossing' });
    const before = structuredClone(value), view = show(value);
    const materials = screen.getByRole('region', { name: '原灯遮板与实付月片' });
    expect(materials.textContent).toContain('剩余灯油可燃146秒'); expect(materials.textContent).toContain('第132周已实付30便士');
    expect(materials.textContent).toContain('遮板已经放下，光路受阻'); expect(materials.textContent).toContain('第1片月片：已经耗尽；已经实放返还盘');
    expect(materials.textContent).toContain('第2片月片：尚未购买，仍在商店');
    expect(screen.getByRole('region', { name: '实际位置与归还' }).textContent).toContain('屋内位置距起点2米');
    expect(view.container.textContent).not.toMatch(editorial); expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('shows one later ordinary operation per finite window without applying it or awarding mastery', () => {
    const value = inside('lit-crossing'), p = value.life.practice;
    p.elapsedSeconds = 80; p.pendingPoise = { caseId: 'lit-crossing', createdAt: 70, expiresAt: 100, bonus: 10 };
    p.pendingMoonform = { caseId: 'lit-crossing', createdAt: 75, expiresAt: 105, permissionRevision: 3, pieceId: 'BG1-MOON-PIECE-1', bonus: 10 };
    value.life.cases[1]!.attempts = [{ invitedWeek: 132, method: 'ABILITY', outcome: 'SUCCESS', operationOutcome: null, receipts: [] }];
    const before = structuredClone(value), view = show(value), windows = screen.getByRole('region', { name: '两项能力的有限窗口' });
    expect(windows.textContent).toContain('辉映调息还剩20秒'); expect(windows.textContent).toContain('月辉定形还剩25秒');
    expect(windows.textContent).toContain('独立普通操作：尚未进行'); expect(windows.textContent).toContain('施放本身不完成放置，也不增加掌握');
    expect(value.abilities.slice(21).map(item => item.mastery)).toEqual([0, 0]); expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('keeps failed attempts and withdrawn consent visible while exposing ordinary cleanup', () => {
    const value = inside('withdrawn-moonlight'), current = value.life.cases[2]!;
    current.permission.guest = 'WITHDRAWN'; current.attempts = [
      { invitedWeek: 132, method: 'ABILITY', outcome: 'FAILURE', operationOutcome: null, receipts: [] },
      { invitedWeek: 133, method: 'ORDINARY', outcome: null, operationOutcome: 'SUCCESS', receipts: [] },
    ];
    value.life.practice.pendingMoonform = null; const onClose = vi.fn(), view = show(value, { onClose });
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull(); expect(disabled(picker())).toBe(true);
    expect(screen.getByRole('region', { name: '本案的独立许可' }).textContent).toContain('流灯的本次搬运：已经撤回');
    expect(screen.getByText('此前尝试与已付代价').closest('details')!.textContent).toContain('第132周：曾选择能力帮助；能力失败');
    expect(screen.getByRole('region', { name: '两项能力的有限窗口' }).textContent).toContain('当前没有可应用的月辉定形窗口');
    fireEvent.click(confirm(openPrimary())); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'RETURN_WEIGHT' }); expect(onClose).not.toHaveBeenCalled();
  });

  it('shows actual new rest results without re-creating or automatically restoring the guest', () => {
    const value = fixture(true), guest = value.life.partner;
    guest.restHistory.push({ week: 133, paidPennies: 30, staminaBefore: 79, staminaAfter: 100, mindBefore: 92, mindAfter: 100, healthUnchanged: 100 });
    guest.stamina = 100; guest.mind = 100;
    const before = structuredClone(value), view = show(value);
    expect(screen.getByRole('region', { name: '同一流灯的当前资源' }).textContent).toContain('第133周实付30便士；精力79→100，精神92→100，健康维持100');
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });
});

describe('BeautyGoddess panel: explicit strategy and independent battle materials', () => {
  function encounter() {
    const value = fixture(true); value.encounter.inside = value.insideCase = true; value.encounter.status = 'READY';
    value.encounter.scene.playerLocation = 'YARD'; value.encounter.scene.playerCoordinate = 4;
    value.actions = [action({ type: 'ENCOUNTER_POLICY', policy: 'ORDINARY' }, '只作普通行动', '0行动；开战前明确选择')];
    value.preferredActionId = value.actions[0]!.id; return value;
  }

  it('dispatches an explicitly selected policy only once and does not summon a guest or buy anything', () => {
    const value = encounter(), before = structuredClone(value), view = show(value);
    const region = screen.getByRole('region', { name: '美神可选真实交战' });
    expect(region.textContent).toContain('流灯仍留在原家'); expect(region.textContent).toContain('尚未购买战场灯');
    expect(region.textContent).toContain('没有已购买的战场月片'); expect(region.textContent).toContain('旧原珠不在手');
    expect(region.textContent).toContain('当前策略：只用已学能力'); expect(region.textContent).toContain('等待本场明确选择');
    fireEvent.click(confirm(openPrimary())); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'ENCOUNTER_POLICY', policy: 'ORDINARY' });
    expect(value).toEqual(before); expect(view.container.textContent).not.toMatch(editorial);
  });

  it('shows the real independent paid lamp, spent piece and original enemy resource depletion', () => {
    const value = encounter(), e = value.encounter;
    e.materials.lamp = { id: 'BG1-BATTLE-LAMP', sourceId: 'BG1-BATTLE-LAMP-SHOP-1', owner: 'PLAYER', paidPennies: 40, purchasedWeek: 135,
      location: 'RETURN_TRAY', fuelSeconds: 124, capacitySeconds: 180, lit: false, blocked: true };
    e.materials.pieces = [{ id: 'BG1-BATTLE-MOON-PIECE-1', sourceId: 'BG1-BATTLE-SOURCE-1', owner: 'PLAYER', paidPennies: 70, purchasedWeek: 135,
      status: 'SPENT', location: 'RETURN_TRAY', spentWeek: 135, combatRound: 1 }];
    e.materials.weapon.charge = 0; e.enemy.powerUses.MOON_BOLT = 4;
    const before = structuredClone(value), view = show(value), materials = screen.getByRole('region', { name: '独立战场灯与有限月片' });
    expect(materials.textContent).toContain('实付40便士'); expect(materials.textContent).toContain('剩余燃料124/180秒');
    expect(materials.textContent).toContain('灯罩受遮挡'); expect(materials.textContent).toContain('已经耗尽；已经实放返还盘');
    expect(screen.getByRole('region', { name: '对手原月杆与有限资源' }).textContent).toContain('可见冲击储能0/4');
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('requires its own explicit fight confirmation with real death risk and saved policy', () => {
    const value = encounter(); value.encounter.policy = 'BOUNDED_MOONFORM'; value.encounter.policyConfirmed = true;
    value.actions = [action({ type: 'ENCOUNTER_FIGHT' }, '自主承担真实冲突', '1行动；真实伤势与死亡风险')]; value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value);
    expect(screen.getByRole('region', { name: '开战前的能力策略' }).textContent).toContain('本场明确选择已经保存');
    const dialog = openPrimary(); expect(dialog.textContent).toContain('奥斯瓦尔德·里德'); expect(dialog.textContent).toContain('普通死亡终结本周目'); expect(dialog.textContent).toContain('本场策略：允许月辉定形');
    expect(view.onCommand).not.toHaveBeenCalled(); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'ENCOUNTER_FIGHT' }); expect(value).toEqual(before);
  });
});
