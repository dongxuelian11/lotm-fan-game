/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SagePanel } from '../../src/renderer/SagePanel';
import type { SageAction, SageCommand, SageProjection } from '../../src/domain/sage/types';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types';
import type { SliceBridge } from '../../src/shared/slice-contracts';
import type { SageAttempt, SageSiteState } from '../../src/domain/sage/life';

// Small public renderer fixtures, not claimed domain saves or natural campaign evidence.
function site(): SageSiteState {
  return { siteId: 'SG2-ARCHIVE', introducedWeek: 130, introducedDate: { epoch: 'FIFTH_EPOCH', year: 1352, month: 1, day: 1 }, source: null,
    clockSeconds: 16, playerLocation: 'A', playerTravelMetres: 6, playerEnergy: 92, formEnergySpent: 2, assimilationExposure: 1,
    body: 'INFORMATION', form: { active: true, expiresAt: 32, anchorId: 'SG2-KIT-1' },
    iris: { id: 'PM3-IRIS', name: '艾瑞丝·沃德', age: 49, alive: true, willing: true, location: 'ENTRY', energy: 100, travelMetres: 0, consent: 'GRANTED' },
    record: { id: 'PM3-BOUNDARY-RECORD', owner: 'PM3-IRIS', quantity: 1, location: 'PLAYER', travelMetres: 6 },
    conduit: { id: 'SG2-CONDUIT', from: 'A', to: 'B', metres: 4, connected: true, traversals: 0 },
    archive: { id: 'SG2-ARCHIVE-LEAF', owner: 'PM3-IRIS', quantity: 1, location: 'B', readings: 0, verifications: 0 },
    materials: [{ id: 'SG2-KIT-1', caseId: 'information-route', ownerId: 'PLAYER', quantity: 1, status: 'INSTALLED', location: 'A', wear: 2, paidPennies: 20, preparedWeek: 130 }], actorMoves: [] };
}
function attempt(p: SageSiteState): SageAttempt {
  return { week: 130, method: 'ABILITY', closed: false, result: 'NONE', stopped: false, inspected: false, permissionWithdrawn: false, consent: 'GRANTED',
    elapsedSeconds: 12, playerTravelMetres: 6, energySpent: 8, spiritualitySpent: 8, mindSpent: 2, penniesSpent: 20, materialId: 'SG2-KIT-1', itemsReturned: false, anchorInstalled: true,
    formTier: 'SUCCESS', siftTier: null, traversed: false, reassembled: false, expired: false, waits: 0, ownerAccompanied: false, ownerReturned: false,
    read: false, verified: false, information: [], correction: null, appliedAbilityIds: [], playerMoves: [], actorMoves: [], siteAtStart: structuredClone(p), siteAtClose: null };
}
function action(command: SageCommand, label: string = command.type, cost = '0行动'): SageAction {
  return { id: `test-${command.type}`, label, cost, enabled: true, reason: null, command };
}
function view(promoted = false): SageProjection {
  const p = site();
  return { title: '贤者与原档案馆', discovered: true, guidanceKnown: true, promoted, formulaKnown: false, formula: [], story: '本人承担真实灾难与有限信息实践。', supplies: '独立原瓶，每瓶分别取得与耗用。',
    nextStep: '核对当前原物与真实代价。', preferredActionId: null, actions: [], bottles: [{ id: 'sage-potion-1', title: '第一瓶贤者魔药', source: '旧档案馆专业交接处的独立封存原瓶。', status: '本人持有', chance: 65, command: { type: 'CONSUME', bottleId: 'sage-potion-1', confirmed: true } }],
    preparations: [{ taskId: 'REVIEW_DISASTER', title: '核对实际止灾', completedWeek: null }], preparedWeek: null,
    abilities: [{ id: 'hermit.s3.prophetic-glimpse', label: '模糊预兆', mastery: 8, description: '原预兆仍须解释与核验。' }, { id: 'hermit.s2.information-form', label: '信息化与重新凝聚', mastery: 0, description: '本人有限信息形态。' }, { id: 'hermit.s2.information-sift', label: '有限筛取', mastery: 0, description: '实得信息仍须核验。' }], acting: 0, digestion: '按实际报告记录消化。', pollution: 4,
    risk: '失败原瓶耗尽；严重失败损25健康与45精神，排异增加60。旧伤不消除。', resources: { health: 70, maxHealth: 100, mind: 88, maxMind: 100, spirituality: 103, maxSpirituality: 120, cash: '2镑 4苏勒 1便士', actionsRemaining: 1 },
    currentGender: 'MALE', inheritedHistory: ['旧原人、原物和掌握留存。'], appearanceRecord: '原身体与外貌保留。', inheritedTools: '原卷库存和105名知情者保留。',
    ritual: { title: '玻璃名录', story: '原高层次信息洪流已经伤及两名成年馆员。', status: '真实灾害仍在扩散', location: '原门厅', source: '旧移交卷与当前裂纹相互核实。', threat: '原核心活跃，未断回路仍在传播。', damage: '原记录4/12份损毁、原板1/4块损毁。', people: ['玛伦，46岁，原门厅，健康88。旧伤保留。', '埃德里克，39岁，原门厅，健康91。'], routes: ['刻印板连接仍在传播。', '索引回路仍在传播。'], materials: '封缄材料现有3份、已耗0份。', stoppedRecord: null, review: null, actions: [], inside: false, nextStep: '先亲自研究原来源。' },
    life: { title: '有限信息实践', story: '同一本体、原成人与原记录页。', environment: '门口至锚位6米，锚位至档架4米；每米1秒1精力。', activeCase: null, inside: false, insideCase: false, reflected: false, site: p, clockSeconds: p.clockSeconds, playerLocation: p.playerLocation, playerTravelMetres: p.playerTravelMetres, currentAttempt: null,
      cases: [{ id: 'information-route', title: '同一本体经过四米导管', story: '先准备，再真实通行并重组。', observations: [], status: 'OBSERVED', method: null, result: null, contactOpen: false, returned: false, closes: 0, attempts: [] }], actions: [] },
    encounter: { title: '档案馆后院争议', story: '交谈和真实交战分别选择。', status: 'AVAILABLE', inside: false, site: null, startSite: null, preparationSummary: null, enemy: null, actions: [], facts: [] }, insideCase: false, environment: '原仓库与独立后院，普通道路可返回。' };
}
const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(() => {
  cleanup(); delete window.sliceGame; vi.restoreAllMocks();
  if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

describe('Sage player-facing costs, actual progress and confirmations', () => {
  it('shows actual disaster, two paths and injured original adults without claiming rescue or stopped disaster', () => {
    render(<SagePanel value={view()} busy={false} onCommand={vi.fn()} />);
    const ritual = screen.getByRole('region', { name: '贤者真实止灾仪式' });
    expect(ritual.textContent).toContain('原记录4/12份损毁'); expect(ritual.textContent).toContain('玛伦，46岁');
    expect(ritual.textContent).toContain('尚无本人已阻止灾难的记录'); expect(ritual.textContent).toContain('尚未完成阻止记录的专业复核');
    expect(screen.getByRole('region', { name: '贤者' }).textContent).not.toMatch(/候选|原创G|原文未核|(?<![A-Za-z0-9_.-])G(?![A-Za-z0-9_.-])/);
  });
  it('confirms irreversible cut-path costs and failure damage, then cancels without dispatch', async () => {
    const value = view(), send = vi.fn(); value.actions = [action({ type: 'RITUAL_CUT_PLATE' }, '切断原刻印板连接', '1行动 · 6灵性 · 2精神 · 1份封缄材料 · 知识20')];
    render(<SagePanel value={value} busy={false} onCommand={send} />);
    const launch = screen.getByRole('button', { name: /切断原刻印板连接/ }); await userEvent.click(launch);
    const modal = screen.getByRole('dialog'); expect(modal.textContent).toContain('失败另损4健康、4精神、增加4污染'); expect(modal.textContent).toContain('严重失败另损8健康'); expect(modal.textContent).toContain('失败材料不退');
    expect(document.activeElement).toBe(within(modal).getByRole('button', { name: '取消，返回查看' }));
    await userEvent.click(within(modal).getByRole('button', { name: '取消，返回查看' }));
    expect(send).not.toHaveBeenCalled(); expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(launch);
  });
  it('submits the exact original command once, retains pending lock on error and unlocks only on changed saved facts', async () => {
    const value = view(), send = vi.fn(), command: SageCommand = { type: 'RITUAL_STUDY' }; value.actions = [action(command, '亲自研究', '1行动 · 4灵性 · 2精神')];
    const mounted = render(<SagePanel value={value} busy={false} onCommand={send} />);
    await userEvent.click(screen.getByRole('button', { name: /亲自研究/ })); const confirm = screen.getByRole('button', { name: '确认执行这一次操作' });
    fireEvent.click(confirm); fireEvent.click(confirm); expect(send).toHaveBeenCalledExactlyOnceWith(command);
    mounted.rerender(<SagePanel value={value} busy={false} onCommand={send} error="尚未保存" />); expect(screen.queryByRole('dialog')).toBeNull();
    mounted.rerender(<SagePanel value={value} busy={false} onCommand={send} />); expect((screen.getByRole('button', { name: /亲自研究/ }) as HTMLButtonElement).disabled).toBe(true);
    const saved = structuredClone(value); saved.resources!.spirituality -= 4; mounted.rerender(<SagePanel value={saved} busy={false} onCommand={send} />);
    expect((screen.getByRole('button', { name: /亲自研究/ }) as HTMLButtonElement).disabled).toBe(false); expect(send).toHaveBeenCalledTimes(1);
  });
  it('invalidates a confirmation when saved facts change before submission', async () => {
    const value = view(), send = vi.fn(); value.actions = [action({ type: 'RITUAL_BUY_SEALS' }, '补购三份材料', '120便士')];
    const mounted = render(<SagePanel value={value} busy={false} onCommand={send} />); await userEvent.click(screen.getByRole('button', { name: /补购三份材料/ }));
    const updated = structuredClone(value); updated.resources!.actionsRemaining = 0; mounted.rerender(<SagePanel value={updated} busy={false} onCommand={send} />);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(send).not.toHaveBeenCalled();
  });
  it('distinguishes successful form preparation from actual movement and preserves unknown information', () => {
    const value = view(true); value.life.currentAttempt = attempt(value.life.site); value.life.activeCase = 'information-route'; value.insideCase = true;
    render(<SagePanel value={value} busy={false} onCommand={vi.fn()} onClose={vi.fn()} />);
    const record = screen.getByRole('region', { name: '贤者本次尝试' }); expect(record.textContent).toContain('检定成功，但尚无实际通行并重组的应用'); expect(record.textContent).toContain('实际应用：无'); expect(record.textContent).toContain('当前尚未取得本案信息片段');
    expect((screen.getByRole('button', { name: '关闭贤者页面' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('region', { name: '贤者原身体与实际现场' }).textContent).toContain('还余16秒');
  });
  it('keeps sift fragments uncertain until real verification and shows separate actual application afterward', () => {
    const value = view(true), a = attempt(value.life.site); a.siftTier = 'SUCCESS'; a.read = true; a.information = ['原页旁注称第四格空置。']; value.life.currentAttempt = a;
    const mounted = render(<SagePanel value={value} busy={false} onCommand={vi.fn()} />);
    expect(screen.getByRole('region', { name: '贤者本次尝试' }).textContent).toContain('尚未独立核验，不能当作正确结论'); expect(screen.queryByText(/现场核验后的修正/)).toBeNull();
    const saved = structuredClone(value); saved.life.currentAttempt!.verified = true; saved.life.currentAttempt!.correction = '第四格实际存在一只空夹；缺文仍未知。'; saved.life.currentAttempt!.appliedAbilityIds = ['hermit.s2.information-sift'];
    mounted.rerender(<SagePanel value={saved} busy={false} onCommand={vi.fn()} />);
    expect(screen.getByRole('region', { name: '贤者本次尝试' }).textContent).toContain('实际应用：有限信息筛查'); expect(screen.getByText(/现场核验后的修正/).textContent).toContain('缺文仍未知');
  });
  it('requires independent selected-bottle confirmation with known probability and failed-potion costs', async () => {
    const value = view(), send = vi.fn(); value.preparedWeek = 131; value.actions = [action({ type: 'CONSUME', bottleId: 'sage-potion-1', confirmed: true }, '服用第一原瓶', '0行动 · 原瓶耗尽')];
    render(<SagePanel value={value} busy={false} onCommand={send} />); await userEvent.click(screen.getByRole('button', { name: /服用第一原瓶/ }));
    const modal = screen.getByRole('dialog'); expect(modal.textContent).toContain('当前成功率65%'); expect(modal.textContent).toContain('严重失败损25健康与45精神'); expect(modal.textContent).toContain('无论成功失败都会耗尽');
    expect(send).not.toHaveBeenCalled(); await userEvent.click(within(modal).getByRole('button', { name: '确认服用这一药瓶' })); expect(send).toHaveBeenCalledExactlyOnceWith(value.actions[0]!.command);
  });
  it('keeps fighting optional and displays original enemy and actual mental preparation cost', async () => {
    const value = view(true), send = vi.fn(); value.encounter.inside = true; value.encounter.status = 'READY'; value.encounter.enemy = { id: 'SG2-MERRIN', name: '梅林·阿什', age: 47, sequence: 3, health: 84, mind: 100, spirituality: 95, status: 'RESISTING', weaponId: 'SG2-MERRIN-ROD', weaponLocation: 'HAND', powerUses: { ARC_BOLT: 5, WARD: 0, FEINT: 0 } }; value.actions = [action({ type: 'ENCOUNTER_FIGHT' }, '选择与梅林交战', '1行动 · 受伤或死亡风险'), action({ type: 'LEAVE_ENCOUNTER' }, '沿出口和平离开', '2米 · 2秒 · 2精力')];
    render(<SagePanel value={value} busy={false} onCommand={send} />); const encounter = screen.getByRole('region', { name: '贤者可选遭遇' }); expect(encounter.textContent).toContain('健康84/100'); expect(encounter.textContent).toContain('独立灵性95/120'); expect(send).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /选择与梅林交战/ })); expect(screen.getByRole('dialog').textContent).toContain('轻伤、重伤、撤退或死亡'); expect(screen.getByRole('dialog').textContent).toContain('有限准备');
  });
  it('prioritizes the later encounter site over a stale former life position', () => {
    const value = view(true); value.encounter.site = structuredClone(value.life.site); value.encounter.site.playerLocation = 'OUTSIDE'; value.encounter.site.body = 'SOLID'; value.encounter.site.form.active = false; value.encounter.site.playerEnergy = 52;
    render(<SagePanel value={value} busy={false} onCommand={vi.fn()} />);
    const current = screen.getByRole('region', { name: '贤者原身体与实际现场' }); expect(current.textContent).toContain('院外（门口外2米）'); expect(current.textContent).toContain('52/100'); expect(current.textContent).not.toContain('还余16秒');
  });
  it('never submits when busy, blocked, disabled, or already dead', () => {
    const value = view(), send = vi.fn(); value.actions = [action({ type: 'RITUAL_BUY_SEALS' }, '补购材料', '120便士')];
    const mounted = render(<SagePanel value={value} busy onCommand={send} />);
    expect((screen.getByRole('button', { name: /补购材料/ }) as HTMLButtonElement).disabled).toBe(true);
    mounted.rerender(<SagePanel value={value} busy={false} blocked onCommand={send} />); expect((screen.getByRole('button', { name: /补购材料/ }) as HTMLButtonElement).disabled).toBe(true);
    const dead = structuredClone(value); dead.resources!.health = 0; mounted.rerender(<SagePanel value={dead} busy={false} onCommand={send} />);
    const button = screen.getByRole('button', { name: /补购材料/ }); fireEvent.click(button); expect((button as HTMLButtonElement).disabled).toBe(true); expect(send).not.toHaveBeenCalled();
  });
  it('allows Escape to cancel and reopening the same action still submits only once', async () => {
    const value = view(), send = vi.fn(); value.actions = [action({ type: 'RITUAL_RETREAT' }, '实际退到馆外', '6米 · 6秒')]; value.ritual.inside = true;
    render(<SagePanel value={value} busy={false} onCommand={send} />);
    await userEvent.click(screen.getByRole('button', { name: /实际退到馆外/ })); fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' }); expect(screen.queryByRole('dialog')).toBeNull(); expect(send).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /实际退到馆外/ })); await userEvent.click(screen.getByRole('button', { name: '确认执行这一次操作' })); expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'RITUAL_RETREAT' });
  });
  it('shows the saved stopped-disaster and review separately from preserved irreversible damage', async () => {
    const value = view(true); value.ritual.status = '原核心已封存，洪流已停止'; value.ritual.threat = '原核心已封存。'; value.ritual.stoppedRecord = '本人第129周切断两路并封存原核心。'; value.ritual.review = '第129周完成专业复核。';
    render(<SagePanel value={value} busy={false} onCommand={vi.fn()} />); await userEvent.click(screen.getByText('本人阻止灾难的记录', { selector: 'summary' }));
    const ritual = screen.getByRole('region', { name: '贤者真实止灾仪式' }); expect(ritual.textContent).toContain('本人第129周切断两路'); expect(ritual.textContent).toContain('第129周完成专业复核'); expect(ritual.textContent).toContain('原记录4/12份损毁');
  });
  it('lets closing a free page be navigation only and keeps inherited mastery visible', async () => {
    const value = view(true), closePage = vi.fn(), send = vi.fn(); render(<SagePanel value={value} busy={false} onCommand={send} onClose={closePage} />);
    await userEvent.click(screen.getByText('身体与已有经历', { selector: 'summary' })); expect(screen.getByRole('region', { name: '贤者已有技巧与掌握' }).textContent).toContain('模糊预兆 · 掌握8');
    await userEvent.click(screen.getByRole('button', { name: '关闭贤者页面' })); expect(closePage).toHaveBeenCalledOnce(); expect(send).not.toHaveBeenCalled();
  });
});


describe('Sage projection-only application navigation', () => {
  it('opens current S2 growth before stale S3 history, suppresses old round replay and preserves the scroll workshop entry', async () => {
    const [{ SliceApp }, { projectSliceState }, { migrateSliceState }, { readObjectEntry }] = await Promise.all([
      import('../../src/renderer/SliceApp'), import('../../src/domain/slice'), import('../../src/domain/slice/migration'), import('../helpers/read-object-entry'),
    ]);
    // The inherited campaign supplies the public dashboard shape. This deliberately
    // modified projection tests navigation only, never domain validity or promotion.
    const old = migrateSliceState(readObjectEntry<SliceState>('tests/fixtures/prophecy-master-v01540/natural.json', 'final'));
    const projected: SliceProjection = structuredClone(projectSliceState(old)); projected.progression.sequence = 2; projected.sage = view(true);
    const send: SliceBridge['submitIntent'] = vi.fn();
    window.sliceGame = {
      getBootstrap: vi.fn<SliceBridge['getBootstrap']>(async () => ({ ok: true, value: { mode: 'browser', activeState: projected, runs: [{ runId: projected.runId, name: projected.character.name, portraitId: projected.character.portraitId, week: projected.week, date: projected.date, status: projected.status, revision: projected.revision, updatedAt: '2026-10-15T00:00:00Z' }] } })),
      loadRun: vi.fn<SliceBridge['loadRun']>(async () => ({ ok: true, value: projected })), submitIntent: send,
    };
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    render(<SliceApp />); await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ })); await userEvent.click(screen.getByRole('button', { name: name => name.includes(projected.character.name) }));
    await screen.findByRole('heading', { name: '人物卷宗' }); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    expect(screen.getByText(`贤者 · 序列2 · ${projected.character.professionName}`, { selector: 'p' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ })); await screen.findByRole('region', { name: '贤者' });
    expect(screen.queryByRole('region', { name: '预言大师' })).toBeNull(); expect(screen.getByRole('button', { name: '打开继承卷轴工坊' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '关闭贤者页面' })); await screen.findByRole('heading', { name: '人物卷宗' }); expect(send).not.toHaveBeenCalled();
  }, 30_000);
});
