/* @vitest-environment jsdom */
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import {
  LIFE_BOUNDARIES, boundary, capturedCommand, savedGame, mountGame, continueRun, actionButton,
  clickCommand, assertLegacyPreserved, assertSavedEnvelope, naturalEntry, renderBoundaryProjection,
} from './discerner-ui-fixture';

const view = (state: Parameters<typeof projectSliceState>[0]) => projectSliceState(state).discerner;
describe('Discerner current consent, finite impressions and physical originals', () => {
  it.each(LIFE_BOUNDARIES)('projects every saved position, resource and disclosed fact at the actual %s boundary', name => renderBoundaryProjection(name));

  it.each(['present-mark-formed', 'present-mark-card-taken', 'present-mark-checked', 'present-mark-returned', 'covered-mark-seal', 'withdrawn-mark-revoked', 'withdrawn-mark-closed', 'reflection'])('submits the actual %s physical command once without changing older people or objects', async name => {
    const captured = boundary(name), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    await mountGame(game); await clickCommand(game, capturedCommand(captured));
    expect(game.state).toEqual(migrateSliceState(captured.final));
    assertSavedEnvelope(game, before, captured.lastIntent); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('asks CONTACT and MATERIAL separately and only enables implementation after each actual current answer', async () => {
    // These are the exact next commands after the original successful potion.
    const game = savedGame(naturalEntry('promoted')), before = structuredClone(game.state);
    await mountGame(game);
    await clickCommand(game, { type: 'OBSERVE', caseId: 'present-mark' });
    await clickCommand(game, { type: 'PREPARE', caseId: 'present-mark', method: 'ABILITY' });
    const prepared = structuredClone(game.state);
    expect(view(game.state).life.currentAttempt).toMatchObject({ contactPermission: 'UNASKED', materialPermission: 'UNASKED' });
    expect(actionButton(game.state, { type: 'PERFORM', caseId: 'present-mark' }).disabled).toBe(true);
    await clickCommand(game, { type: 'CONSENT', personId: 'DCR2-ELENA', permission: 'CONTACT' });
    expect(view(game.state).life.currentAttempt).toMatchObject({ contactPermission: 'GRANTED', materialPermission: 'UNASKED' });
    expect(actionButton(game.state, { type: 'PERFORM', caseId: 'present-mark' }).disabled).toBe(true);
    expect(screen.getByRole('region', { name: '本次许可与有限印记' }).textContent).toContain('原卡交接与实读许可：尚未询问');
    await clickCommand(game, { type: 'CONSENT', personId: 'DCR2-ELENA', permission: 'MATERIAL' });
    expect(view(game.state).life.currentAttempt).toMatchObject({ contactPermission: 'GRANTED', materialPermission: 'GRANTED' });
    expect(game.state.actionsRemaining).toBe(prepared.actionsRemaining); expect(game.state.spirituality).toBe(prepared.spirituality);
    expect(view(game.state).life.practice!.knownClues).toEqual([]);
    await clickCommand(game, { type: 'PERFORM', caseId: 'present-mark' });
    expect(game.state).toEqual(migrateSliceState(boundary('present-mark-formed').beforeLast));
    assertLegacyPreserved(before, game.state);
  }, 20_000);

  it.each(['present-mark-formed', 'present-mark-ability-outcome', 'present-mark-card-taken'])('does not disclose a card or symbolic clue from the actual %s state before physical reading', async name => {
    const game = savedGame(boundary(name).final), before = structuredClone(game.state);
    await mountGame(game);
    const practice = view(game.state).life.practice!;
    expect(practice.knownClues).toEqual([]);
    for (const card of Object.values(practice.cards)) expect(Object.hasOwn(card, 'marking')).toBe(false);
    const originals = screen.getByRole('region', { name: '原卡实际持有与归还' });
    expect(originals.textContent!.match(/原卡内容尚未向本人实际披露/g)).toHaveLength(3);
    expect(screen.getByRole('region', { name: '已实际披露的本案线索' }).textContent).toContain('尚未取得本案线索或实读内容');
    for (const secret of ['缺口圆环', '三段不相接的短直线', '偏向右侧的细小弯钩']) expect(screen.getByRole('region', { name: '洞察者' }).textContent).not.toContain(secret);
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it.each([
    ['present-mark-ability-outcome', 'FAILED', 95, 'FAILURE'],
    ['covered-mark-ability-outcome', 'BLOCKED', 76, 'SUCCESS'],
  ] as const)('retains the actual one-shot %s result and full 6S/2M cost without a hidden read or retry', async (name, result, roll, tier) => {
    const captured = boundary(name), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    const publicBefore = view(before);
    await mountGame(game); await clickCommand(game, { type: 'MENTAL_IMPRINT' });
    expect(game.state).toEqual(migrateSliceState(captured.final));
    const current = view(game.state), attempt = current.life.currentAttempt!;
    expect(attempt.imprintResult).toBe(result); expect(attempt.check).toMatchObject({ roll, chance: 76, tier });
    expect(attempt.spiritualitySpent).toBe(6); expect(attempt.ownerMindSpent).toBe(2);
    expect(game.state.spirituality).toBe(before.spirituality - 6); expect(game.state.mind).toBe(before.mind - 2);
    expect(game.state.actionsRemaining).toBe(before.actionsRemaining); expect(game.state.cash).toBe(before.cash);
    expect(current.life.practice!.knownClues).toEqual(publicBefore.life.practice!.knownClues);
    expect(current.life.practice!.participants).toEqual(publicBefore.life.practice!.participants);
    expect(game.state.progression.mastery).toEqual(before.progression.mastery);
    expect(current.actions.some(a => a.command.type === 'MENTAL_IMPRINT')).toBe(false);
    expect(screen.queryByRole('button', { name: /^近距尝试一次/ })).toBeNull();
    expect(screen.getByRole('region', { name: '本次许可与有限印记' }).textContent).toContain(result === 'FAILED' ? '检定失败，未取得线索' : '被原保护封签阻挡，未取得线索');
    if (result === 'BLOCKED') {
      expect(publicBefore.life.practice!.seal).toMatchObject({ active: true, charges: 1, holder: 'TARGET', node: 'FAR' });
      expect(current.life.practice!.seal).toMatchObject({ active: false, charges: 0, holder: 'TARGET', node: 'FAR' });
      expect(actionButton(game.state, { type: 'ACTIVATE_SEAL' }).disabled).toBe(true);
      expect(screen.getByRole('region', { name: '原保护封签' }).textContent).toContain('剩余额度 0');
    }
    assertSavedEnvelope(game, before, captured.lastIntent); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('can wait for the finite mark to expire using a public command while keeping the original card private and ordinary return available', async () => {
    // Explicit additional UI branch from the natural pre-scan save, not the natural outcome.
    const game = savedGame(boundary('present-mark-ability-outcome').beforeLast), before = structuredClone(game.state);
    const initial = view(before).life.currentAttempt!;
    await mountGame(game); await clickCommand(game, { type: 'WAIT_MARK' });
    const after = view(game.state);
    expect(after.life.currentAttempt!.markRemainingSeconds).toBe(0);
    expect(after.life.currentAttempt!.elapsedSeconds).toBe(initial.elapsedSeconds + initial.markRemainingSeconds);
    expect(after.life.currentAttempt!.ownerNode).toBe(initial.ownerNode);
    expect(after.life.practice!.cards).toEqual(view(before).life.practice!.cards);
    expect(after.life.practice!.knownClues).toEqual([]);
    expect(actionButton(game.state, { type: 'MENTAL_IMPRINT' }).disabled).toBe(true);
    expect(actionButton(game.state, { type: 'TAKE_CARD' }).disabled).toBe(false);
    expect(game.state.spirituality).toBe(before.spirituality); expect(game.state.mind).toBe(before.mind);
    expect(screen.getByRole('region', { name: '本次许可与有限印记' }).textContent).toContain('已实际形成并到期');
  }, 20_000);

  it('keeps MATERIAL consent after actual CONTACT withdrawal and permits only the independent physical handover', async () => {
    const game = savedGame(boundary('withdrawn-mark-revoked').final), before = structuredClone(game.state);
    await mountGame(game);
    expect(view(game.state).life.currentAttempt).toMatchObject({ contactPermission: 'WITHDRAWN', materialPermission: 'GRANTED', imprintAttempted: false });
    expect(actionButton(game.state, { type: 'MENTAL_IMPRINT' }).disabled).toBe(true);
    await clickCommand(game, { type: 'MOVE', actor: 'OWNER', to: 'FAR' });
    expect(actionButton(game.state, { type: 'MENTAL_IMPRINT' }).disabled).toBe(true);
    await clickCommand(game, { type: 'TAKE_CARD' });
    const current = view(game.state);
    expect(current.life.practice!.cards['DCR2-SELMA-CARD']).toMatchObject({ holder: 'OWNER', node: 'FAR' });
    expect(Object.hasOwn(current.life.practice!.cards['DCR2-SELMA-CARD'], 'marking')).toBe(false);
    expect(current.life.practice!.knownClues.some(c => c.caseId === 'withdrawn-mark')).toBe(false);
    expect(game.state.spirituality).toBe(before.spirituality); expect(game.state.mind).toBe(before.mind);
    assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('honors a separate MATERIAL withdrawal without teleporting the held card or blocking its ordinary return', async () => {
    // Explicit additional legal UI branch; the captured natural card was already voluntarily handed over.
    const game = savedGame(boundary('present-mark-card-taken').final), before = structuredClone(game.state);
    await mountGame(game);
    await clickCommand(game, { type: 'REVOKE_CONSENT', personId: 'DCR2-ELENA', permission: 'MATERIAL' });
    expect(view(game.state).life.currentAttempt).toMatchObject({ contactPermission: 'GRANTED', materialPermission: 'WITHDRAWN' });
    await clickCommand(game, { type: 'MOVE', actor: 'OWNER', to: 'NEAR' });
    expect(actionButton(game.state, { type: 'CHECK_CARD' }).disabled).toBe(true);
    expect(actionButton(game.state, { type: 'RETURN_CARD' }).disabled).toBe(true);
    expect(view(game.state).life.practice!.cards['DCR2-ELENA-CARD']).toMatchObject({ holder: 'OWNER', node: 'NEAR' });
    await clickCommand(game, { type: 'MOVE', actor: 'OWNER', to: 'FAR' });
    await clickCommand(game, { type: 'RETURN_CARD' });
    expect(view(game.state).life.practice!.cards['DCR2-ELENA-CARD']).toMatchObject({ holder: 'TARGET', node: 'FAR' });
    expect(view(game.state).life.practice!.knownClues).toEqual([]);
    expect(view(game.state).life.currentAttempt!.ownerNode).toBe('FAR');
    expect(actionButton(game.state, { type: 'CLOSE', caseId: 'present-mark' }).disabled).toBe(true);
    expect(game.state.spirituality).toBe(before.spirituality); expect(game.state.mind).toBe(before.mind);
  }, 20_000);

  it('physically returns the same card without returning the body, then walks back, verifies and closes the actual ordinary result', async () => {
    const captured = boundary('present-mark-returned'), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    await mountGame(game); await clickCommand(game, { type: 'RETURN_CARD' });
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(view(game.state).life.practice!.cards['DCR2-ELENA-CARD']).toMatchObject({ holder: 'TARGET', node: 'FAR' });
    expect(view(game.state).life.practice!.ownerNode).toBe('FAR');
    expect(actionButton(game.state, { type: 'VERIFY', caseId: 'present-mark' }).disabled).toBe(true);
    expect(actionButton(game.state, { type: 'CLOSE', caseId: 'present-mark' }).disabled).toBe(true);
    await clickCommand(game, { type: 'MOVE', actor: 'OWNER', to: 'NEAR' });
    await clickCommand(game, { type: 'VERIFY', caseId: 'present-mark' });
    await clickCommand(game, { type: 'CLOSE', caseId: 'present-mark' });
    const current = view(game.state), history = current.life.cases.find(c => c.id === 'present-mark')!.attempts.at(-1)!;
    expect(history).toMatchObject({ closed: true, result: 'ORDINARY', imprintResult: 'FAILED', cardChecked: true, cardReturned: true, verified: true, ownerTravelMetres: 12 });
    expect(current.life.practice!.ownerNode).toBe('NEAR'); expect(current.life.currentAttempt).toBeNull();
    expect(current.life.practice!.knownClues).toEqual(view(before).life.practice!.knownClues);
    expect(game.state.progression.mastery).toEqual(before.progression.mastery);
    await userEvent.click(screen.getByRole('button', { name: '关闭洞察者页面' }));
    expect(screen.getByRole('heading', { name: '人物卷宗' })).toBeTruthy();
    assertLegacyPreserved(before, game.state);
  }, 20_000);

  it.each(['prepare-current-week', 'present-mark-ability-outcome', 'covered-mark-ability-outcome', 'withdrawn-mark-revoked'])('cannot bypass the saved %s physical lock by returning to the title and continuing', async name => {
    const game = savedGame(boundary(name).final), before = structuredClone(game.state);
    expect(view(game.state).insideCase).toBe(true); await mountGame(game);
    expect(screen.queryByRole('button', { name: '关闭洞察者页面' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^工作，1行动/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '返回主菜单' })); await continueRun(game);
    expect(screen.queryByRole('button', { name: '关闭洞察者页面' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^工作，1行动/ })).toBeNull();
    const selector = screen.queryByRole('combobox', { name: '选择洞察者生活情境' }) as HTMLSelectElement | null;
    if (selector) expect(selector.disabled).toBe(true);
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it('reopens the three actual ordinary completions with all original cards returned, no renewed consent and zero life mastery awards', async () => {
    const game = savedGame(naturalEntry('practiced')), before = structuredClone(game.state), current = view(before);
    expect(game.state.progression.acting).toBe(100); expect(current.life.reflected).toBe(true);
    expect(current.life.cases.map(c => c.attempts.at(-1)!.result)).toEqual(['ORDINARY', 'ORDINARY', 'ORDINARY']);
    expect(current.life.cases.map(c => c.attempts.at(-1)!.imprintResult)).toEqual(['FAILED', 'BLOCKED', 'NONE']);
    expect(game.state.progression.mastery['audience.s2.mental-imprint']).toBe(0);
    expect(game.state.progression.mastery['audience.s2.insight-window']).toBe(0);
    expect(current.life.currentConsents.every(c => !c.consented && !c.materialConsented)).toBe(true);
    expect(current.life.practice!.knownClues.every(c => c.source === 'PHYSICAL_ORIGINAL')).toBe(true);
    await mountGame(game);
    for (const caseId of ['present-mark', 'covered-mark', 'withdrawn-mark']) {
      await userEvent.selectOptions(screen.getByRole('combobox', { name: '选择洞察者生活情境' }), caseId);
      expect(screen.getByRole('region', { name: '当前洞察者生活情境' }).textContent).toContain('已通过普通实物来源核验');
    }
    expect(screen.getByRole('region', { name: '原保护封签' }).textContent).toContain('剩余额度 0');
    await userEvent.click(screen.getByText('三名成年人的当前许可与资源', { selector: 'summary' }));
    expect(screen.getByRole('region', { name: '洞察者本案成年人' }).textContent).toContain('当前未同意');
    await userEvent.click(screen.getByRole('button', { name: '关闭洞察者页面' }));
    expect(screen.getByRole('button', { name: /^工作，1行动/ })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);
});
