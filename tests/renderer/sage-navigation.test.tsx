/* @vitest-environment jsdom */
import { readFileSync } from 'node:fs';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceCombatRound, SliceIntent, SliceState } from '../../src/domain/slice/types';
import type { SageCommand } from '../../src/domain/sage/types';
import { SAGE_ENEMY_ABILITY_WHEEL, SAGE_ENEMY_COUNT_WHEEL } from '../../src/domain/sage/combat';
import type { SliceBridge } from '../../src/shared/slice-contracts';
import { readObjectEntry } from '../helpers/read-object-entry';

const ROOT = 'tests/fixtures/sage-v01780', PANEL = '贤者', ENTRY = '贤者与档案灾难';
const NEW_IDS = ['hermit.s2.information-form', 'hermit.s2.information-sift'];
const LEGACY = ['pryer', 'combatScholar', 'wizard', 'scrollProfessor', 'starMystic', 'mystic', 'prophecyMaster'] as const;
interface Boundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
// Read the frozen natural captures without modifying their state, name, RNG or outcomes.
const index = JSON.parse(readFileSync(`${ROOT}/boundaries.index.json`, 'utf8')) as Record<string, string>;
function boundary(name: string): Boundary {
  if (!index[name]) throw new Error(`Missing actual Sage boundary: ${name}`);
  const file = `${ROOT}/${index[name]}`;
  return { beforeLast: migrateSliceState(readObjectEntry(file, 'beforeLast')), lastIntent: readObjectEntry<SliceIntent>(file, 'lastIntent'), final: migrateSliceState(readObjectEntry(file, 'final')) };
}
function snapshot(name: 'departure' | 'ritualStopped' | 'promoted' | 'practiced' | 'combatStart') {
  return migrateSliceState(JSON.parse(readFileSync(`${ROOT}/snapshot-${name}.json`, 'utf8')));
}
const view = (s: SliceState) => projectSliceState(s).sage;
function commandOf(entry: Boundary): SageCommand {
  if (entry.lastIntent.type !== 'SAGE') throw new Error('Expected the recorded public Sage command.');
  return entry.lastIntent.command;
}
function savedGame(input: unknown, options: { deferFirstSave?: boolean; failFirstSave?: boolean } = {}) {
  let state = migrateSliceState(input), attempts = 0, releaseFirstSave = () => {};
  assertValidSliceState(state);
  const firstSave = new Promise<void>(resolve => { releaseFirstSave = resolve; });
  const submit: SliceBridge['submitIntent'] = vi.fn(async envelope => {
    if (envelope.payload.type === 'CREATE') throw new Error('This original campaign already exists.');
    const attempt = attempts++;
    if (attempt === 0 && options.deferFirstSave) await firstSave;
    if (attempt === 0 && options.failFirstSave) return { ok: false as const, error: { code: 'SAVE_FAILED', message: '这次原操作尚未保存', retryable: true } };
    state = applySliceIntent(state, envelope.payload); assertValidSliceState(state);
    return { ok: true as const, value: { intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
      newRevision: state.revision, committedAt: '2026-10-15T01:59:00Z', replayed: false, state: projectSliceState(state) } };
  });
  return { get state() { return state; }, submit, releaseFirstSave };
}
type SavedGame = ReturnType<typeof savedGame>;
async function mount(game: SavedGame) {
  const state = projectSliceState(game.state);
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge['getBootstrap']>(async () => ({ ok: true, value: { mode: 'browser', activeState: state, runs: [{
      runId: state.runId, name: state.character.name, portraitId: state.character.portraitId, week: state.week, date: state.date,
      status: state.status, revision: state.revision, updatedAt: '2026-10-15T01:58:00Z',
    }] } })),
    loadRun: vi.fn<SliceBridge['loadRun']>(async () => ({ ok: true, value: projectSliceState(game.state) })), submitIntent: game.submit,
  };
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(screen.queryByRole('region', { name: PANEL }) ?? screen.queryByRole('heading', { name: '人物卷宗' })
    ?? screen.queryByRole('dialog', { name: '战斗回合结果' }) ?? (state.combat ? screen.queryByRole('dialog', { name: state.combat.title ?? '普通人追击' }) : null)).toBeTruthy());
}
async function acknowledgeReveal() {
  const reveal = screen.queryByRole('dialog', { name: '战斗回合结果' });
  if (reveal) await userEvent.click(within(reveal).getByRole('button', { name: /^(返回生活|进入下一回合|查看收尾卷宗)$/ }));
}
async function openSage(game: SavedGame) {
  await mount(game); await acknowledgeReveal();
  if (!screen.queryByRole('region', { name: PANEL })) await userEvent.click(screen.getByRole('button', { name: ENTRY }));
  return screen.findByRole('region', { name: PANEL });
}
function actionButton(state: SliceState, command: SageCommand): HTMLButtonElement {
  const action = view(state).actions.find(a => JSON.stringify(a.command) === JSON.stringify(command));
  if (!action) throw new Error(`Missing actual public action: ${JSON.stringify(command)}`);
  return screen.getAllByRole('button', { name: name => name.startsWith(action.label), hidden: true }).at(-1)! as HTMLButtonElement;
}
async function control(state: SliceState, command: SageCommand) {
  if ('bottleId' in command) {
    const select = screen.getByRole('combobox', { name: '查看药瓶' }) as HTMLSelectElement;
    if (!select.disabled && select.value !== command.bottleId) await userEvent.selectOptions(select, command.bottleId);
  }
  const button = actionButton(state, command), details = button.closest('details');
  if (details && !details.open) await userEvent.click(details.querySelector('summary')!);
  return button;
}
async function confirmActual(game: SavedGame, entry: Boundary) {
  await userEvent.click(await control(game.state, commandOf(entry)));
  const review = await screen.findByRole('dialog', { name: '确认本次消耗与风险' });
  await userEvent.click(within(review).getByRole('button', { name: '确认执行这一次操作' }));
  await waitFor(() => expect(game.state).toEqual(entry.final));
  expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: entry.beforeLast.runId,
    expectedRevision: entry.beforeLast.revision, payload: entry.lastIntent });
}
function assertLegacy(before: SliceState, after: SliceState) {
  expect(after.runId).toBe(before.runId); expect(after.random.seed).toBe(before.random.seed); expect(after.character.name).toBe(before.character.name);
  expect(after.character.gender).toBe(before.character.gender);
  for (const key of LEGACY) expect(after[key]).toEqual(before[key]);
  for (const [id, mastery] of Object.entries(before.progression.mastery)) if (!NEW_IDS.includes(id)) expect(after.progression.mastery[id]).toBe(mastery);
}
function naturalCopy(node: HTMLElement) {
  expect(node.textContent).not.toMatch(/候选|原文未核|原创G|本作G|(?<![A-Za-z0-9_.-])G(?![A-Za-z0-9_.-])/);
  expect(node.textContent).not.toMatch(/"(?:playerEnergy|siteAtStart|appliedAbilityIds)"\s*:/);
}
function assertBodyWheel(reveal: HTMLElement, round: SliceCombatRound) {
  expect(round.sageOutcome).toBeTruthy(); expect(round.consequenceDomain).toBe('BODY');
  expect(within(reveal).getByRole('heading', { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
  expect(reveal.textContent).not.toContain('精神后果盘');
  if (round.consequenceWeights) { const w = round.consequenceWeights;
    expect(reveal.textContent!.replace(/\s+/g, ' ')).toContain(`败者后果盘：轻伤 ${w.light}% · 重伤 ${w.heavy}% · 死亡 ${w.death}%`); }
}
const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(() => {
  cleanup(); delete window.sliceGame; vi.restoreAllMocks();
  if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

describe('Sage unchanged natural saved navigation', () => {
  it('opens actual S3 departure through the Sage entry without treating old prophecy as the new ritual', async () => {
    const before = snapshot('departure'), game = savedGame(before);
    expect(before.progression.sequence).toBe(3); expect(before.character.name).toBe('芙宁');
    expect(before.lastCombatRound?.prophecyMasterOutcome).toBeTruthy();
    await mount(game); await acknowledgeReveal();
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    await screen.findByRole('region', { name: '预言大师' });
    await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    const panel = await screen.findByRole('region', { name: PANEL });
    expect(panel.textContent).toContain('预言大师3 → 贤者2');
    expect(panel.textContent).toContain('尚无本人已阻止灾难的记录');
    expect(screen.queryByRole('region', { name: '预言大师' })).toBeNull(); naturalCopy(panel);
    await userEvent.click(screen.getByRole('button', { name: '关闭贤者页面' }));
    await screen.findByRole('heading', { name: '人物卷宗' });
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it('shows the original two injured adults and both active routes before real study; cancelling preserves them', async () => {
    const entry = boundary('actual-high-level-source-study'), game = savedGame(entry.beforeLast), panel = await openSage(game);
    const ritual = within(panel).getByRole('region', { name: '贤者真实止灾仪式' });
    const people = within(ritual).getByRole('region', { name: '贤者灾难现场原伤者' });
    expect(people.textContent).toContain('玛伦·克莱，46岁'); expect(people.textContent).toContain('埃德里克·芬，39岁');
    expect(people.textContent).toContain('健康88、精神82'); expect(people.textContent).toContain('健康91、精神79');
    expect(within(ritual).getByRole('region', { name: '贤者两条真实传播路' }).textContent).toBe('传播路与唯一核心原刻印板连接：仍在传播。原索引回路：仍在传播。');
    expect(ritual.textContent).toContain('原记录3/12份已损毁');
    await userEvent.click(await control(game.state, commandOf(entry)));
    const review = await screen.findByRole('dialog', { name: '确认本次消耗与风险' });
    expect(review.textContent).toContain('4灵性和2精神'); expect(review.textContent).toContain('损毁不可撤销'); naturalCopy(review);
    await userEvent.click(within(review).getByRole('button', { name: '取消，返回查看' }));
    expect(game.state).toEqual(entry.beforeLast); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it('actually evacuates the same adults while retaining original wounds and the unstopped core', async () => {
    const entry = boundary('same-injured-adults-evacuated'), game = savedGame(entry.beforeLast); await openSage(game);
    await confirmActual(game, entry); const panel = await screen.findByRole('region', { name: PANEL });
    for (const person of view(entry.final).ritual.people) expect(panel.textContent).toContain(person);
    expect(game.state.sage.ritual.people.map(p => p.location)).toEqual(['OUTSIDE', 'OUTSIDE']);
    expect(game.state.sage.ritual.people.map(p => p.injuries)).toEqual(entry.beforeLast.sage.ritual.people.map(p => p.injuries));
    expect(game.state.sage.ritual.stoppedRecord).toBeNull(); expect(panel.textContent).toContain('高层次原核心仍活跃');
    assertLegacy(entry.beforeLast, game.state); naturalCopy(panel);
  }, 20_000);

  it('commits the actual failed first route cut, including its material, injury costs and permanent damage', async () => {
    const entry = boundary('plate-route-attempt-1'), game = savedGame(entry.beforeLast); await openSage(game);
    await userEvent.click(await control(game.state, commandOf(entry)));
    const review = await screen.findByRole('dialog', { name: '确认本次消耗与风险' });
    expect(review.textContent).toContain('失败另损4健康、4精神、增加4污染'); expect(review.textContent).toContain('耗尽一份未用封缄材料');
    await userEvent.click(within(review).getByRole('button', { name: '确认执行这一次操作' }));
    await waitFor(() => expect(game.state).toEqual(entry.final));
    expect(game.state.health).toBe(96); expect(game.state.sage.ritual.routes.plate.active).toBe(true);
    expect(game.state.sage.ritual.seals[0]?.status).toBe('USED');
    const panel = screen.getByRole('region', { name: PANEL }); expect(panel.textContent).toContain('原记录5/12份已损毁，原刻印板2/4块已损毁');
    expect(panel.textContent).toContain('尚无本人已阻止灾难的记录'); naturalCopy(panel);
  }, 20_000);

  it('independently reviews the actual stopped record without healing people or restoring destroyed originals', async () => {
    const entry = boundary('actual-disaster-stopped-and-reviewed'), game = savedGame(entry.beforeLast), panel = await openSage(game);
    expect(entry.beforeLast.sage.ritual.stoppedRecord?.actorName).toBe('芙宁'); expect(entry.beforeLast.sage.ritual.review).toBeNull();
    expect(panel.textContent).toContain('芙宁在第130周本人切断两路'); expect(panel.textContent).toContain('尚未完成阻止记录的专业复核');
    await confirmActual(game, entry);
    expect(game.state.sage.ritual.review?.actorName).toBe('芙宁');
    expect(game.state.sage.ritual.people).toEqual(entry.beforeLast.sage.ritual.people);
    expect(game.state.sage.ritual.records).toEqual(entry.beforeLast.sage.ritual.records);
    expect(screen.getByRole('region', { name: PANEL }).textContent).toContain('第131周完成原阻止记录专业复核');
    expect(game.state.progression.sequence).toBe(3); assertLegacy(entry.beforeLast, game.state);
  }, 20_000);

  it('keeps the actual second bottle unchanged through cancel, duplicate clicks and save failure, then retries the identical envelope', async () => {
    const entry = boundary('consume-sage-potion-2'), command = commandOf(entry), before = entry.beforeLast;
    if (command.type !== 'CONSUME') throw new Error('Expected recorded second-dose consumption.');
    const game = savedGame(before, { deferFirstSave: true, failFirstSave: true }); await openSage(game);
    const trigger = await control(game.state, command); await userEvent.click(trigger);
    let review = await screen.findByRole('dialog', { name: '独立确认服用这一药瓶' });
    expect(review.textContent).toContain(view(before).bottles.find(b => b.id === command.bottleId)!.title);
    expect(review.textContent).toContain('无论成功失败都会耗尽'); naturalCopy(review);
    await userEvent.click(within(review).getByRole('button', { name: '取消，返回查看' }));
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(trigger); review = await screen.findByRole('dialog', { name: '独立确认服用这一药瓶' });
    const confirm = within(review).getByRole('button', { name: '确认服用这一药瓶' }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(game.submit).toHaveBeenCalledOnce(); expect(game.state).toEqual(before);
    expect(actionButton(before, command).disabled).toBe(true); expect((screen.getByRole('combobox', { name: '查看药瓶' }) as HTMLSelectElement).value).toBe('sage-potion-2');
    await act(async () => { game.releaseFirstSave(); }); await screen.findAllByRole('alert');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '独立确认服用这一药瓶' })).toBeNull());
    expect(game.state).toEqual(before); expect(actionButton(before, command).disabled).toBe(true);
    fireEvent.click(actionButton(before, command)); expect(game.submit).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: '重试这次操作' }));
    await waitFor(() => expect(game.state).toEqual(entry.final));
    const calls = vi.mocked(game.submit).mock.calls; expect(calls).toHaveLength(2); expect(calls[1]![0]).toEqual(calls[0]![0]);
    expect(calls[0]![0]).toEqual({ intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload: entry.lastIntent });
    expect(game.state.random.cursor).toBe(before.random.cursor + 1); expect(game.state.sage.bottles.map(b => b.outcome)).toEqual(['FAILURE', 'SUCCESS', null]);
    expect(game.state.injuries).toEqual(before.injuries); expect(game.state.spirituality).toBe(before.spirituality); assertLegacy(before, game.state);
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  }, 20_000);

  it('loads actual promoted S2 growth before old PM3, preserves the real custom name and all inherited mastery, and retains the workshop', async () => {
    const before = snapshot('promoted'), game = savedGame(before); await mount(game);
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    expect(screen.getByText(`贤者 · 序列2 · ${projectSliceState(before).character.professionName}`, { selector: 'p' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    const panel = await screen.findByRole('region', { name: PANEL });
    expect(screen.queryByRole('region', { name: '预言大师' })).toBeNull();
    expect(screen.getByRole('button', { name: '打开继承卷轴工坊' })).toBeTruthy();
    await userEvent.click(within(panel).getByText('身体与已有经历', { selector: 'summary' }));
    const inherited = within(panel).getByRole('region', { name: '贤者已有技巧与掌握' });
    expect(view(before).abilities.filter(a => !NEW_IDS.includes(a.id))).toHaveLength(11);
    for (const a of view(before).abilities.filter(a => !NEW_IDS.includes(a.id))) expect(inherited.textContent).toContain(`${a.label} · 掌握${before.progression.mastery[a.id]}`);
    for (const id of NEW_IDS) expect(before.progression.mastery[id]).toBe(0);
    expect(panel.textContent).toContain('芙宁在第130周'); naturalCopy(panel);
    await userEvent.click(screen.getByRole('button', { name: '关闭贤者页面' }));
    await screen.findByRole('heading', { name: '人物卷宗' }); expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it('replays real information-form preparation without claiming application, and recommends physical movement rather than cancellation', async () => {
    const prepared = boundary('information-route-prepare').final, preparedView = view(prepared);
    expect(preparedView.actions.find(a => a.id === preparedView.preferredActionId)?.command).toEqual({ type: 'WALK', caseId: 'information-route', to: 'A' });
    const entry = boundary('information-route-form-check'), game = savedGame(entry.beforeLast); await openSage(game); await confirmActual(game, entry);
    const attempt = within(screen.getByRole('region', { name: PANEL })).getByRole('region', { name: '贤者本次尝试' });
    expect(attempt.textContent).toContain('检定成功，但尚无实际通行并重组的应用'); expect(attempt.textContent).toContain('实际应用：无');
    expect(attempt.textContent).toContain('当前尚未取得本案信息片段');
    expect(game.state.sage.life.site).toMatchObject({ body: 'INFORMATION', playerLocation: 'A', playerTravelMetres: 6, playerEnergy: 92 });
    const site = screen.getByRole('region', { name: '贤者原身体与实际现场' }); expect(site.textContent).toContain('还余20秒');
    expect(view(game.state).actions.find(a => a.id === view(game.state).preferredActionId)?.command).toEqual({ type: 'TRAVERSE_CONDUIT', caseId: 'information-route' });
    expect(screen.queryByRole('button', { name: '关闭贤者页面' })).toBeNull(); naturalCopy(attempt);
  }, 20_000);

  it('keeps actual failed sift costs and ordinary-read uncertainty until independent on-site verification', async () => {
    const entry = boundary('onsite-sift-real-information-verification'), game = savedGame(entry.beforeLast); await openSage(game);
    const beforeAttempt = view(entry.beforeLast).life.currentAttempt!; expect(beforeAttempt.siftTier).toBe('FAILURE'); expect(beforeAttempt.verified).toBe(false);
    let attempt = screen.getByRole('region', { name: '贤者本次尝试' }); expect(attempt.textContent).toContain('筛取失败，实际成本不退');
    expect(attempt.textContent).toContain('可能错误'); expect(attempt.textContent).not.toContain('现场核验后的修正');
    await confirmActual(game, entry); attempt = screen.getByRole('region', { name: '贤者本次尝试' });
    expect(attempt.textContent).toContain(view(entry.final).life.currentAttempt!.correction!); expect(attempt.textContent).toContain('实际应用：无');
    expect(game.state.progression.mastery[NEW_IDS[1]!]).toBe(entry.beforeLast.progression.mastery[NEW_IDS[1]!]); naturalCopy(attempt);
  }, 20_000);

  it('loads the actual new battle over the stale PM3 result with independent enemy wheels, original resource inventory and blocked life actions', async () => {
    const before = snapshot('combatStart'), game = savedGame(before), battle = projectSliceState(before).combat!;
    expect(before.lastCombatRound?.prophecyMasterOutcome).toBeTruthy(); expect(before.combat?.encounterId).toBe('SAGE_DISPUTE');
    expect(battle.enemyAbilityWheel).toEqual(SAGE_ENEMY_ABILITY_WHEEL); expect(battle.enemyCountWheel).toEqual(SAGE_ENEMY_COUNT_WHEEL);
    await mount(game); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    const stage = await screen.findByRole('dialog', { name: battle.title ?? '普通人追击' });
    const resources = within(stage).getByRole('region', { name: '贤者本回合实际资源' });
    expect(resources.textContent).toContain('本人健康 100 / 100'); expect(resources.textContent).toContain('独立灵性 120 / 120');
    expect(resources.textContent).toContain('本场没有同伴参战');
    expect(battle.sage?.source?.workshop).toEqual(before.scrollProfessor.workshop);
    expect(resources.textContent).toContain('没有尚未使用的已授权原卷');
    await userEvent.click(within(stage).getByText('查看公开轮盘与风险', { selector: 'summary' }));
    for (const wheel of battle.enemyAbilityWheel) expect(stage.textContent).toContain(`${wheel.label} ${wheel.weight}%`);
    for (const wheel of battle.enemyCountWheel) expect(within(stage).getByText(/^对手次数盘：/).textContent).toContain(`${wheel.label} ${wheel.weight}%`);
    const panel = screen.getByRole('region', { name: PANEL, hidden: true });
    for (const button of within(panel).getAllByRole('button', { hidden: true })) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('region', { name: '预言大师' })).toBeNull(); naturalCopy(stage); expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it('reloads the saved actual round2 BODY heavy wound and every ordered resource record before returning to the same battle', async () => {
    const before = boundary('combat-round-2').final, game = savedGame(before), round = before.lastCombatRound!;
    expect(before.health).toBe(70); expect(before.injuries.map(i => i.severity)).toEqual(['HEAVY']);
    expect(round).toMatchObject({ round: 2, consequenceDomain: 'BODY', consequenceRoll: 67, consequenceWeights: { light: 65, heavy: 30, death: 5 } });
    await mount(game); const reveal = await screen.findByRole('dialog', { name: '战斗回合结果' }); assertBodyWheel(reveal, round);
    const actions = within(reveal).getByRole('list', { name: '贤者实际动作' });
    const records = [...round.sageOutcome!.playerActions, ...round.sageOutcome!.enemyActions].sort((a, b) => a.order - b.order);
    const rows = within(actions).getAllByRole('listitem'); expect(rows).toHaveLength(records.length);
    records.forEach((a, i) => { expect(rows[i]!.textContent).toContain(a.label); expect(rows[i]!.textContent).toContain(`实耗${a.paidCost}灵性、${a.mindCost}精神`); });
    naturalCopy(reveal); await userEvent.click(within(reveal).getByRole('button', { name: '进入下一回合' }));
    await screen.findByRole('dialog', { name: projectSliceState(before).combat!.title! });
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled(); expect(screen.queryByRole('region', { name: '预言大师' })).toBeNull();
  }, 20_000);

  it('returns the actual five-round retreat to life at its new physical position, preserves two heavy injuries, then reproduces saved WORK', async () => {
    const terminal = boundary('combat-round-5').final, game = savedGame(terminal), e = terminal.sage.encounter;
    expect(terminal).toMatchObject({ status: 'ACTIVE', health: 40, injuryRisk: 1, combat: null }); expect(terminal.injuries.map(i => i.severity)).toEqual(['HEAVY', 'HEAVY']);
    expect(e.status).toBe('RETREATED'); expect(e.terminal).toMatchObject({ outcome: 'RETREATED', round: 5, exitMetres: 2, playerEnergyPaid: 2 });
    expect(e.currentSite).toMatchObject({ playerLocation: 'OUTSIDE', playerTravelMetres: 66, playerEnergy: 30 });
    await mount(game); const reveal = await screen.findByRole('dialog', { name: '战斗回合结果' }); assertBodyWheel(reveal, terminal.lastCombatRound!);
    await userEvent.click(within(reveal).getByRole('button', { name: '返回生活' }));
    if (!screen.queryByRole('region', { name: PANEL })) await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    const panel = await screen.findByRole('region', { name: PANEL }), site = within(panel).getByRole('region', { name: '贤者原身体与实际现场' });
    expect(site.textContent).toContain('院外（门口外2米）'); expect(site.textContent).toContain('累计移动66米'); expect(site.textContent).toContain('30/100');
    expect(site.textContent).toContain('PM3-BOUNDARY-RECORD'); naturalCopy(panel);
    await userEvent.click(screen.getByRole('button', { name: '关闭贤者页面' }));
    const ordinary = boundary('ordinary-life-after-actual-exit'); expect(ordinary.beforeLast).toEqual(terminal);
    const work = await screen.findByRole('button', { name: /^工作，1行动/ }); expect((work as HTMLButtonElement).disabled).toBe(false); await userEvent.click(work);
    await waitFor(() => expect(game.state).toEqual(ordinary.final));
    expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: terminal.runId, expectedRevision: terminal.revision, payload: ordinary.lastIntent });
    expect(game.state.sage.encounter).toEqual(e); expect(game.state.injuries).toEqual(terminal.injuries); expect(game.state.lastCombatRound).toEqual(terminal.lastCombatRound);
    expect(game.state).toEqual(migrateSliceState(readObjectEntry(`${ROOT}/natural.json`, 'final')));
  }, 20_000);
});
