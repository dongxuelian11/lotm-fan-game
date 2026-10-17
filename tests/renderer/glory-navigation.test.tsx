/* @vitest-environment jsdom */
import { readFileSync } from 'node:fs';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceCombatRound, SliceIntent, SliceState } from '../../src/domain/slice/types';
import type { GloryCommand } from '../../src/domain/glory/types';
import { GLORY_ENEMY_ABILITY_WHEEL, GLORY_ENEMY_COUNT_WHEEL } from '../../src/domain/glory/combat';
import type { SliceBridge } from '../../src/shared/slice-contracts';
import { readObjectEntry } from '../helpers/read-object-entry';

const ROOT = 'tests/fixtures/glory-v01760';
const OLD = 'tests/fixtures/silver-knight-v01520/directed.json';
const PANEL = '荣耀者', ENTRY = '荣耀者与护持修整室';
const LEGACY = ['warrior', 'gladiator', 'weaponmaster', 'dawnPaladin', 'guardian', 'demonHunter', 'silverKnight'] as const;
const NEW_IDS = ['warrior.s2.armor-temper', 'warrior.s2.close-guard'] as const;
const CASES = ['armor-temper', 'close-guard', 'revoked-crossing'] as const;
interface Boundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
// Only actual lead-produced captures are inputs. Do not generate a route, patch
// a fixture, or turn the earlier directed S3 history into a natural claim.
const index = JSON.parse(readFileSync(`${ROOT}/boundaries.index.json`, 'utf8')) as Record<string, string>;
function boundary(name: string): Boundary {
  if (!index[name]) throw new Error(`Missing actual Glory boundary: ${name}`);
  const file = `${ROOT}/${index[name]}`;
  return { beforeLast: migrateSliceState(readObjectEntry(file, 'beforeLast')),
    lastIntent: readObjectEntry<SliceIntent>(file, 'lastIntent'), final: migrateSliceState(readObjectEntry(file, 'final')) };
}
function snapshot(name: 'departureStart' | 'guidanceStart' | 'promoted' | 'practiced' | 'combatStart'): SliceState {
  return migrateSliceState(JSON.parse(readFileSync(`${ROOT}/snapshot-${name}.json`, 'utf8')));
}
const view = (state: SliceState) => projectSliceState(state).glory;
function commandOf(entry: Boundary): GloryCommand {
  if (entry.lastIntent.type !== 'GLORY') throw new Error('Expected the recorded public Glory command.');
  return entry.lastIntent.command;
}
function savedGame(input: unknown, options: { deferFirstSave?: boolean; failFirstSave?: boolean } = {}) {
  let state = migrateSliceState(input), attempts = 0, releaseFirstSave = () => {};
  assertValidSliceState(state);
  const firstSave = new Promise<void>(resolve => { releaseFirstSave = resolve; });
  const submit: SliceBridge['submitIntent'] = vi.fn(async envelope => {
    if (envelope.payload.type === 'CREATE') throw new Error('The original campaign already exists.');
    const attempt = attempts++;
    if (attempt === 0 && options.deferFirstSave) await firstSave;
    if (attempt === 0 && options.failFirstSave) return { ok: false as const,
      error: { code: 'SAVE_FAILED', message: '这次原操作尚未保存', retryable: true } };
    state = applySliceIntent(state, envelope.payload); assertValidSliceState(state);
    return { ok: true as const, value: { intentId: envelope.intentId, runId: state.runId,
      previousRevision: envelope.expectedRevision, newRevision: state.revision,
      committedAt: '2026-10-14T08:00:00Z', replayed: false, state: projectSliceState(state) } };
  });
  return { get state() { return state; }, submit, releaseFirstSave };
}
type SavedGame = ReturnType<typeof savedGame>;
async function mount(game: SavedGame) {
  const state = projectSliceState(game.state);
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge["getBootstrap"]>(async () => ({ ok: true, value: { mode: 'browser', activeState: state, runs: [{
      runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
      week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: '2026-10-14T07:59:00Z',
    }] } })),
    loadRun: vi.fn<SliceBridge["loadRun"]>(async () => ({ ok: true, value: projectSliceState(game.state) })), submitIntent: game.submit,
  };
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: state.status === 'DEAD' ? /查看封存/ : /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(screen.queryByRole('region', { name: PANEL })
    ?? screen.queryByRole('heading', { name: '人物卷宗' })
    ?? screen.queryByRole('dialog', { name: '战斗回合结果' })
    ?? (state.combat ? screen.queryByRole('dialog', { name: state.combat.title ?? "普通人追击" }) : null)
    ?? (state.ending ? screen.queryByRole('heading', { name: state.ending.title }) : null)).toBeTruthy());
}
async function acknowledgeReveal() {
  const reveal = screen.queryByRole('dialog', { name: '战斗回合结果' });
  if (reveal) await userEvent.click(within(reveal).getByRole('button', { name: /^(返回生活|进入下一回合|查看收尾卷宗)$/ }));
}
async function openGlory(game: SavedGame) {
  await mount(game); await acknowledgeReveal();
  if (!screen.queryByRole('region', { name: PANEL })) await userEvent.click(screen.getByRole('button', { name: ENTRY }));
  return screen.findByRole('region', { name: PANEL });
}
function actionButton(state: SliceState, command: GloryCommand): HTMLButtonElement {
  const action = view(state).actions.find(a => JSON.stringify(a.command) === JSON.stringify(command));
  if (!action) throw new Error(`Missing actual public action: ${JSON.stringify(command)}`);
  return screen.getAllByRole('button', { name: name => name.startsWith(action.label), hidden: true }).at(-1)! as HTMLButtonElement;
}
async function control(state: SliceState, command: GloryCommand) {
  if ('bottleId' in command) {
    const select = screen.getByRole('combobox', { name: '查看药瓶' }) as HTMLSelectElement;
    if (!select.disabled && select.value !== command.bottleId) await userEvent.selectOptions(select, command.bottleId);
  }
  const button = actionButton(state, command), details = button.closest('details');
  if (details && !details.open) await userEvent.click(details.querySelector('summary')!);
  return button;
}
function assertLegacy(before: SliceState, after: SliceState) {
  expect(after.runId).toBe(before.runId); expect(after.random.seed).toBe(before.random.seed);
  expect(after.character.gender).toBe(before.character.gender);
  for (const key of LEGACY) expect(after[key]).toEqual(before[key]);
  for (const [id, mastery] of Object.entries(before.progression.mastery)) {
    if (!NEW_IDS.includes(id as typeof NEW_IDS[number])) expect(after.progression.mastery[id]).toBe(mastery);
  }
}
function assertEnvelope(game: SavedGame, before: SliceState, intent: SliceIntent) {
  expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: before.runId,
    expectedRevision: before.revision, payload: intent });
}
function fact(section: HTMLElement, label: string): string {
  return within(section).getByText(label, { selector: 'dt' }).closest('div')!.querySelector('dd')!.textContent!;
}
function assertRecordedBodyWheel(reveal: HTMLElement, round: SliceCombatRound) {
  expect(round.gloryOutcome).toBeTruthy(); expect(round.consequenceDomain).toBe('BODY');
  expect(within(reveal).getByRole('heading', { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
  expect(reveal.textContent).not.toContain('精神后果盘');
  if (round.consequenceWeights) {
    const w = round.consequenceWeights;
    expect(reveal.textContent!.replace(/\s+/g, ' ')).toContain(`败者后果盘：轻伤 ${w.light}% · 重伤 ${w.heavy}% · 死亡 ${w.death}%`);
  }
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

describe('Glory navigation from the unchanged, explicitly directed Silver Knight source', () => {
  it('preserves the actual 70-command prefix and H30 wounds, prioritizes clinic guidance, and separates current S3 growth from the new proposal', async () => {
    const original = migrateSliceState(readObjectEntry(OLD, 'final'));
    const game = savedGame(snapshot('departureStart')), before = structuredClone(game.state);
    expect(before).toEqual(original);
    const oldCommands = readObjectEntry<SliceIntent[]>(OLD, 'commands');
    const commands = readObjectEntry<SliceIntent[]>(`${ROOT}/natural.json`, 'commands');
    expect(oldCommands).toHaveLength(70); expect(commands).toHaveLength(158);
    expect(commands.slice(0, 70)).toEqual(oldCommands);
    expect(readObjectEntry(`${ROOT}/natural.json`, 'startingState')).toEqual(readObjectEntry(OLD, 'startingState'));
    expect(readObjectEntry(`${ROOT}/natural.json`, 'provenance')).toEqual(readObjectEntry(OLD, 'provenance'));
    expect(readObjectEntry(`${ROOT}/natural.json`, 'continuation')).toMatchObject({ kind: 'DIRECTED_SILVER_KNIGHT_PREFIX_THEN_PUBLIC_GLORY', sourceS3Setup: 'DIRECTED', exactPublicPrefixCommands: 70, fullNaturalS9ToS2: false, newRandomChanges: false });
    expect(before.progression).toMatchObject({ pathwayId: 'warrior', sequence: 3, acting: 100 });
    expect(before.character.gender).toBe('FEMALE'); expect(before.health).toBe(30);
    expect(before.injuries.map(i => i.severity)).toEqual(['HEAVY', 'HEAVY', 'LIGHT']);
    expect(before.injuries.every(i => i.treatedRevision === null)).toBe(true);
    expect(before.silverKnight.life.armor).toMatchObject({ id: 'SK3-LIFE-ARMOR', formed: true, active: false, integrity: 65, remainingSeconds: 0 });
    await mount(game); await acknowledgeReveal();
    expect(screen.getByText(`银骑士 · 序列3 · ${projectSliceState(before).character.professionName}`, { selector: 'p' })).toBeTruthy();
    expect(screen.getByText('先查看伤势恢复路线')).toBeTruthy();
    const recovery = screen.getByRole('region', { name: '伤势与恢复路线' });
    expect(within(recovery).getByRole('button', { name: '查看普通诊疗点' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    await screen.findByRole('region', { name: '银骑士' });
    expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    const panel = await screen.findByRole('region', { name: PANEL });
    expect(panel.textContent).toContain('白银骑士3 → 荣耀者2');
    expect(within(panel).getByRole('region', { name: '荣耀者独立药瓶与准备' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: '银骑士' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '关闭荣耀者页面' }));
    await screen.findByRole('heading', { name: '人物卷宗' });
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it.each(['promoted', 'practiced'] as const)('loads actual %s S2 growth with 18 inherited and two new skills and the same historical armor', async name => {
    const game = savedGame(snapshot(name)), before = structuredClone(game.state), actual = view(before);
    expect(before.progression.sequence).toBe(2); expect(before.lastCombatRound?.silverKnightOutcome).toBeTruthy();
    expect(actual.abilities).toHaveLength(20); expect(Object.keys(before.progression.mastery)).toHaveLength(20);
    expect(actual.abilities.filter(a => NEW_IDS.includes(a.id as typeof NEW_IDS[number])).map(a => a.id).sort()).toEqual([...NEW_IDS].sort());
    assertLegacy(snapshot('departureStart'), before);
    await mount(game); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    expect(screen.getByText(`荣耀者 · 序列2 · ${projectSliceState(before).character.professionName}`, { selector: 'p' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    const panel = await screen.findByRole('region', { name: PANEL });
    expect(screen.queryByRole('region', { name: '银骑士' })).toBeNull();
    const newSkills = within(panel).getByRole('region', { name: '荣耀者两项新技巧' });
    await userEvent.click(within(panel).getByText('身体与已有经历', { selector: 'summary' }));
    const inherited = within(panel).getByRole('region', { name: '荣耀者十八项已有掌握' });
    for (const ability of actual.abilities) {
      expect((NEW_IDS.includes(ability.id as typeof NEW_IDS[number]) ? newSkills : inherited).textContent).toContain(`${ability.label} · 掌握${ability.mastery}`);
      expect(ability.mastery).toBe(before.progression.mastery[ability.id]);
    }
    const armor = within(panel).getByRole('region', { name: '荣耀者同一银甲与当前物资' });
    expect(fact(armor, '白银骑士时期留存完整度')).toContain('65/100');
    expect(armor.textContent).toContain('原物编号：SK3-LIFE-ARMOR');
    expect(before.silverKnight.life.armor.integrity).toBe(65);
    if (name === 'promoted') {
      for (const id of NEW_IDS) expect(before.progression.mastery[id]).toBe(0);
      expect(fact(armor, '同一件银甲当前完整度')).toBe('尚未当面核对');
    } else {
      const p = before.glory.life.site;
      expect(p.armorSource!.snapshot).toEqual(before.silverKnight.life.armor);
      expect(p.armor!.id).toBe(before.silverKnight.life.armor.id);
      expect(p.armor!.integrity).toBe(60);
      expect(p.pads).toMatchObject({ remaining: 1, consumed: 1 });
      expect(p.guard).toMatchObject({ sharedHealth: 5, sharedEnergy: 5 });
      expect(fact(armor, '同一件银甲当前完整度')).toBe(`${p.armor!.integrity}/100`);
      expect(before.glory.life.reflected).toBe(true); expect(before.progression.acting).toBe(100);
      for (const id of NEW_IDS) expect(before.progression.mastery[id]).toBe(8);
      for (const id of NEW_IDS) expect(before.progression.mastery[id]).toBe(CASES.reduce((n, caseId) => n + before.glory.life.cases[caseId].attempts.filter(a => a.appliedAbilityIds.includes(id)).length * 8, 0));
      for (const caseId of CASES) expect(before.glory.life.cases[caseId]).toMatchObject({ status: 'RESOLVED', contactOpen: false });
      expect(before.glory.life.cases['revoked-crossing'].attempts.at(-1)).toMatchObject({ permissionWithdrawn: true, abilityTier: null, appliedAbilityIds: [], plateReturned: true, closed: true });
    }
    await userEvent.click(screen.getByRole('button', { name: '关闭荣耀者页面' }));
    await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    await screen.findByRole('region', { name: PANEL });
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it('cancels the actual bottle confirmation without cost, locks a pending/failed save, then retries the identical envelope once without another random draw', async () => {
    const entry = boundary('actual-promotion'), command = commandOf(entry);
    if (command.type !== 'CONSUME') throw new Error('Actual promotion must consume its own original bottle.');
    const game = savedGame(entry.beforeLast, { deferFirstSave: true, failFirstSave: true }), before = structuredClone(game.state);
    expect(command.confirmed).toBe(true); expect(before.glory.bottles.find(b => b.id === command.bottleId)!.status).toBe('PLAYER');
    await openGlory(game); const trigger = await control(game.state, command);
    await userEvent.click(trigger);
    let review = await screen.findByRole('dialog', { name: '独立确认服用这一药瓶' });
    expect(review.textContent).toContain(view(before).bottles.find(b => b.id === command.bottleId)!.title);
    expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(review).getByRole('button', { name: '取消，返回查看' }));
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(trigger); review = await screen.findByRole('dialog', { name: '独立确认服用这一药瓶' });
    fireEvent.keyDown(review, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByRole('dialog', { name: '独立确认服用这一药瓶' })).toBeNull();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(trigger); review = await screen.findByRole('dialog', { name: '独立确认服用这一药瓶' });
    const confirm = within(review).getByRole('button', { name: '确认服用这一药瓶' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(game.submit).toHaveBeenCalledOnce(); expect(game.state).toEqual(before);
    expect(screen.getByRole('region', { name: PANEL }).getAttribute('aria-busy')).toBe('true');
    expect(actionButton(before, command).disabled).toBe(true);
    expect((screen.getByRole('combobox', { name: '查看药瓶' }) as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '返回主菜单' }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { game.releaseFirstSave(); }); await screen.findAllByRole('alert');
    expect(game.state).toEqual(before); expect(actionButton(before, command).disabled).toBe(true);
    // A native top-layer dialog must release the parent's retry control on error.
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '独立确认服用这一药瓶' })).toBeNull());
    fireEvent.click(actionButton(before, command)); expect(game.submit).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: '重试这次操作' }));
    await waitFor(() => expect(game.state).toEqual(entry.final));
    const calls = vi.mocked(game.submit).mock.calls;
    expect(calls).toHaveLength(2); expect(calls[1]![0]).toEqual(calls[0]![0]);
    expect(calls[0]![0]).toEqual({ intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload: entry.lastIntent });
    assertLegacy(before, game.state);
    expect(game.state.random).toEqual(entry.final.random); expect(game.state.random.cursor).toBe(before.random.cursor + 1);
    expect(game.state.spirituality).toBe(before.spirituality);
    expect(game.state.injuries).toEqual(before.injuries); expect(game.state.injuryRisk).toBe(before.injuryRisk);
    expect(game.state.glory.bottles.filter(b => b.id !== command.bottleId)).toEqual(before.glory.bottles.filter(b => b.id !== command.bottleId));
    expect(game.state.glory.bottles.find(b => b.id === command.bottleId)).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_SUCCESS', consumedWeek: 138 });
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  }, 20_000);
});

describe('Glory actual saved battle and terminal navigation', () => {
  it('loads the actual new opponent and both public enemy wheels, while the battle blocks life commands', async () => {
    const game = savedGame(snapshot('combatStart')), before = structuredClone(game.state), battle = projectSliceState(before).combat!;
    expect(before.combat?.encounterId).toBe('GLORY_DISPUTE'); expect(before.lastCombatRound?.silverKnightOutcome).toBeTruthy();
    expect(battle.enemyAbilityWheel).toEqual(GLORY_ENEMY_ABILITY_WHEEL); expect(battle.enemyCountWheel).toEqual(GLORY_ENEMY_COUNT_WHEEL);
    expect(battle.enemyAbilityWheel.map(({ id, weight }) => ({ id, weight }))).toEqual([
      { id: 'FORCE_STRIKE', weight: 35 }, { id: 'GUARD', weight: 25 }, { id: 'BODY_STRIKE', weight: 20 }, { id: 'DISCERN', weight: 15 }, { id: 'ACCIDENT', weight: 5 },
    ]);
    await mount(game); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    const dialog = await screen.findByRole('dialog', { name: battle.title ?? "普通人追击" });
    expect(battle.enemyName).toContain('马丁');
    const resources = within(dialog).getByRole('region', { name: '荣耀者本回合实际资源' });
    expect(resources.textContent).toContain(`本人健康 ${before.health} / ${projectSliceState(before).maxHealth}`);
    expect(resources.textContent).toContain(`独立灵性 ${before.glory.encounter.enemySpirituality} / 120`);
    expect(resources.textContent).toContain('当前没有同行者');
    const panel = screen.getByRole('region', { name: PANEL, hidden: true });
    expect(panel.textContent).toContain('请先处理当前阻塞事项');
    for (const button of within(panel).getAllByRole('button', { hidden: true })) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(before.glory.life.site).toMatchObject({ playerLocation: 'YARD', celia: { location: 'OUTSIDE' }, evan: { location: 'OUTSIDE' } });
    await userEvent.click(within(dialog).getByText('查看公开轮盘与风险', { selector: 'summary' }));
    for (const wheel of GLORY_ENEMY_ABILITY_WHEEL) expect(dialog.textContent).toContain(`${wheel.label} ${wheel.weight}%`);
    const count = within(dialog).getByText(/^对手次数盘：/);
    for (const wheel of GLORY_ENEMY_COUNT_WHEEL) expect(count.textContent).toContain(`${wheel.label} ${wheel.weight}%`);
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it('submits and reloads the captured first Glory round instead of hiding it behind the old Silver Knight reveal mask', async () => {
    const entry = boundary('combat-round-1'), game = savedGame(entry.beforeLast), before = structuredClone(game.state);
    if (entry.lastIntent.type !== 'COMBAT_ROUND') throw new Error('Expected the actual first combat round.');
    const intent = entry.lastIntent, battle = projectSliceState(before).combat!, option = battle.stances.find(s => s.id === intent.stance)!;
    await mount(game); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    const stage = await screen.findByRole('dialog', { name: battle.title ?? "普通人追击" });
    await userEvent.click(within(stage).getByRole('button', { name: name => name.startsWith(option.label) }));
    await userEvent.click(within(stage).getByRole('button', { name: '确认姿态，结算完整回合' }));
    await waitFor(() => expect(game.state).toEqual(entry.final));
    let reveal = await screen.findByRole('dialog', { name: '战斗回合结果' });
    assertRecordedBodyWheel(reveal, game.state.lastCombatRound!); assertEnvelope(game, before, entry.lastIntent); assertLegacy(before, game.state);
    const saved = structuredClone(game.state); cleanup();
    const reloaded = savedGame(saved); await mount(reloaded);
    reveal = await screen.findByRole('dialog', { name: '战斗回合结果' });
    assertRecordedBodyWheel(reveal, saved.lastCombatRound!);
    expect(screen.queryByRole('region', { name: '银骑士' })).toBeNull();
    expect(reloaded.state).toEqual(saved); expect(reloaded.submit).not.toHaveBeenCalled();
  }, 20_000);

  it('shows the actual recorded BODY injury wheel after reloading, with its saved costs and same-object armor wear', async () => {
    const entry = boundary('combat-body-consequence'), game = savedGame(entry.final), before = structuredClone(game.state), round = before.lastCombatRound!;
    expect(round).toMatchObject({ round: 1, consequenceRoll: 19, consequenceWeights: { light: 65, heavy: 30, death: 5 } });
    expect(before.health).toBe(90); expect(before.injuries).toHaveLength(1); expect(before.injuries[0]!.severity).toBe('LIGHT');
    expect(round.gloryOutcome).toMatchObject({ armorWear: 0, healthPaid: 0, armorIntegrityAfter: 60 });
    expect(round.gloryOutcome).toBeTruthy(); expect(round.consequenceDomain).toBe('BODY');
    await mount(game); const reveal = await screen.findByRole('dialog', { name: '战斗回合结果' });
    assertRecordedBodyWheel(reveal, round);
    expect(before.silverKnight.life.armor).toEqual(entry.beforeLast.silverKnight.life.armor);
    expect(view(before).life.historicalArmorIntegrity).toBe(65);
    expect(view(before).life.armorIdentity).toBe('SK3-LIFE-ARMOR');
    expect(view(before).life.currentArmorIntegrity).toBe(round.gloryOutcome!.armorIntegrityAfter);
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it('retains the actual two-round surrender and ordinary two-metre exit, then commits the recorded WORK continuation', async () => {
    const entry = boundary('combat-terminal'), game = savedGame(entry.final), before = structuredClone(game.state);
    const terminal = before.glory.encounter.terminal!, outcome = before.lastCombatRound!.gloryOutcome!;
    expect(before.combat).toBeNull(); expect(before).toMatchObject({ status: 'ACTIVE', health: 90, mind: 100, injuryRisk: 0 });
    expect(before.health).toBe(outcome.playerHealthAfter); expect(before.mind).toBe(outcome.playerMindAfter); expect(before.spirituality).toBe(outcome.playerSpiritualityAfter);
    expect(terminal).toMatchObject({ outcome: 'ENEMY_SURRENDERED', round: 2, exitMetres: 2, exitSeconds: 2, playerEnergyPaid: 2 });
    expect(before.glory.encounter).toMatchObject({ targetId: 'GL2-MARTIN', enemyPosition: 'YARD', ordinaryExit: 'OPEN', enemyHealth: 70, enemySpirituality: 110, enemyStatus: 'SURRENDERED' });
    expect(before.glory.life.site).toMatchObject({ playerLocation: 'OUTSIDE', celia: { location: 'OUTSIDE' }, evan: { location: 'OUTSIDE' } });
    expect(outcome).toMatchObject({ armorWear: 0, healthPaid: 0, armorIntegrityAfter: 60 });
    assertLegacy(snapshot('departureStart'), before);
    await mount(game); const reveal = await screen.findByRole('dialog', { name: '战斗回合结果' });
    assertRecordedBodyWheel(reveal, before.lastCombatRound!);
    expect(screen.queryByRole('region', { name: '银骑士' })).toBeNull();
    const ordinary = boundary('ordinary-life-after-actual-exit');
    expect(ordinary.beforeLast).toEqual(before); expect(ordinary.lastIntent).toEqual({ type: 'ACTION', action: 'WORK' });
    expect(ordinary.final).toEqual(migrateSliceState(readObjectEntry(`${ROOT}/natural.json`, 'final')));
    await userEvent.click(within(reveal).getByRole('button', { name: '返回生活' }));
    const closePanel = screen.queryByRole('button', { name: '关闭荣耀者页面' });
    if (closePanel) await userEvent.click(closePanel);
    const work = await screen.findByRole('button', { name: /^工作，1行动/ });
    expect((work as HTMLButtonElement).disabled).toBe(false); await userEvent.click(work);
    await waitFor(() => expect(game.state).toEqual(ordinary.final));
    assertEnvelope(game, before, ordinary.lastIntent); assertLegacy(before, game.state);
    expect(game.state.glory.life.site).toEqual(before.glory.life.site);
    expect(game.state.lastCombatRound).toEqual(before.lastCombatRound);
  }, 20_000);
});
