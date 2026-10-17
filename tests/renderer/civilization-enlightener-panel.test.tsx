/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { CivilizationEnlightenerPanel, type CivilizationEnlightenerPanelProps } from '../../src/renderer/CivilizationEnlightenerPanel.js';
import { originalKnowledgeMentor } from '../domain/civilization-enlightener-directed-helper.js';
import { projectCivilizationEnlightener } from '../../src/domain/civilization-enlightener/index.js';
import { CIVILIZATION_ENLIGHTENER_ABILITIES, CIVILIZATION_ENLIGHTENER_CONSUMPTION_RISK, CIVILIZATION_ENLIGHTENER_INHERITED_ABILITIES, CIVILIZATION_ENLIGHTENER_PREPARATIONS } from '../../src/domain/civilization-enlightener/content.js';
import type { CivilizationEnlightenerAction, CivilizationEnlightenerCommand, CivilizationEnlightenerProjection } from '../../src/domain/civilization-enlightener/types.js';

afterEach(cleanup);

// Renderer-only UNIT projections. Start with the real migrated-original projector and set
// finite public presentation inputs explicitly. These are neither valid saves
// nor a natural campaign. These public display inputs do not alter a save, predecessor history, RNG or mastery.
function action(command: CivilizationEnlightenerCommand, label: string, cost = '0行动', enabled = true, reason: string | null = null): CivilizationEnlightenerAction {
  return { id: JSON.stringify(command), command, label, cost, enabled, reason };
}
let defaultProjection: CivilizationEnlightenerProjection | undefined;
function fixture(promoted = false): CivilizationEnlightenerProjection {
  const value = structuredClone(defaultProjection ??= projectCivilizationEnlightener(originalKnowledgeMentor()));
  Object.assign(value, {
    title: '文明启蒙者·通识者序列1', characterName: '莉娜', discovered: true, guidanceKnown: promoted, promoted,
    story: '指导者介绍独立封存的文明启蒙者成品魔药。', supplies: '每瓶6600便士，完成本瓶五项劳动后支付1100便士。',
    nextStep: '按实际状态决定下一步。', preparedWeek: null,
    digestion: promoted ? '文明启蒙者扮演0/100，普通完成同样可以报告。' : '知识导师消化100，晋升后须12整周。',
    pollution: 0, risk: CIVILIZATION_ENLIGHTENER_CONSUMPTION_RISK, acting: 0,
    resources: { health: 98, maxHealth: 100, mind: 98, maxMind: 100, spirituality: 120, maxSpirituality: 120, cash: '560便士', actionsRemaining: 1 },
    injuries: [], injuryRisk: 0, currentGender: 'FEMALE', originalGender: 'FEMALE',
    appearanceRecord: '当前女性，原年龄、特质与已有身体记录保留。', inheritedHistory: [],
    inheritedTools: '旧人物与原物维持各自的实际去向。', insideCase: false,
    environment: '工坊中的成年人、原盒与原架各有唯一身份。',
  } satisfies Partial<CivilizationEnlightenerProjection>);
  value.bottles = [1, 2, 3].map(number => ({ id: `civilization-enlightener-potion-${number}`, title: `第${number}瓶 · 文明启蒙者成品魔药`,
    source: `第${number}瓶独立封存，单独交付与耗用。`, status: '供应方保管 · 劳动0/5', chance: 68,
    command: { type: 'CONSUME', bottleId: `civilization-enlightener-potion-${number}`, confirmed: true } }));
  value.preparations = CIVILIZATION_ENLIGHTENER_PREPARATIONS.map(item => ({ taskId: item.id, title: item.title, completedWeek: null }));
  // Seven zero entries are explicit finite renderer inputs, not claims about a replay.
  value.abilities = promoted ? [...CIVILIZATION_ENLIGHTENER_INHERITED_ABILITIES.map((item, index) => ({ ...item, mastery: index < 7 ? 0 : 8 })),
    ...CIVILIZATION_ENLIGHTENER_ABILITIES.map(item => ({ ...item, mastery: 0 }))] : [];
  value.actions = promoted ? [
    action({ type: 'OBSERVE', caseId: 'worn-bearing' }, '观察原架与制造记录', '1行动'),
    action({ type: 'OBSERVE', caseId: 'taught-stop' }, '观察原手动停机柄', '1行动', false, '先完成上一案。'),
    action({ type: 'ENCOUNTER_TALK' }, '亲自到工院交谈', '1行动', false, '先完成三份报告与反思。'),
  ] : [action({ type: 'LEARN_GUIDANCE' }, '听取文明启蒙者成品与专业准备指导', '1行动 · 500便士')];
  value.preferredActionId = value.actions[0]!.id;
  if (promoted) {
    value.life.title = '原工坊的三项实践';
    value.life.source = '同一工坊中的三项有限实践。';
    value.life.environment = '本人、维拉与两件原物沿既有两米通路实际移动，撤回许可后普通收束。';

  }
  return value;
}
function show(value = fixture(), extra: Partial<CivilizationEnlightenerPanelProps> = {}) {
  const onCommand = vi.fn();
  return { ...render(<CivilizationEnlightenerPanel value={value} busy={false} onCommand={onCommand} {...extra} />), onCommand };
}
const primary = () => within(screen.getByRole('region', { name: '当前主要操作' })).getByRole('button');
const disabled = (control: HTMLElement) => (control as HTMLButtonElement).disabled;
const picker = () => screen.getByRole('combobox', { name: '文明启蒙者目标' });
const resources = () => screen.getAllByRole('region', { name: '文明启蒙者当前资源' })[0]!;
function openPrimary() { fireEvent.click(primary()); return screen.getByRole('dialog', { name: '文明启蒙者操作确认' }); }
function confirm(dialog = screen.getByRole('dialog')) { return within(dialog).getByRole('button', { name: /^(确认执行这一次操作|确认服用这一原瓶|确认开始真实交战)$/ }); }
function chooseExtra(id: string) {
  const select = screen.getByRole('combobox', { name: '文明启蒙者其他操作', hidden: true });
  (select.closest('details') as HTMLDetailsElement).open = true;
  fireEvent.change(select, { target: { value: id } });
}
const editorial = /候选|原创G|本作G|原文未核|编号推断|\b(NEAR|FAR|WORKSHOP|YARD|RACK|PLAYER|RESISTING)\b|"command"|"before"/;

describe('CivilizationEnlightener panel: compact stages, exact original bottles and inherited facts', () => {
  it('shows finite actual resources without inventing an injury or a clinic requirement', () => {
    const value = fixture(), before = structuredClone(value), view = show(value);
    expect(screen.getByRole('heading', { name: value.title })).toBeTruthy();
    expect(resources().textContent).toContain('健康98/100 · 精神98/100 · 灵性120/120 · 排异0');
    expect(resources().textContent).toContain('560便士 · 本周行动1 · 现有伤势0处 · 累计风险0');
    expect(screen.getByRole('region', { name: '文明启蒙者阶段总览' }).textContent).toContain('专业准备0/3');
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
    const value = fixture(); value.actions.push(action({ type: 'PREPARE_TASK', taskId: 'CHECK_LIMITS' }, '检查有限诊断与普通教学边界', '1行动'));
    value.preferredActionId = value.actions[1]!.id;
    const view = show(value);
    expect(primary().textContent).toContain('检查有限诊断与普通教学边界');
    expect((screen.getByText('其他操作与普通替代').closest('details') as HTMLDetailsElement).open).toBe(false);
    chooseExtra(value.actions[0]!.id); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('selects the exact owned original bottle during paid preparation and submits once only after confirmation', () => {
    const value = fixture(); value.preparedWeek = 138; value.insideCase = true;
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
    const value = fixture(), onCommand = vi.fn(), view = render(<CivilizationEnlightenerPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.change(picker(), { target: { value: 'civilization-enlightener-potion-2' } });
    const saved = structuredClone(value); saved.bottles[1]!.status = '供应方保管 · 劳动1/5';
    view.rerender(<CivilizationEnlightenerPanel value={saved} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('第2瓶独立封存');
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('劳动1/5'); expect(onCommand).not.toHaveBeenCalled();
  });

  it('shows all 19 inherited masteries including seven zeros and both new zero-masteries unchanged', () => {
    const value = fixture(true), before = structuredClone(value), view = show(value);
    const fold = screen.getByText('能力、消化与继承经历').closest('details')!; fold.open = true;
    expect(value.abilities).toHaveLength(21); expect(value.abilities.slice(0, 19).filter(item => item.mastery === 0)).toHaveLength(7);
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
    value.actions = [action(bottle.command, '独立确认服用第1瓶文明启蒙者魔药')];
    const onCommand = vi.fn(), view = render(<CivilizationEnlightenerPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(confirm(openPrimary()));
    view.rerender(<CivilizationEnlightenerPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    const saved = structuredClone(value); saved.bottles[0]!.status = '原瓶已耗尽 · 排异，仍为知识导师';
    saved.preparedWeek = null; saved.insideCase = false; saved.resources!.health = 83; saved.resources!.mind = 73; saved.pollution = 30;
    saved.actions = [action({ type: 'BUY_POTION', bottleId: saved.bottles[1]!.id }, '取得第2瓶原药', '6600便士')];
    view.rerender(<CivilizationEnlightenerPanel value={saved} busy={false} onCommand={onCommand} />);
    fireEvent.change(picker(), { target: { value: bottle.id } });
    expect(resources().textContent).toContain('健康83/100 · 精神73/100 · 灵性120/120 · 排异30');
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('原瓶已耗尽');
    expect(screen.queryByRole('dialog')).toBeNull(); expect(saved.injuries).toEqual([]);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith(bottle.command);
  });
});

describe('CivilizationEnlightener panel: real confirmation, focus and same-save retry protection', () => {
  it('traps focus, disables background controls and restores the initiating control on cancel and Escape', () => {
    const onClose = vi.fn(), view = show(fixture(), { onClose }), button = primary(), dialog = openPrimary();
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: '听取文明启蒙者成品与专业准备指导' }));
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
    const value = fixture(), onCommand = vi.fn(), view = render(<CivilizationEnlightenerPanel value={value} busy={false} onCommand={onCommand} />);
    const dialog = openPrimary(); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    view.rerender(<CivilizationEnlightenerPanel value={structuredClone(value)} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true); expect(disabled(within(dialog).getByRole('button', { name: '取消，返回查看' }))).toBe(true);
    fireEvent.keyDown(dialog, { key: 'Escape' }); expect(screen.getByRole('dialog')).toBe(dialog);
    expect(screen.getByRole('status').textContent).toContain('正在结算并保存');
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEARN_GUIDANCE' });
  });

  it('closes an unsubmitted confirmation on an error without dispatching', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<CivilizationEnlightenerPanel value={value} busy={false} onCommand={onCommand} />);
    openPrimary(); view.rerender(<CivilizationEnlightenerPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(disabled(primary())).toBe(true);
    expect(screen.getByRole('alert').textContent).toContain('上次已保存的记录');
    expect(screen.getByRole('alert').textContent).toContain('同一次保存'); expect(onCommand).not.toHaveBeenCalled();
  });

  it('keeps an intent locked across failure and error clearing until a changed committed projection arrives', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<CivilizationEnlightenerPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(confirm(openPrimary()));
    view.rerender(<CivilizationEnlightenerPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    view.rerender(<CivilizationEnlightenerPanel value={value} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true); fireEvent.click(primary()); expect(onCommand).toHaveBeenCalledTimes(1);
    const saved = structuredClone(value); saved.guidanceKnown = true; saved.resources!.cash = '60便士'; saved.resources!.actionsRemaining = 0;
    saved.actions = [action({ type: 'PREPARE_TASK', taskId: 'REVIEW_RECORDS' }, '核对八阶原瓶与既往报告', '1行动', false, '本周行动不足。')];
    view.rerender(<CivilizationEnlightenerPanel value={saved} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('status')).toBeNull(); expect(document.activeElement).toBe(screen.getByRole('heading', { name: saved.title }));
    expect(resources().textContent).toContain('60便士'); expect(disabled(primary())).toBe(true); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it('waits for busy to clear before releasing a saved change', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<CivilizationEnlightenerPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(confirm(openPrimary())); const saved = structuredClone(value); saved.resources!.cash = '60便士';
    view.rerender(<CivilizationEnlightenerPanel value={saved} busy onCommand={onCommand} />); expect(disabled(primary())).toBe(true);
    view.rerender(<CivilizationEnlightenerPanel value={saved} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(false); expect(screen.queryByRole('status')).toBeNull(); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it('invalidates a stale confirmation when an action id is reused with a different command', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<CivilizationEnlightenerPanel value={value} busy={false} onCommand={onCommand} />);
    const stale = confirm(openPrimary()), changed = structuredClone(value); changed.actions[0]!.command = { type: 'PREPARE_TASK', taskId: 'MARK_EXIT' };
    view.rerender(<CivilizationEnlightenerPanel value={changed} busy={false} onCommand={onCommand} />);
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

describe('Civilization Enlightener panel: actual objects, fresh consent and ordinary work', () => {
  function inside(caseId: 'worn-bearing' | 'taught-stop' | 'withdrawn-operation' = 'worn-bearing') {
    const value = fixture(true), p = value.life.practice;
    value.insideCase = value.life.insideCase = true;
    p.activeCase = caseId; p.ownerNode = 'FAR'; p.ownerWalkedMetres = 2; p.elapsedSeconds = 20;
    p.participant.present = true; p.participant.node = 'FAR'; p.participant.walkedMetres = 3;
    const entry = value.life.cases.find(item => item.id === caseId)!; entry.status = 'ACTIVE'; entry.contactOpen = true;
    entry.permission = { ability: 'GRANTED', teaching: 'GRANTED' };
    entry.attempts = [{ invitedWeek: 170, method: 'ABILITY', outcome: null, learnerOutcome: null,
      evidence: { abilityAttempted: false, abilityApplied: false, returned: false, result: 'NONE', ordinaryStepLearned: false }, receipts: [] }];
    return value;
  }
  function receipt(value: CivilizationEnlightenerProjection, command: CivilizationEnlightenerProjection['life']['ledger'][number]['command']): CivilizationEnlightenerProjection['life']['ledger'][number] {
    // Finite public display receipt only; this is not a valid campaign journal.
    const originals = value.life.creations.map(({ id, charge, durability, location, active }) => ({ id, charge, durability, location, active }));
    return { week: 170, date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 9, day: 23 }, revision: 720,
      randomCursor: 310, randomBefore: null, randomAfter: null, checkBase: null, check: null, command, outcome: null,
      before: { health: 98, mind: 98, spirituality: 120, cash: 560, actions: 1 },
      after: { health: 98, mind: 98, spirituality: 120, cash: 560, actions: 1 },
      elapsedSeconds: 0, ownerWalkedMetres: 0, veraWalkedMetres: 0, originalsCarriedMetres: 0, wrenchCarriedMetres: 0,
      originalsBefore: structuredClone(originals), originalsAfter: structuredClone(originals), loadTransitions: [] };
  }

  it('shows the actual two unpowered originals, adult and borrowed tool without moving them on render', () => {
    const value = inside(), p = value.life.practice; p.wrench.holder = 'PLAYER'; p.wrench.node = 'FAR'; p.wrench.loans = 1;
    const before = structuredClone(value), onClose = vi.fn(), view = show(value, { onClose });
    expect(disabled(picker())).toBe(true); expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    const originals = screen.getByRole('region', { name: '同一原盒与原架' });
    expect(originals.textContent).toContain('AL4-BOX-1：储能0/3，耐久100/100');
    expect(originals.textContent).toContain('AL4-FRAME-1：储能0/3，耐久90/100');
    expect(screen.getByRole('region', { name: '维拉的本次参与' }).textContent).toContain('维拉 · 39岁 · 实际在场');
    const workshop = screen.getByRole('region', { name: '原工台、工具与实际位置' });
    expect(workshop.textContent).toContain('本人在两米外的工台远端，已实际步行2米');
    expect(workshop.textContent).toContain('唯一普通扳手仍由本人借用');
    expect(workshop.textContent).toContain('尚未购买'); expect(workshop.textContent).toContain('低载负荷已经停止');
    expect(view.container.textContent).not.toMatch(editorial); expect(value).toEqual(before); expect(onClose).not.toHaveBeenCalled();
  });

  it('distinguishes a paid successful diagnosis from an actual repair', () => {
    const value = inside(), attempt = value.life.cases[0]!.attempts[0]!;
    attempt.outcome = 'SUCCESS'; attempt.evidence.abilityAttempted = true;
    const paid = receipt(value, { type: 'PROCESS_ANALYSIS' }); paid.outcome = 'SUCCESS'; paid.after.mind -= 2; paid.after.spirituality -= 6;
    attempt.receipts = [paid]; value.life.practice.abilityUses['paragon.s1.process-analysis'] = { attempts: 1, successes: 1, applied: 0 };
    value.actions = [action({ type: 'HAND_INSPECT' }, '借助原扳手亲手检查', '0行动 · 实际工作')];
    const before = structuredClone(value), view = show(value);
    const costs = screen.getByRole('region', { name: '本次许可与实际消耗' });
    expect(costs.textContent).toContain('能力判定：成功'); expect(costs.textContent).toContain('尚未计作能力实际应用');
    expect(costs.textContent).toContain('本次实耗6灵性、2精神、0健康、0便士');
    expect(screen.getByRole('region', { name: '原工台、工具与实际位置' }).textContent).toContain('本次尚无实际修理记录');
    expect(screen.getByRole('region', { name: '同一原盒与原架' }).textContent).toContain('耐久90/100');
    fireEvent.click(confirm(openPrimary())); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'HAND_INSPECT' }); expect(value).toEqual(before);
  });

  it('shows a paid failed diagnosis and an ordinary repair with the same consumed shim and unchanged charge', () => {
    const value = inside(), attempt = value.life.cases[0]!.attempts[0]!, p = value.life.practice;
    attempt.outcome = 'FAILURE'; attempt.evidence.abilityAttempted = true; attempt.evidence.result = 'ORDINARY';
    const paid = receipt(value, { type: 'PROCESS_ANALYSIS' }); paid.outcome = 'FAILURE'; paid.after.mind -= 2; paid.after.spirituality -= 6;
    const purchase = receipt(value, { type: 'BUY_SHIM' }); purchase.after.cash -= 40;
    const repair = receipt(value, { type: 'REPAIR_FRAME' }); repair.originalsAfter[1]!.durability = 95;
    attempt.receipts = [paid, purchase, repair]; value.life.creations[1]!.durability = 95;
    p.shim.status = 'CONSUMED'; p.shim.purchasedWeek = p.shim.consumedWeek = 170;
    p.abilityUses['paragon.s1.process-analysis'] = { attempts: 1, successes: 0, applied: 0 };
    const before = structuredClone(value), view = show(value);
    expect(screen.getByRole('region', { name: '本次许可与实际消耗' }).textContent).toContain('本次实耗6灵性、2精神、0健康、40便士');
    const workshop = screen.getByRole('region', { name: '原工台、工具与实际位置' });
    expect(workshop.textContent).toContain('同一原架耐久90→95，储能0→0');
    expect(workshop.textContent).toContain('唯一黄铜垫片：已经耗用');
    expect(view.container.textContent).toContain('工艺析解：尝试1次、成功0次、实际应用0次');
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('retains a prior paid repair when ordinary resumption has no second repair receipt', () => {
    const value = inside(), entry = value.life.cases[0]!, p = value.life.practice;
    const prior = structuredClone(entry.attempts[0]!), repair = receipt(value, { type: 'REPAIR_FRAME' });
    repair.originalsAfter[1]!.durability = 95; prior.receipts = [repair, receipt(value, { type: 'ABORT' })];
    const resumed = structuredClone(prior); resumed.invitedWeek = 171; resumed.method = 'ORDINARY'; resumed.receipts = [];
    entry.attempts = [prior, resumed]; p.shim.status = 'CONSUMED'; p.shim.consumedWeek = p.shim.purchasedWeek = 170;
    value.life.creations[1]!.durability = 95;
    const before = structuredClone(value), view = show(value);
    const workshop = screen.getByRole('region', { name: '原工台、工具与实际位置' });
    expect(workshop.textContent).toContain('本案实际修理：同一原架耐久90→95，储能0→0');
    expect(workshop.textContent).not.toContain('本次尚无实际修理记录');
    expect(view.container.textContent).toContain('原结果、已耗材料与已付代价继续保留');
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('keeps cast success distinct from learner failure and exposes an actual ordinary stop', () => {
    const value = inside('taught-stop'), attempt = value.life.cases[1]!.attempts[0]!;
    attempt.outcome = 'SUCCESS'; attempt.learnerOutcome = 'FAILURE'; attempt.evidence.abilityAttempted = true;
    const paid = receipt(value, { type: 'OPERATIONAL_GUIDANCE' }); paid.outcome = 'SUCCESS'; paid.after.mind -= 3; paid.after.spirituality -= 8;
    attempt.receipts = [paid]; value.life.practice.stopBar.loadRunning = true;
    value.life.practice.abilityUses['paragon.s1.operational-guidance'] = { attempts: 1, successes: 1, applied: 0 };
    value.actions = [action({ type: 'MANUAL_STOP' }, '亲手拉下原手柄普通停载', '0行动 · 真实手动操作')];
    const before = structuredClone(value), view = show(value);
    const lesson = screen.getByRole('region', { name: '普通停载与有限教学' });
    expect(lesson.textContent).toContain('维拉的独立尝试：失败');
    expect(lesson.textContent).toContain('操作启示：尝试1次、成功1次、实际应用0次');
    expect(screen.getByRole('region', { name: '本次许可与实际消耗' }).textContent).toContain('本次实耗8灵性、3精神');
    fireEvent.click(confirm(openPrimary())); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'MANUAL_STOP' }); expect(value).toEqual(before);
  });

  it('does not execute a pending teaching window just because it is displayed', () => {
    const value = inside('taught-stop'), p = value.life.practice;
    p.pendingGuidance = { caseId: 'taught-stop', createdAt: 10, expiresAt: 40, permissionRevision: 1, bonus: 10 };
    value.actions = [action({ type: 'LEARNER_TRY' }, '让维拉独立尝试原手柄', '0行动 · 单独实际判定')];
    const before = structuredClone(value), view = show(value);
    expect(screen.getByRole('region', { name: '普通停载与有限教学' }).textContent).toContain('窗口还剩20秒');
    expect(screen.getByRole('region', { name: '普通停载与有限教学' }).textContent).toContain('一次独立普通尝试加值10');
    expect(value).toEqual(before); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('honors revoked current ability permission while retaining ordinary return and existing costs', () => {
    const value = inside('withdrawn-operation'), entry = value.life.cases[2]!;
    entry.permission = { ability: 'WITHDRAWN', teaching: 'GRANTED' }; entry.attempts[0]!.method = 'ORDINARY';
    value.actions = [action({ type: 'RETURN_ORIGINALS' }, '亲手收回两件原物', '0行动 · 实际收取')];
    const before = structuredClone(value), view = show(value);
    expect(screen.getByRole('region', { name: '本次许可与实际消耗' }).textContent).toContain('超凡许可已经撤回');
    expect(screen.getByRole('region', { name: '维拉的本次参与' }).textContent).toContain('普通教学许可：当前明确同意');
    fireEvent.click(confirm(openPrimary())); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'RETURN_ORIGINALS' }); expect(value).toEqual(before);
  });

  it('labels a finished case consent as historical rather than reusing it for a fresh invitation', () => {
    const value = inside(); value.insideCase = value.life.insideCase = false; value.life.practice.activeCase = null; value.life.practice.participant.present = false;
    value.life.cases[0]!.contactOpen = false; value.life.cases[0]!.status = 'RESOLVED'; value.life.cases[0]!.attempts[0]!.evidence.returned = true;
    const view = show(value); fireEvent.change(picker(), { target: { value: 'worn-bearing' } });
    expect(screen.getByRole('region', { name: '维拉的本次参与' }).textContent).toContain('本案曾明确同意，当前无生效许可');
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('shows every cleanup option and keeps safe abort a separate confirmed command', () => {
    const value = inside(); value.actions = [action({ type: 'READ_RECORDS' }, '亲自读取原制造记录'),
      ...(['MANUAL_STOP', 'RETURN_ORIGINALS', 'RETURN_WRENCH', 'RETURN_HOME', 'ABORT'] as const).map((type, index) => ({ ...action({ type }, ['普通停载', '亲手收回原物', '归还借用扳手', '沿原路返回', '安全中止'][index]!, '0行动 · 保留代价'), cleanup: true }))];
    value.preferredActionId = value.actions[0]!.id; const view = show(value);
    const options = within(screen.getByRole('region', { name: '恢复与收尾' })).getAllByRole('button'); expect(options).toHaveLength(5);
    fireEvent.click(options[4]!); fireEvent.click(confirm()); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'ABORT' });
  });
});

describe('Civilization Enlightener panel: independent encounter and physical exit', () => {
  function ready() {
    const value = fixture(true); value.life.reflected = true; value.encounter.status = 'READY'; value.encounter.inside = value.insideCase = true;
    value.encounter.scene.playerLocation = 'YARD'; value.encounter.scene.playerCoordinate = 4; value.encounter.scene.playerTravelMetres = 4; value.encounter.scene.clockSeconds = 4;
    value.actions = [action({ type: 'ENCOUNTER_FIGHT' }, '选择与阿德里安真实交战', '1行动'),
      action({ type: 'ENCOUNTER_POLICY', policy: 'ALL' }, '允许两项新能力', '0行动 · 开战后不更换'),
      action({ type: 'LEAVE_ENCOUNTER' }, '沿普通出口和平离开', '0行动 · 实际步行4米')];
    value.encounter.actions = value.actions; value.preferredActionId = value.actions[0]!.id; return value;
  }
  it('allows local viewing of the optional encounter and its blocked reason without dispatch', () => {
    const view = show(fixture(true)); fireEvent.change(picker(), { target: { value: 'encounter' } });
    expect(screen.getByRole('region', { name: '文明启蒙者可选真实交战' })).toBeTruthy();
    expect(disabled(primary())).toBe(true); expect(primary().textContent).toContain('亲自到工院交谈');
    expect(view.container.textContent).toContain('先完成三份报告与反思'); expect(view.onCommand).not.toHaveBeenCalled();
  });
  it('requires a real battle confirmation with the independent adult and terminal death consequences', () => {
    const view = show(ready()), dialog = openPrimary();
    expect(dialog.textContent).toContain('阿德里安·黑尔'); expect(dialog.textContent).toContain('普通死亡终结本周目');
    expect(view.onCommand).not.toHaveBeenCalled(); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'ENCOUNTER_FIGHT' });
  });
  it('preserves exact policy intent and shows the finite enemy and same unpowered original objects', () => {
    const value = ready(); value.encounter.enemy.health = 63; value.encounter.enemy.mind = 72; value.encounter.enemy.spirituality = 97;
    value.encounter.materials.weapon.location = 'YARD'; value.encounter.materials.mechanism.charge = 2;
    const before = structuredClone(value), view = show(value);
    expect(view.container.textContent).toContain('健康63/100、精神72/100、灵性97/120');
    const originals = screen.getByRole('region', { name: '对手原杖与可见机械' });
    expect(originals.textContent).toContain('已落在原工院地面，完整度100/100'); expect(originals.textContent).toContain('原可见机械储能2/4');
    expect(screen.getByRole('region', { name: '同一原盒与原架' }).textContent).toContain('AL4-FRAME-1：储能0/3，耐久90/100');
    expect(view.container.textContent).toContain('维拉与旧案中的人没有到场');
    chooseExtra(value.actions[1]!.id); fireEvent.click(screen.getByRole('button', { name: /允许两项新能力/ })); fireEvent.click(confirm());
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'ENCOUNTER_POLICY', policy: 'ALL' }); expect(value).toEqual(before);
  });
  it('keeps a living surrendered opponent distinct from a dead one', () => {
    const value = ready(); value.encounter.enemy.health = 63; value.encounter.enemy.mind = 0; value.encounter.enemy.status = 'SURRENDERED';
    value.encounter.status = 'RESOLVED'; value.encounter.inside = value.insideCase = false; value.actions = [];
    const view = show(value);
    expect(view.container.textContent).toContain('健康63/100、精神0/100'); expect(view.container.textContent).toContain('已投降');
    expect(view.onCommand).not.toHaveBeenCalled();
  });
  it('keeps peaceful four-metre departure separate from view navigation', () => {
    const value = ready(), onClose = vi.fn(), view = show(value, { onClose });
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    const exit = within(screen.getByRole('region', { name: '恢复与收尾' })).getByRole('button');
    expect(exit.textContent).toContain('实际步行4米'); fireEvent.click(exit); fireEvent.click(confirm());
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEAVE_ENCOUNTER' }); expect(value.encounter.scene.playerCoordinate).toBe(4); expect(onClose).not.toHaveBeenCalled();
  });
});
