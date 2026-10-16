/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlaneswalkerPanel } from '../../src/renderer/PlaneswalkerPanel';
import type { PlaneswalkerPanelProps } from '../../src/renderer/PlaneswalkerPanel';
import type { PlaneswalkerAction, PlaneswalkerCommand, PlaneswalkerProjection } from '../../src/domain/planeswalker/types';
import { createPlaneswalkerRitualState } from '../../src/domain/planeswalker/ritual';
import { createPlaneswalkerSiteState } from '../../src/domain/planeswalker/resources';
import { PLANESWALKER_ABILITIES, PLANESWALKER_CONSUMPTION_RISK, PLANESWALKER_PRICES } from '../../src/domain/planeswalker/content';

// Directed public presentation fixtures only. These are not full campaign saves,
// replay evidence, natural outcomes, or a claim that any advancement is eligible.
// Reuse small original-object constructors, without importing the whole campaign.
const PANEL = '旅法师';
type Visit = NonNullable<PlaneswalkerProjection['ritual']['currentVisit']>;
type SiteId = PlaneswalkerProjection['ritual']['sites'][number]['id'];
const SITE_NAMES = ['铜脊聚居点', '盐井聚居点', '琉砂聚居点', '芦穹聚居点', '灰湾聚居点', '潮痕聚居点', '钟谷聚居点', '灯原聚居点', '石环聚居点'];
function action(command: PlaneswalkerCommand, label: string, cost = '0行动', reason: string | null = null): PlaneswalkerAction {
  return { id: JSON.stringify(command), command, label, cost, enabled: reason === null, reason };
}
function fixture(): PlaneswalkerProjection {
  const original = createPlaneswalkerRitualState();
  const sites = Object.values(original.sites).map(site => ({ ...site, status: '尚未亲访帮助', task: `当面帮助${site.witness.name}修复${site.object.name}。` }));
  const routes = sites.map(site => ({ ...action({ type: 'PREPARE_ROUTE_KIT', siteId: site.id }, `准备前往${site.name}的原套件`, '1行动、30便士'), command: { type: 'PREPARE_ROUTE_KIT' as const, siteId: site.id } }));
  return {
    title: '旅法师', discovered: true, guidanceKnown: true, promoted: false,
    sourceLabel: '赫斯特·沃尔介绍的独立封存渠道', prices: { ...PLANESWALKER_PRICES }, formulaKnown: false,
    formula: ['星之虫', '时之虫', '灵体之虫'].map(name => ({ name, quantity: 1, unit: '条' })),
    story: '先核实每次远行的身体、原物与回程。', supplies: '三条辅助原件按原瓶分别封存。', actions: routes,
    bottles: [1, 2].map(number => ({ id: `planeswalker-potion-${number}`, title: `第${number}瓶独立原药`, source: `原瓶${number}及其专属辅助箱`, status: '已持有', chance: 62,
      command: { type: 'CONSUME' as const, bottleId: `planeswalker-potion-${number}`, confirmed: true as const } })),
    preparations: [
      { taskId: 'REVIEW_COORDINATES', title: '核读九处原坐标', completedWeek: null },
      { taskId: 'CHECK_PROTECTION', title: '核查防护与辅助原件', completedWeek: null },
      { taskId: 'PLAN_RETURN', title: '核实真实回程', completedWeek: null },
    ],
    preparedWeek: null, abilities: PLANESWALKER_ABILITIES.map(ability => ({ ...ability, mastery: 0 })),
    acting: 0, digestion: '本阶消化0/100', pollution: 3, risk: PLANESWALKER_CONSUMPTION_RISK,
    resources: { health: 68, maxHealth: 100, mind: 79, maxMind: 100, spirituality: 53, maxSpirituality: 120, cash: '900便士', actionsRemaining: 4 },
    currentGender: 'FEMALE', inheritedHistory: ['已有伤势与原护具余量保持。'],
    ritual: { title: '在本星球外九处留下传说', story: '九处各自保留原居民、原物和当地原簿。', environment: '同一异星上九处分离的聚居点。',
      risk: '每程付8灵性与一片原能源，成功用10秒防护；失败仍付费，精神−5、污染+2。',
      inside: false, playerLocation: 'LOCAL', locationLabel: '贝克兰德本地路线台', qualified: false, qualifiedSites: 0, qualifiedWeek: null,
      clockSeconds: 0, offworldLegs: 0, sites, visits: [], currentVisit: null, actions: routes },
    life: { title: '通行室实践', story: '使用同一身体与原封包。', environment: '封闭通行室', activeCase: null, inside: false, insideCase: false, reflected: false,
      site: createPlaneswalkerSiteState(), clockSeconds: 0, playerLocation: 'ENTRY', playerTravelMetres: 0, playerAstralLegs: 0, currentAttempt: null, sitePhase: 'LIFE',
      cases: [
        { id: 'symbolic-transit', title: '原身体与原封包往返' },
        { id: 'pattern-reproduction', title: '亲见光纹后有限复现' },
        { id: 'withdrawn-transit', title: '尊重本次撤回' },
      ].map(c => ({ ...c, id: c.id as 'symbolic-transit' | 'pattern-reproduction' | 'withdrawn-transit', story: '现场各步分别确认。', observations: [], status: 'AVAILABLE', method: null, result: null, contactOpen: false, returned: false, closes: 0, attempts: [] })), actions: [] },
    encounter: { title: '通行室争议', story: '交谈后可沿普通通路离开。', status: 'AVAILABLE', inside: false, site: null, startSite: null, enemy: null, actions: [], facts: [] },
    insideCase: false, environment: '当前位置以保存事实为准。',
  };
}
function visit(value: PlaneswalkerProjection, siteId: SiteId = 'PW2-LAMP'): Visit {
  const site = value.ritual.sites.find(site => site.id === siteId)!;
  return { id: 'PW2-VISIT-1', siteId, purpose: 'HELP', week: 8, date: { epoch: 'FIFTH_EPOCH', year: 1349, month: 8, day: 16 }, phase: 'PREPARED',
    coordinatesRead: true, protectionChecked: true, returnPlanned: true, returnMarkerChecked: false, contactedResidentIds: [], departureTier: null,
    helpPerformed: false, verificationPerformed: false, result: 'NONE', elapsedSeconds: 0, moves: [],
    paid: { actions: 1, spirituality: 0, pennies: 30, energyPieces: 0, protectionSeconds: 0, mind: 0, pollution: 0 },
    kit: { id: 'PW2-VISIT-1-KIT', source: 'PW2-PAID-ROUTE-PROVIDER', purchasedWeek: 8, price: 30, location: 'LOCAL', archivedWeek: null,
      suit: { id: 'PW2-VISIT-1-SUIT', initialProtectionSeconds: 90, protectionSeconds: 90, spentSeconds: 0 },
      energy: [1, 2].map(number => ({ id: `PW2-VISIT-1-ENERGY-${number}`, status: 'UNUSED' as const, consumedFor: null })),
      routeSheet: { id: 'PW2-VISIT-1-ROUTE', siteId, coordinateSourceId: site.coordinates.sourceId, localMarkerId: 'PW2-LOCAL-MARKER', remoteMarkerId: site.returnMarker.id } } };
}
function prepared(): PlaneswalkerProjection {
  const value = fixture(); value.preparedWeek = 8; value.ritual.qualified = true;
  value.actions = value.bottles.map(bottle => action(bottle.command, `服用${bottle.title}`, '0行动，耗尽所选原瓶与专属辅助原件'));
  return value;
}
function renderValue(value = fixture(), overrides: Partial<PlaneswalkerPanelProps> = {}) {
  const onCommand = vi.fn(), onClose = vi.fn();
  const props = { value, busy: false, error: null, onCommand, onClose, ...overrides };
  return { ...render(<PlaneswalkerPanel {...props}/>), props, onCommand, onClose };
}
function button(entry: PlaneswalkerAction): HTMLButtonElement {
  return screen.getByRole('button', { name: name => name.startsWith(entry.label), hidden: true }) as HTMLButtonElement;
}
function assertExactSubmission(ui: ReturnType<typeof renderValue>, entry: PlaneswalkerAction) {
  expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(entry.command);
  expect(ui.onCommand.mock.calls[0]![0]).toBe(entry.command);
  expect(ui.onClose).not.toHaveBeenCalled();
}
function assertLocked() {
  for (const control of screen.getAllByRole('button', { hidden: true })) expect((control as HTMLButtonElement).disabled).toBe(true);
  for (const control of screen.queryAllByRole('combobox', { hidden: true })) expect((control as HTMLSelectElement).disabled).toBe(true);
}
const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks();
  if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

describe('Planeswalker public facts and independent choices', () => {
  it('shows all three known auxiliary originals while the full formula remains unknown', () => {
    const value = fixture(), saved = structuredClone(value), ui = renderValue(value);
    expect(value.formulaKnown).toBe(false);
    const section = screen.getByRole('region', { name: '明确已有辅助物' });
    expect(within(section).getAllByRole('listitem').map(item => item.textContent)).toEqual(['星之虫：每瓶1条', '时之虫：每瓶1条', '灵体之虫：每瓶1条']);
    expect(section.textContent).toContain('完整主材料与自行调配方法尚未开放');
    const resources = screen.getByRole('region', { name: '旅法师当前身体与资源' });
    expect(resources.closest('details')).toBeNull();
    for (const text of ['68/100', '79/100', '53/120', '900便士']) expect(resources.textContent).toContain(text);
    expect(ui.container.textContent).not.toMatch(/候选|(?:^|[^A-Za-z0-9_.-])G(?:\d|[^A-Za-z0-9_.-]|$)/);
    expect(value).toEqual(saved); expect(ui.onCommand).not.toHaveBeenCalled();
  });

  it('offers exactly nine original sites and selection alone neither prepares nor departs', async () => {
    const value = fixture(), saved = structuredClone(value), ui = renderValue(value);
    const select = screen.getByRole('combobox', { name: '选择聚居点' }) as HTMLSelectElement;
    const options = within(select).getAllByRole('option') as HTMLOptionElement[];
    expect(options.map(option => option.value)).toEqual(value.ritual.sites.map(site => site.id));
    expect(options.map(option => option.textContent)).toEqual(SITE_NAMES.map(name => `${name} · 尚未亲访帮助`));
    for (const site of value.ritual.sites) {
      await userEvent.selectOptions(select, site.id);
      const current = screen.getByRole('region', { name: '旅法师九处传说与当前路线' });
      expect(within(current).getByRole('article', { name: `${site.name}实际履历` }).textContent).toContain(site.object.id);
      const entry = value.actions.find(entry => entry.command.type === 'PREPARE_ROUTE_KIT' && entry.command.siteId === site.id)!;
      expect(button(entry).disabled).toBe(false);
    }
    expect(ui.onCommand).not.toHaveBeenCalled(); expect(value).toEqual(saved);
    const selected = value.actions.at(-1)!;
    await userEvent.click(button(selected));
    const dialog = screen.getByRole('dialog', { name: '确认本次消耗与风险' });
    for (const text of ['石环聚居点', '1行动与30便士', '再单独确认出发', '已付成本不退']) expect(dialog.textContent).toContain(text);
    expect(ui.onCommand).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: '确认执行这一次操作' }));
    assertExactSubmission(ui, selected); expect(ui.onCommand.mock.calls[0]![0].type).toBe('PREPARE_ROUTE_KIT');
  });

  it('requires a separate real-body departure confirmation after route preparation', async () => {
    const value = fixture(); value.ritual.currentVisit = visit(value); value.ritual.visits = [value.ritual.currentVisit]; value.ritual.inside = true;
    const departure = action({ type: 'DEPART_RITUAL', confirmed: true }, '原身体前往灯原聚居点', '8灵性、一片原能源、知识20');
    value.actions = [departure]; const saved = structuredClone(value), ui = renderValue(value);
    expect((screen.getByRole('combobox', { name: '选择聚居点' }) as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '关闭旅法师页面' }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(button(departure));
    const dialog = screen.getByRole('dialog', { name: '确认原身体实际前往异星' });
    for (const text of ['灯原聚居点', '失败仍耗8灵性和一片原能源', '精神−5、污染+2', '身体留在本地', '另须为真实回程保留8灵性', '不能靠关闭页面']) expect(dialog.textContent).toContain(text);
    expect(ui.onCommand).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: '确认承担风险，本体实际出发' }));
    assertExactSubmission(ui, departure); expect(value).toEqual(saved);
  });

  it('confirms only the selected original bottle, supports all cancellation paths, and keeps focus', async () => {
    const value = prepared(), saved = structuredClone(value), ui = renderValue(value), entry = value.actions[1]!;
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '查看药瓶' }), value.bottles[1]!.id);
    const trigger = button(entry);
    for (const path of ['pointer', 'escape', 'native'] as const) {
      await userEvent.click(trigger);
      const dialog = screen.getByRole('dialog', { name: '独立确认服用这一药瓶' });
      const cancel = within(dialog).getByRole('button', { name: '取消，返回查看' });
      expect(document.activeElement).toBe(cancel);
      for (const text of ['planeswalker-potion-2', '当前成功率62%', '三条辅助原件', '成功失败都不退费', '再次尝试须另一原瓶', '不补满']) expect(dialog.textContent).toContain(text);
      expect(within(dialog).queryByRole('checkbox')).toBeNull();
      if (path === 'pointer') await userEvent.click(cancel);
      else if (path === 'escape') fireEvent.keyDown(dialog, { key: 'Escape' });
      else fireEvent(dialog, new Event('cancel', { cancelable: true }));
      expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(trigger); expect(ui.onCommand).not.toHaveBeenCalled();
    }
    await userEvent.click(trigger); const confirm = within(screen.getByRole('dialog')).getByRole('button', { name: '确认服用这一药瓶' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    assertExactSubmission(ui, entry); expect(value).toEqual(saved);
  });

  it('does not submit a consume action whose original bottle is absent from the public list', async () => {
    const value = prepared(), unavailable = action({ type: 'CONSUME', bottleId: 'absent-original', confirmed: true }, '服用所选原药');
    value.actions = [unavailable]; value.bottles = [];
    const ui = renderValue(value);
    expect(screen.queryByRole('button', { name: /服用所选原药/ })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull(); expect(ui.onCommand).not.toHaveBeenCalled();
  });

  it('shows disabled reasons without replacing an action or guessing an enabled command', async () => {
    const value = fixture(); value.guidanceKnown = false;
    const learn = action({ type: 'LEARN_GUIDANCE' }, '学习旅法师专业指导', '1行动、500便士');
    const buy = action({ type: 'BUY_POTION', bottleId: value.bottles[0]!.id }, '购买所选原瓶', '6400便士', '现金不足，须完成本瓶劳务或取得足额现金。');
    value.actions = [learn, buy]; const ui = renderValue(value);
    expect(button(learn).disabled).toBe(false);
    await userEvent.click(screen.getByText('其它步骤与未满足条件', { selector: 'summary' }));
    const disabled = button(buy); expect(disabled.disabled).toBe(true);
    const reasonId = disabled.getAttribute('aria-describedby'); expect(reasonId).not.toBeNull();
    expect(document.getElementById(reasonId!)?.textContent).toBe(buy.reason);
    fireEvent.click(disabled); expect(ui.onCommand).not.toHaveBeenCalled();
    await userEvent.click(button(learn));
    expect(screen.getByRole('dialog').textContent).toContain(learn.cost);
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '确认执行这一次操作' }));
    assertExactSubmission(ui, learn);
  });
});

describe('Planeswalker saved-state locks and real returns', () => {
  it.each(['busy', 'blocked', 'error'] as const)('%s locks every action, selection and close before submission', lock => {
    const ui = renderValue(prepared(), { busy: lock === 'busy', blocked: lock === 'blocked', error: lock === 'error' ? { message: '保存未完成', retryable: false } : null });
    assertLocked(); fireEvent.click(screen.getByRole('button', { name: '关闭旅法师页面' }));
    expect(ui.onCommand).not.toHaveBeenCalled(); expect(ui.onClose).not.toHaveBeenCalled();
    if (lock === 'error') expect(screen.getByRole('alert').textContent).toContain('重新加载');
  });

  it('retains one pending original intent through busy, retryable error and unchanged clone projections', async () => {
    const value = prepared(), entry = value.actions[0]!, ui = renderValue(value);
    await userEvent.click(button(entry));
    const confirm = within(screen.getByRole('dialog')).getByRole('button', { name: '确认服用这一药瓶' });
    fireEvent.click(confirm); fireEvent.click(confirm); assertExactSubmission(ui, entry);
    ui.rerender(<PlaneswalkerPanel {...ui.props} busy/>); assertLocked();
    for (const error of [{ message: '同一次原操作保存失败', retryable: true }, null] as const) {
      ui.rerender(<PlaneswalkerPanel {...ui.props} value={structuredClone(value)} error={error}/>);
      assertLocked(); expect(screen.getByRole('region', { name: PANEL }).getAttribute('aria-busy')).toBe('true');
      expect(screen.queryByRole('button', { name: /重试/, hidden: true })).toBeNull();
      const dialog = screen.getByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: '确认服用这一药瓶' }));
      fireEvent.keyDown(dialog, { key: 'Escape' }); fireEvent(dialog, new Event('cancel', { cancelable: true }));
      expect(screen.getByRole('dialog')).toBeTruthy(); assertExactSubmission(ui, entry);
      if (error) expect(screen.getByRole('alert').textContent).toContain('继续同一操作');
    }
    const saved = structuredClone(value); saved.preparedWeek = null; saved.bottles[0]!.status = '已耗尽'; saved.actions = [];
    ui.rerender(<PlaneswalkerPanel {...ui.props} value={saved} error="仍须保存同一次操作"/>);
    expect(screen.getByRole('dialog')).toBeTruthy(); assertLocked();
    ui.rerender(<PlaneswalkerPanel {...ui.props} value={saved}/>);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('region', { name: PANEL }).getAttribute('aria-busy')).toBe('false'); assertExactSubmission(ui, entry);
  });

  it('traps focus and invalidates an unsubmitted review when the public facts change', async () => {
    const value = prepared(), ui = renderValue(value); await userEvent.click(button(value.actions[0]!));
    const dialog = screen.getByRole('dialog'), cancel = within(dialog).getByRole('button', { name: '取消，返回查看' }), confirm = within(dialog).getByRole('button', { name: '确认服用这一药瓶' });
    cancel.focus(); fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(confirm);
    fireEvent.keyDown(dialog, { key: 'Tab' }); expect(document.activeElement).toBe(cancel);
    const changed = structuredClone(value); changed.resources!.cash = '0便士'; changed.actions[0]!.enabled = false; changed.actions[0]!.reason = '当前保存条件已改变。';
    ui.rerender(<PlaneswalkerPanel {...ui.props} value={changed}/>);
    expect(screen.queryByRole('dialog')).toBeNull(); fireEvent.click(confirm); expect(ui.onCommand).not.toHaveBeenCalled();
    expect(ui.onClose).not.toHaveBeenCalled();
  });

  it.each(['ritual', 'life'] as const)('submits the actual %s return and never treats page close as bodily travel', async kind => {
    const value = fixture(); let entry: PlaneswalkerAction;
    if (kind === 'ritual') {
      const current = visit(value); current.phase = 'AWAY'; current.kit.location = current.siteId; current.returnMarkerChecked = true;
      value.ritual.currentVisit = current; value.ritual.visits = [current]; value.ritual.inside = true; value.ritual.playerLocation = current.siteId; value.ritual.locationLabel = '灯原聚居点';
      entry = action({ type: 'RETURN_RITUAL' }, '沿本次原标记实际返回本地', '8灵性、一片原能源、10秒原防护');
    } else {
      value.promoted = true; value.life.inside = true; value.life.insideCase = true; value.life.activeCase = 'symbolic-transit';
      value.life.site.introducedWeek = 8; value.life.site.playerLocation = 'REMOTE'; value.life.playerLocation = 'REMOTE'; value.life.site.parcel.location = 'PLAYER';
      value.life.site.returnMarkerRead = true; value.life.site.effect = { mode: 'OFF', expiresAt: null };
      entry = action({ type: 'RETURN_LOCAL', caseId: 'symbolic-transit' }, '携原封包实际返回本地', '8灵性、10秒原防护、污染+1');
    }
    value.actions = [entry]; const saved = structuredClone(value), ui = renderValue(value);
    const closeButton = screen.getByRole('button', { name: '关闭旅法师页面' }) as HTMLButtonElement;
    expect(closeButton.disabled).toBe(true); fireEvent.click(closeButton); expect(ui.onClose).not.toHaveBeenCalled();
    const returns = screen.getByRole('region', { name: '旅法师真实返回与收尾' });
    expect(returns.textContent).toContain(entry.cost); expect(returns.closest('details')).toBeNull();
    expect(button(entry).disabled).toBe(false); await userEvent.click(button(entry));
    expect(screen.queryByRole('dialog')).toBeNull(); assertExactSubmission(ui, entry); expect(value).toEqual(saved);
  });

  it('locks page close for paid local preparation even before departure', () => {
    const value = fixture(); value.ritual.currentVisit = visit(value); value.ritual.inside = false;
    const ui = renderValue(value), closeButton = screen.getByRole('button', { name: '关闭旅法师页面' }) as HTMLButtonElement;
    expect(value.ritual.playerLocation).toBe('LOCAL'); expect(closeButton.disabled).toBe(true);
    fireEvent.click(closeButton); expect(ui.onClose).not.toHaveBeenCalled(); expect(ui.onCommand).not.toHaveBeenCalled();
  });

  it('keeps the original bottle, nine-site and previous-body histories read-only', async () => {
    const value = fixture(); value.promoted = true; const saved = structuredClone(value), ui = renderValue(value);
    for (const name of ['原瓶、辅助原物与专业准备记录', '三案经历与实际技巧掌握', '身体与此前经历']) {
      const summary = screen.getByText(name, { selector: 'summary' }); await userEvent.click(summary);
      expect(within(summary.closest('details')!).queryByRole('button', { hidden: true })).toBeNull();
    }
    const history = screen.getByText('九处传说与已保存远行 · 0/9处', { selector: 'summary' });
    await userEvent.click(history); expect(within(history.closest('details')!).queryByRole('button', { hidden: true })).toBeNull();
    expect(value).toEqual(saved); expect(ui.onCommand).not.toHaveBeenCalled(); expect(ui.onClose).not.toHaveBeenCalled();
  });

  it('allows navigation only after actual cleanup, without modifying the public projection', async () => {
    const value = fixture(), saved = structuredClone(value), ui = renderValue(value);
    await userEvent.click(screen.getByRole('button', { name: '关闭旅法师页面' }));
    expect(ui.onClose).toHaveBeenCalledOnce(); expect(ui.onCommand).not.toHaveBeenCalled(); expect(value).toEqual(saved);
  });

  it.each(['zero-health', 'lost-encounter'] as const)('keeps %s terminal facts read-only even with an erroneously enabled public action', async terminal => {
    const value = fixture(); value.promoted = true;
    value.actions = [action({ type: 'OBSERVE', caseId: 'symbolic-transit' }, '观察当前通行室', '1行动')];
    if (terminal === 'zero-health') value.resources!.health = 0; else value.encounter.status = 'LOST';
    const saved = structuredClone(value), ui = renderValue(value); assertLocked();
    expect(screen.getByRole('status').textContent).toContain('本人已死亡');
    fireEvent.click(button(value.actions[0]!)); expect(ui.onCommand).not.toHaveBeenCalled(); expect(ui.onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByText('身体与此前经历', { selector: 'summary' }));
    expect(ui.container.textContent).toContain('已有伤势与原护具余量保持'); expect(value).toEqual(saved);
  });
});
