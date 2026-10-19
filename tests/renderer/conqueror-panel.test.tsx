/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ConquerorPanel, type ConquerorPanelProps } from '../../src/renderer/ConquerorPanel.js';
import type { ConquerorAction, ConquerorCommand, ConquerorProjection } from '../../src/domain/conqueror/types.js';
import { CONQUEROR_ABILITIES, CONQUEROR_CONSUMPTION_RISK, CONQUEROR_INHERITED_ABILITIES } from '../../src/domain/conqueror/content.js';

afterEach(cleanup);

// Explicit renderer-only UNIT public projections. These test presentation and
// intent dispatch, not a natural campaign, a valid save, or domain transitions.
function action(command: ConquerorCommand, label: string, cost = '0行动', enabled = true, reason: string | null = null): ConquerorAction {
  return { id: `${command.type}:${'bottleId' in command ? command.bottleId : 'caseId' in command ? command.caseId : 'policy' in command ? command.policy : ''}:${'method' in command ? command.method : ''}`,
    command, label, cost, enabled, reason };
}
function fixture(promoted = false): ConquerorProjection {
  const actions = promoted ? [
    action({ type: 'OBSERVE', caseId: 'yard-cart' }, '观察原院车', '1行动'),
    action({ type: 'OBSERVE', caseId: 'iron-target' }, '观察原铁件', '1行动', false, '先完成上一案。'),
    action({ type: 'OBSERVE', caseId: 'withdrawn-permission' }, '观察原木箱', '1行动', false, '先完成上一案。'),
    action({ type: 'REST_TEAM' }, '为原成员安排在家休整', '0行动 · 40便士 · 下一真实周才恢复'),
    action({ type: 'ENCOUNTER_TALK' }, '亲自到铸工外院交谈', '1行动 · 另留1行动供自主决定', false, '先完成三份报告与反思。'),
  ] : [action({ type: 'LEARN_GUIDANCE' }, '听取征服者成品与专业准备指导', '1行动 · 500便士')];
  return {
    title: '征服者·猎人序列1', discovered: true, guidanceKnown: promoted, promoted,
    formulaKnown: false, formula: [], story: '原指导者介绍独立封存的征服者成品魔药。',
    supplies: '每瓶6400便士，或为本瓶完成五项劳动后支付900便士。',
    nextStep: '按实际状态决定下一步。', preferredActionId: actions[0]!.id, actions,
    bottles: [1, 2, 3].map(number => ({ id: `conqueror-potion-${number}`, title: `第${number}瓶 · 征服者成品魔药`, source: `第${number}瓶独立原封存药，单独交付与耗用。`, status: '供应方保管 · 劳动0/5', chance: 68, command: { type: 'CONSUME', bottleId: `conqueror-potion-${number}`, confirmed: true } })),
    preparations: [{ taskId: 'REVIEW_RECORDS', title: '核对八阶原瓶与原队经历', completedWeek: null }, { taskId: 'CHECK_LIMITS', title: '检查合力与凝焰的使用边界', completedWeek: null }, { taskId: 'MARK_EXIT', title: '走查普通出口与中止求助', completedWeek: null }],
    preparedWeek: null,
    abilities: promoted ? [...CONQUEROR_INHERITED_ABILITIES.map((ability, index) => ({ ...ability, mastery: index === 0 ? 0 : index + 8 })), ...CONQUEROR_ABILITIES.map(ability => ({ ...ability, mastery: 0 }))] : [],
    acting: 0, digestion: promoted ? '征服者扮演0/100；三份生活报告与反思分别结算。' : '天气术士消化100，晋升后须12整周。', pollution: 0, risk: CONQUEROR_CONSUMPTION_RISK,
    resources: { health: 100, maxHealth: 100, mind: promoted ? 85 : 100, maxMind: 100, spirituality: 101, maxSpirituality: 120, cash: '576便士', actionsRemaining: 2 },
    injuries: [{ id: 'original-light-injury', severity: 'LIGHT', treated: false }], injuryRisk: 7,
    currentGender: 'MALE', originalGender: 'FEMALE', appearanceRecord: '当前角色男性；铁血骑士原身体变化与旧伤继续保留。', inheritedTools: '原奥伦已投降，原棍留在原处。', inheritedHistory: ['天气术士第155周晋升，原八阶记录保留。'],
    life: {
      title: '五个名字、同一原物与可撤回的许可', source: '三项训练院有限实践。', environment: '本人和原五人沿原路行动；每次邀请各人重新同意，零行动收尾仍付实际代价。', insideCase: false, reflected: false,
      practice: { activeCase: null, ownerNode: 'ENTRY', elapsedSeconds: 0, memberPositions: [], tools: [{ id: 'CQ1-LEVER-1', caseId: 'yard-cart', holder: 'RACK' }, { id: 'CQ1-TONGS-1', caseId: 'iron-target', holder: 'RACK' }, { id: 'CQ1-STRAPS-1', caseId: 'withdrawn-permission', holder: 'RACK' }],
        cart: { id: 'CQ1-CART-1', resistance: 60, movedMetres: 0 }, iron: { id: 'CQ1-IRON-1', integrity: 100, heatDamage: 0, temperature: 20, cooldownSeconds: 0, observed: false }, backstop: { id: 'CQ1-BACKSTOP-1', charred: false }, crate: { id: 'CQ1-CRATE-1', movedMetres: 0 }, water: { id: 'CQ1-WATER-1', wasteBasinId: 'CQ1-BASIN-1', remainingMl: 2000, usedMl: 0 },
        abilityUses: { 'hunter.s1.formation-momentum': { attempts: 0, successes: 0, applied: 0 }, 'hunter.s1.focused-flame': { attempts: 0, successes: 0, applied: 0 } } },
      members: ['艾达', '本尼特', '克拉拉', '德里克', '艾琳'].map((name, index) => ({ id: `IB4-0${index + 1}`, name, health: 100, energy: index === 4 ? 6 : 5, willing: true, present: false, location: 'HOME', eligible: index === 4, distanceMetres: null })),
      cases: [{ id: 'yard-cart', title: '原院车合力', story: '用同一原车练习有限合力。', observations: [], status: 'AVAILABLE', contactOpen: false, preparation: null, result: null, returned: false, attempts: [] },
        { id: 'iron-target', title: '原铁件凝焰', story: '同一原铁件仍保有真实热量和热损。', observations: [], status: 'AVAILABLE', contactOpen: false, preparation: null, result: null, returned: false, attempts: [] },
        { id: 'withdrawn-permission', title: '撤回许可后的普通搬运', story: '物主只同意普通搬运原木箱。', observations: [], status: 'AVAILABLE', contactOpen: false, preparation: null, result: null, returned: false, attempts: [] }],
      ledger: [], restRequestedWeek: null,
    },
    encounter: {
      title: '铸工外院的通行争议', story: '罗南保有独立身体与原物。可以和平离场，或自行决定是否真实交战。', status: 'AVAILABLE', inside: false, policy: 'HOLD', preparation: null,
      scene: { siteId: 'CQ1-OPEN-FOUNDRY-YARD', playerLocation: 'WORKSHOP', playerCoordinate: 0, enemyCoordinate: 14, ordinaryExit: 'OPEN', thirdPartiesInArea: 0, presentMemberIds: [], observedSourceId: null, observationWeek: null, clockSeconds: 0, externalSeconds: 0, playerTravelMetres: 0 },
      materials: { weapon: { id: 'CQ1-RONAN-IRON-ROD', sourceId: 'CQ1-RONAN-OWNED-IRON-1', owner: 'CQ1-RONAN-HALE', massKg: 2, location: 'HAND', temperatureC: 20, condition: 100, deformations: 0, heatingPulses: 0 }, water: { id: 'CQ1-RONAN-WATER-BUCKET', sourceId: 'CQ1-RONAN-OWNED-WATER-1', owner: 'CQ1-RONAN-HALE', initialLitres: 20, remainingLitres: 20, uses: 0 } },
      enemy: { id: 'CQ1-RONAN-HALE', name: '罗南·黑尔', age: 47, sequence: 1, health: 100, mind: 100, spirituality: 120, status: 'RESISTING', weaponLocation: 'HAND', powerUses: { FIRE_JET: 0, WARD: 0, COOL_WEAPON: 0, MENTAL_PRESSURE: 0 }, abilities: ['有限火流', '单次挡火屏护'] },
      actions: actions.filter(item => item.command.type === 'ENCOUNTER_TALK'), facts: ['每次焰势凝束先付8灵性2精神；失败不退款。', '原铁杖自然每秒冷却1度，原水每次耗2升降温200度；降温不修复变形。'],
    },
    insideCase: false, environment: '原成员、原车与原铁件各有唯一身份。',
  };
}
function show(value = fixture(), extra: Partial<ConquerorPanelProps> = {}) {
  const onCommand = vi.fn();
  return { ...render(<ConquerorPanel value={value} busy={false} onCommand={onCommand} {...extra} />), onCommand };
}
const primary = () => within(screen.getByRole('region', { name: '当前主要操作' })).getByRole('button');
const disabled = (control: HTMLElement) => (control as HTMLButtonElement).disabled;
const picker = () => screen.getByRole('combobox', { name: '征服者目标' });
const resources = () => screen.getAllByRole('region', { name: '征服者当前资源' })[0]!;
function openPrimary() { fireEvent.click(primary()); return screen.getByRole('dialog', { name: '征服者操作确认' }); }
function confirm(dialog = screen.getByRole('dialog')) { return within(dialog).getByRole('button', { name: /^(确认执行这一次操作|确认服用这一原瓶|确认开始真实交战)$/ }); }
function chooseExtra(id: string) {
  const select = screen.getByRole('combobox', { name: '征服者其他操作', hidden: true });
  (select.closest('details') as HTMLDetailsElement).open = true;
  fireEvent.change(select, { target: { value: id } });
}
const editorial = /候选|原创G|本作G|原文未核|编号推断|\b(HOME|YARD|ENTRY|WORK|RESISTING)\b|"command"|"before"/;

describe('Conqueror panel: public facts, original potion and compact navigation', () => {
  it('shows actual resources and three independent bottles with one primary action', () => {
    const view = show();
    expect(screen.getByRole('heading', { name: '征服者·猎人序列1' })).toBeTruthy();
    expect(resources().textContent).toContain('健康100/100 · 精神100/100 · 灵性101/120');
    expect(resources().textContent).toContain('576便士 · 本周行动2 · 现有伤势1处 · 累计风险7');
    expect(within(picker()).getAllByRole('option')).toHaveLength(3);
    expect(primary().textContent).toContain('1行动 · 500便士');
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('第1瓶独立原封存药');
    expect(view.container.textContent).not.toMatch(editorial);
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('preserves the selected bottle through changed saved facts without submitting a selection', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<ConquerorPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.change(picker(), { target: { value: 'conqueror-potion-2' } });
    const next = structuredClone(value); next.bottles[1]!.status = '供应方保管 · 劳动1/5';
    view.rerender(<ConquerorPanel value={next} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('第2瓶独立原封存药');
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('劳动1/5');
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('allows choosing an owned original during paid preparation and confirms its exact typed command', () => {
    const value = fixture(); value.preparedWeek = 167; value.insideCase = true;
    value.bottles[0]!.status = value.bottles[1]!.status = '已交付，尚未服用';
    value.actions = value.bottles.slice(0, 2).map(bottle => action(bottle.command, `独立确认服用${bottle.title}`, '0行动 · 当周准备已付140便士'));
    value.preferredActionId = value.actions[0]!.id;
    const before = structuredClone(value), view = show(value);
    expect(disabled(picker())).toBe(false);
    fireEvent.change(picker(), { target: { value: value.bottles[1]!.id } });
    const dialog = openPrimary();
    expect(dialog.textContent).toContain('第2瓶独立原封存药');
    expect(dialog.textContent).toContain('当前成功率68%');
    expect(dialog.textContent).toContain('健康−15、精神−25、排异+30');
    expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备');
    expect(dialog.textContent).not.toContain('接受角色变化');
    fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith(value.bottles[1]!.command);
    expect(value).toEqual(before);
  });

  it('retains all 21 inherited masteries and exposes both new zero-mastery abilities', () => {
    const value = fixture(true), view = show(value);
    const fold = screen.getByText('能力、消化与继承经历').closest('details')!; fold.open = true;
    expect(value.abilities).toHaveLength(23);
    expect(within(fold).getByRole('heading', { name: '追踪 · 掌握0' })).toBeTruthy();
    expect(within(fold).getByRole('heading', { name: '阵势合力 · 掌握0' })).toBeTruthy();
    expect(within(fold).getByRole('heading', { name: '焰势凝束 · 掌握0' })).toBeTruthy();
    expect(fold.textContent).toContain('原奥伦已投降');
    expect(fold.textContent).toContain('铁血骑士原身体变化与旧伤继续保留');
    expect(view.container.textContent).not.toMatch(editorial);
  });

  it('shows a saved failed potion as spent with real damage and no second consumption', () => {
    const value = fixture(), bottle = value.bottles[0]!;
    bottle.status = '已交付，尚未服用'; value.preparedWeek = 167; value.insideCase = true;
    value.actions = [action(bottle.command, '独立确认服用第1瓶征服者魔药', '0行动 · 当周准备已付140便士')];
    const onCommand = vi.fn(), view = render(<ConquerorPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(confirm(openPrimary()));
    view.rerender(<ConquerorPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    const saved = structuredClone(value); saved.bottles[0]!.status = '原瓶已耗尽 · 排异，仍为天气术士';
    saved.preparedWeek = null; saved.insideCase = false; saved.resources!.health = 85; saved.resources!.mind = 75; saved.pollution = 30;
    saved.actions = [action({ type: 'BUY_POTION', bottleId: saved.bottles[1]!.id }, '领取第2瓶征服者魔药', '0行动 · 6400便士')];
    view.rerender(<ConquerorPanel value={saved} busy={false} onCommand={onCommand} />);
    fireEvent.change(picker(), { target: { value: bottle.id } });
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('原瓶已耗尽 · 排异');
    expect(resources().textContent).toContain('健康85/100 · 精神75/100 · 灵性101/120 · 排异30');
    expect(saved.injuries).toEqual(value.injuries); expect(saved.bottles[1]!.status).toBe('供应方保管 · 劳动0/5');
    expect(screen.queryByRole('dialog')).toBeNull(); expect(onCommand).toHaveBeenCalledExactlyOnceWith(bottle.command);
  });
});

describe('Conqueror panel: modal focus and saved-fact guards', () => {
  it('traps focus, disables background controls, and restores focus after cancel and Escape', () => {
    const onClose = vi.fn(), view = show(fixture(), { onClose }), button = primary(), dialog = openPrimary();
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: '听取征服者成品与专业准备指导' }));
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(confirm(dialog));
    fireEvent.keyDown(dialog, { key: 'Tab' }); expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    expect(disabled(picker())).toBe(true); expect(disabled(screen.getByRole('button', { name: '返回普通生活' }))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(button);
    fireEvent.keyDown(openPrimary(), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(button);
    expect(onClose).not.toHaveBeenCalled(); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('locks double submission and dismissal until the saved facts actually change', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<ConquerorPanel value={value} busy={false} onCommand={onCommand} />);
    const dialog = openPrimary(), button = confirm(dialog);
    fireEvent.click(button); fireEvent.click(button);
    view.rerender(<ConquerorPanel value={structuredClone(value)} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true);
    expect(disabled(within(dialog).getByRole('button', { name: '取消，返回查看' }))).toBe(true);
    fireEvent.keyDown(dialog, { key: 'Escape' }); expect(screen.getByRole('dialog')).toBe(dialog);
    expect(screen.getByRole('status').textContent).toContain('正在结算并保存');
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEARN_GUIDANCE' });
  });

  it('closes an unsubmitted confirmation on error and leaves retry to the same save operation', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<ConquerorPanel value={value} busy={false} onCommand={onCommand} />);
    openPrimary(); view.rerender(<ConquerorPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.getByRole('alert').textContent).toContain('同一次保存');
    expect(screen.getByRole('alert').textContent).toContain('上次已保存的记录'); expect(disabled(primary())).toBe(true);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('keeps a submitted intent locked across error clearing and only releases it after changed saved facts', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<ConquerorPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(confirm(openPrimary()));
    view.rerender(<ConquerorPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    view.rerender(<ConquerorPanel value={value} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true); fireEvent.click(primary()); expect(onCommand).toHaveBeenCalledTimes(1);
    const saved = structuredClone(value); saved.guidanceKnown = true; saved.resources!.cash = '76便士'; saved.resources!.actionsRemaining = 1;
    saved.actions = [action({ type: 'PREPARE_TASK', taskId: 'REVIEW_RECORDS' }, '核对八阶原瓶与原队经历', '1行动')];
    view.rerender(<ConquerorPanel value={saved} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('status')).toBeNull(); expect(disabled(primary())).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: saved.title }));
    expect(resources().textContent).toContain('76便士'); expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it('invalidates a stale confirmation even if a newer action reuses its id with a different command', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<ConquerorPanel value={value} busy={false} onCommand={onCommand} />);
    const stale = confirm(openPrimary()), newer = structuredClone(value);
    newer.actions[0]!.command = { type: 'PREPARE_TASK', taskId: 'MARK_EXIT' };
    view.rerender(<ConquerorPanel value={newer} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull(); fireEvent.click(stale); expect(onCommand).not.toHaveBeenCalled();
  });

  it('waits for busy to clear before accepting changed saved facts as the end of a submission', () => {
    const value = fixture(), onCommand = vi.fn(), view = render(<ConquerorPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(confirm(openPrimary()));
    const saved = structuredClone(value); saved.guidanceKnown = true; saved.resources!.cash = '76便士';
    view.rerender(<ConquerorPanel value={saved} busy onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true); expect(screen.getByRole('status')).toBeTruthy();
    view.rerender(<ConquerorPanel value={saved} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(false); expect(screen.queryByRole('status')).toBeNull();
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it('blocks busy, externally blocked and dead controls without changing resources or closing', () => {
    for (const mode of ['busy', 'blocked', 'dead'] as const) {
      const value = fixture(true); if (mode === 'dead') value.resources!.health = 0;
      const onClose = vi.fn(), view = show(value, { busy: mode === 'busy', blocked: mode === 'blocked', onClose });
      for (const button of screen.getAllByRole('button')) expect(disabled(button)).toBe(true);
      expect(disabled(picker())).toBe(true);
      if (mode === 'dead') expect(view.container.textContent).toContain('本周目已经死亡');
      expect(view.onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled(); view.unmount();
    }
  });

  it('closes only an outside view without dispatching healing, movement, returns or promotion', () => {
    const onClose = vi.fn(), view = show(fixture(), { onClose });
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(onClose).toHaveBeenCalledOnce(); expect(view.onCommand).not.toHaveBeenCalled();
  });
});

describe('Conqueror panel: actual original people, ordinary work and retained heat', () => {
  it('shows the original low energy and makes paid cross-week recovery easy to discover', () => {
    const value = fixture(true), before = structuredClone(value), view = show(value);
    const members = screen.getByRole('region', { name: '原五位同伴的实际状态' });
    expect(members.textContent).toContain('艾达：健康100/100 · 精力5/20 · 当前自愿 · 未到场 · 原家中');
    expect(members.textContent).toContain('艾琳：健康100/100 · 精力6/20');
    expect(members.textContent).toContain('下一真实周');
    const rest = within(screen.getByRole('region', { name: '恢复与收尾' })).getByRole('button');
    expect(rest.textContent).toContain('40便士'); fireEvent.click(rest); fireEvent.click(confirm());
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'REST_TEAM' }); expect(value).toEqual(before);
  });

  it('shows a paid rest as still pending and dispatches only the separately enabled recovery command', () => {
    const value = fixture(true); value.life.restRequestedWeek = 167;
    value.actions = [action({ type: 'RECOVER_TEAM' }, '确认原成员跨周后的有限恢复', '0行动 · 至多健康+20、精力+8', false, '需要经过下一真实周。')];
    const onCommand = vi.fn(), view = render(<ConquerorPanel value={value} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole('region', { name: '原五位同伴的实际状态' }).textContent).toContain('第167周已支付');
    expect(disabled(primary())).toBe(true);
    const next = structuredClone(value); next.actions[0]!.enabled = true; next.actions[0]!.reason = null;
    view.rerender(<ConquerorPanel value={next} busy={false} onCommand={onCommand} />);
    fireEvent.click(confirm(openPrimary())); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'RECOVER_TEAM' });
    expect(next.life.members[0]!.energy).toBe(5);
  });

  it('keeps goal selection local and offers an exact ordinary alternative without inventing an action', () => {
    const value = fixture(true); value.life.cases[0]!.status = 'OBSERVED';
    const ability = action({ type: 'INVITE_TEAM', caseId: 'yard-cart', method: 'ABILITY' }, '邀请原五人练习有限合力', '1行动 · 40便士');
    const ordinary = action({ type: 'INVITE_TEAM', caseId: 'yard-cart', method: 'ORDINARY' }, '邀请原五人普通推车', '1行动 · 40便士');
    value.actions = [ability, ordinary]; value.preferredActionId = ability.id;
    const view = show(value); chooseExtra(ordinary.id);
    expect(view.onCommand).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /邀请原五人普通推车/ })); fireEvent.click(confirm());
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith(ordinary.command);
  });

  it('shows saved failure, scalar consumption, heat, cooldown and original material locations', () => {
    const value = fixture(true), p = value.life.practice, entry = value.life.cases[1]!;
    value.insideCase = value.life.insideCase = true; p.activeCase = entry.id; p.ownerNode = 'WORK'; p.elapsedSeconds = 33;
    p.iron = { id: 'CQ1-IRON-1', integrity: 90, heatDamage: 10, temperature: 60, cooldownSeconds: 30, observed: true };
    p.backstop.charred = true; p.tools[1]!.holder = 'WORK'; p.abilityUses['hunter.s1.focused-flame'] = { attempts: 1, successes: 0, applied: 0 };
    value.life.members.forEach((member, index) => { member.health = 99; member.energy = 10; member.present = true; member.location = 'YARD'; member.distanceMetres = index + 1; });
    entry.status = 'ACTIVE'; entry.result = '本次能力失败，真实损耗保留；安全冷却后可普通完成。';
    entry.attempts = [{ invitedWeek: 169, method: 'ABILITY', outcome: 'FAILURE', evidence: { permission: 'GRANTED', result: 'NONE', abilityAttempted: true, abilityApplied: false, returned: false, aborted: false },
      receipts: [{ week: 169, date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 9, day: 16 }, revision: 700, randomBefore: 300, randomAfter: 301, checkBase: 50, check: null, command: { type: 'APPLY_POWER' }, outcome: 'FAILURE', before: { health: 100, mind: 85, spirituality: 101, cash: 500, actions: 2 }, after: { health: 99, mind: 83, spirituality: 89, cash: 500, actions: 2 }, elapsedSeconds: 3, ownerWalkedMetres: 0, toolTravelMetres: 0, memberCosts: value.life.members.map(member => ({ id: member.id, energySpent: 1, healthLoss: 1, walkedMetres: 0 })) }] }];
    value.actions = [action({ type: 'COOL_DOWN' }, '明确等待原铁件冷却', '0行动 · 实等30秒 · 热损保留'), action({ type: 'RETURN_HOME' }, '安全归还原工具并让五人实际回家', '0行动 · 各1精力', false, '原铁件须先冷却。')];
    const view = show(value, { onClose: vi.fn() });
    expect(disabled(picker())).toBe(true); expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    const materials = screen.getByRole('region', { name: '原现场与热量冷却' });
    expect(materials.textContent).toContain('完整度90/100 · 实际热损10 · 温度60℃ · 还须明确冷却30秒');
    expect(materials.textContent).toContain('原钳随本人在原工位'); expect(materials.textContent).toContain('已留下焦痕');
    expect(screen.getByRole('region', { name: '本次许可与实际消耗' }).textContent).toContain('本次实耗12灵性、2精神、1健康、0便士；五人合计实耗5精力');
    expect(view.container.textContent).not.toMatch(editorial);
    fireEvent.click(confirm(openPrimary())); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'COOL_DOWN' });
    expect(p.iron.temperature).toBe(60); expect(p.iron.integrity).toBe(90);
  });

  it('keeps withdrawn permission explicit and dispatches only the available ordinary work', () => {
    const value = fixture(true), entry = value.life.cases[2]!;
    value.insideCase = value.life.insideCase = true; value.life.practice.activeCase = entry.id;
    entry.status = 'ACTIVE'; entry.attempts = [{ invitedWeek: 171, method: 'ORDINARY', outcome: null, evidence: { permission: 'WITHDRAWN', result: 'NONE', abilityAttempted: false, abilityApplied: false, returned: false, aborted: false }, receipts: [] }];
    value.actions = [action({ type: 'ORDINARY_WORK' }, '按当前许可用原绑带普通完成', '0行动 · 各2精力 · 1精神 · 20秒')];
    const view = show(value);
    expect(screen.getByRole('region', { name: '本次许可与实际消耗' }).textContent).toContain('超凡许可已经撤回，仅同意普通搬运');
    fireEvent.click(confirm(openPrimary())); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'ORDINARY_WORK' });
  });

  it('exposes safe abort as actual paid movement and preserves its exact command', () => {
    const value = fixture(true); value.insideCase = value.life.insideCase = true; value.life.practice.activeCase = 'yard-cart';
    value.actions = [action({ type: 'ENTER_WORK' }, '带原工具与同伴实际进入工位', '0行动 · 各1精力 · 5米/10秒'), action({ type: 'ABORT' }, '安全中止本次现场，实际还物回家', '0行动 · 各1精力 · 20秒 · 不退款或重置')];
    value.preferredActionId = value.actions[0]!.id;
    const view = show(value), abort = within(screen.getByRole('region', { name: '恢复与收尾' })).getByRole('button');
    expect(abort.textContent).toContain('各1精力'); fireEvent.click(abort); fireEvent.click(confirm());
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'ABORT' });
    expect(value.life.practice.activeCase).toBe('yard-cart');
  });

  it('keeps an aborted attempt and its cost visible while ordinary continuation remains a separate invitation', () => {
    const value = fixture(true), entry = value.life.cases[0]!;
    entry.status = 'PAUSED'; entry.returned = true;
    entry.attempts = [{ invitedWeek: 168, method: 'ABILITY', outcome: 'FAILURE', evidence: { permission: 'GRANTED', result: 'NONE', abilityAttempted: true, abilityApplied: false, returned: true, aborted: true }, receipts: [] }];
    value.actions = [action({ type: 'INVITE_TEAM', caseId: 'yard-cart', method: 'ORDINARY' }, '重新邀请原五人普通续办', '1行动 · 40便士', false, '下一真实周才能重新邀请。')];
    const view = show(value);
    expect(within(picker()).getByRole('option', { name: /已安全中止，待普通续办/ })).toBeTruthy();
    expect(screen.getByRole('region', { name: '本次许可与实际消耗' }).textContent).toContain('不能重抽本次能力结果');
    expect(disabled(primary())).toBe(true); fireEvent.click(primary());
    expect(view.onCommand).not.toHaveBeenCalled();
  });
});

describe('Conqueror panel: optional real encounter and retained original iron', () => {
  function ready(): ConquerorProjection {
    const value = fixture(true); value.life.reflected = true; value.encounter.status = 'READY'; value.encounter.inside = value.insideCase = true;
    value.encounter.preparation = { week: 172, actionsPaid: 1 }; value.encounter.scene.playerLocation = 'YARD'; value.encounter.scene.playerCoordinate = 12; value.encounter.scene.clockSeconds = 12; value.encounter.scene.playerTravelMetres = 12;
    value.actions = [action({ type: 'ENCOUNTER_FIGHT' }, '选择与罗南真实交战', '1行动'), action({ type: 'SET_POLICY', policy: 'FOCUS_FLAME' }, '允许焰势凝束', '0行动 · 实际施放另付8灵性2精神'), action({ type: 'LEAVE_ENCOUNTER' }, '沿原出口和平离开', '0行动 · 实走12米/12秒')];
    value.encounter.actions = value.actions; value.preferredActionId = value.actions[0]!.id; return value;
  }

  it('selects the optional encounter locally and exposes the reason it cannot yet start', () => {
    const view = show(fixture(true)); fireEvent.change(picker(), { target: { value: 'encounter' } });
    expect(screen.getByRole('region', { name: '征服者可选真实交战' })).toBeTruthy();
    expect(primary().textContent).toContain('亲自到铸工外院交谈'); expect(disabled(primary())).toBe(true);
    expect(view.container.textContent).toContain('先完成三份报告与反思'); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('requires explicit real-battle confirmation and submits only the original fight command', () => {
    const value = ready(), view = show(value), dialog = openPrimary();
    expect(dialog.textContent).toContain('罗南·黑尔'); expect(dialog.textContent).toContain('普通死亡终结本周目');
    expect(view.onCommand).not.toHaveBeenCalled(); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'ENCOUNTER_FIGHT' });
  });

  it('keeps policy changes separate from battle and preserves exact policy command content', () => {
    const value = ready(), policy = value.actions[1]!, view = show(value); chooseExtra(policy.id);
    fireEvent.click(screen.getByRole('button', { name: /允许焰势凝束/ })); fireEvent.click(confirm());
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'SET_POLICY', policy: 'FOCUS_FLAME' });
    expect(value.encounter.policy).toBe('HOLD');
  });

  it('shows actual enemy health, depleted water and damaged hot original iron without raw ids', () => {
    const value = ready(); value.encounter.enemy.health = 63; value.encounter.enemy.spirituality = 97;
    value.encounter.materials.weapon = { ...value.encounter.materials.weapon, location: 'YARD', temperatureC: 605, condition: 80, deformations: 1, heatingPulses: 3 };
    value.encounter.materials.water.remainingLitres = 16; value.encounter.materials.water.uses = 2;
    const view = show(value), materials = screen.getByRole('region', { name: '对手原铁杖与原水' });
    expect(materials.textContent).toContain('已落在原院地面'); expect(materials.textContent).toContain('温度605℃，耐久80/100');
    expect(materials.textContent).toContain('还剩16/20升'); expect(view.container.textContent).toContain('健康63/100、精神100/100、灵性97/120');
    expect(view.container.textContent).toContain('原队员没有到场'); expect(view.container.textContent).not.toMatch(editorial);
    expect(view.container.textContent).not.toContain('CQ1-RONAN-IRON-ROD'); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('makes actual peaceful exit visible and confirms the separate original leave command', () => {
    const value = ready(), view = show(value), exit = within(screen.getByRole('region', { name: '恢复与收尾' })).getByRole('button');
    expect(exit.textContent).toContain('实走12米/12秒'); fireEvent.click(exit); fireEvent.click(confirm());
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEAVE_ENCOUNTER' });
    expect(value.encounter.scene.playerCoordinate).toBe(12);
  });
});
