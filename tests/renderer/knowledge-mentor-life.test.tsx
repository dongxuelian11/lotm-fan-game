/* @vitest-environment jsdom */
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { migrateSliceState } from '../../src/domain/slice/migration';
import {
  CASES, PANEL, boundary, naturalEntry, boundaryNames, capturedCommand, savedGame,
  mountGame, naturalCommandBoundary, commandControl, actionButton, clickCommand, settled, view,
  assertLegacyPreserved, assertSavedEnvelope, renderBoundaryProjection,
} from './knowledge-mentor-ui-fixture';

describe('Knowledge Mentor original plates, separate current permissions and physical closure', () => {
  it.each(boundaryNames(/^(paid-recharge-|documented-cycle-|consented-transfer-|blocked-cycle-|vera-|reflection$|combat-plate-)/))('projects each committed fact at actual %s without rerolling', renderBoundaryProjection);

  it.each(CASES)('binds the actual %s unique paid original once and retains its exact result and costs', async caseId => {
    const captured = boundary(`${caseId}-binding-outcome`), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    const prior = view(before).life.currentAttempt!;
    expect(prior.recordsRead).toBe(true); expect(prior.baselines).toHaveLength(2);
    expect(prior.plate).toMatchObject({ status: 'BLANK', location: 'PLAYER', paidPennies: 60 });
    await mountGame(game); await clickCommand(game, capturedCommand(captured));
    expect(game.state).toEqual(migrateSliceState(captured.final));
    const current = view(game.state).life.currentAttempt!;
    expect(current.plate!.id).toBe(prior.plate!.id);
    expect(current.paidPennies).toBe(60); expect(current.spiritualitySpent).toBe(prior.spiritualitySpent + 4);
    expect(game.state.spirituality).toBe(before.spirituality - 4);
    expect(game.state.cash).toBe(before.cash); expect(current.bindCheck).not.toBeNull();
    if (caseId === 'documented-cycle') {
      expect(game.state.progression.mastery['paragon.s2.protocol-binding']).toBe(0);
      expect(current.bindCheck!.tier).toBe('SUCCESS'); // actual use precedes successful completion/mastery award
    }
    expect(view(game.state).actions.find(a => a.command.type === 'BIND_PLATE' && 'caseId' in a.command && a.command.caseId === caseId)?.enabled).not.toBe(true);
    expect(screen.getByRole('region', { name: '本次原片与实际工序' }).textContent).toContain(`${current.bindCheck!.roll}/${current.bindCheck!.chance}`);
    assertSavedEnvelope(game, before, captured.lastIntent); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it.each([
    { type: 'BUY_PLATE', caseId: 'documented-cycle' },
    { type: 'PLACE_STOP_BAR', caseId: 'blocked-cycle' },
  ] as const)('reviews and double-click confirms actual $type with no invented input', async command => {
    const captured = naturalCommandBoundary(command), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    await mountGame(game); const trigger = await commandControl(game.state, command);
    await userEvent.click(trigger); let review = screen.getByRole('dialog', { name: '确认本次实际消耗与风险' });
    if (command.type === 'PLACE_STOP_BAR') expect(review.textContent).toContain('真实受阻并损失原架5耐久');
    else expect(review.textContent).toContain('60');
    await userEvent.click(within(review).getByRole('button', { name: '取消，返回查看' }));
    expect(game.submit).not.toHaveBeenCalled(); expect(game.state).toEqual(before);
    await userEvent.click(trigger); review = screen.getByRole('dialog', { name: '确认本次实际消耗与风险' });
    const confirm = within(review).getByRole('button', { name: '确认执行这一次操作' });
    fireEvent.click(confirm); fireEvent.click(confirm); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final)); assertSavedEnvelope(game, before, captured.lastIntent);
    if (command.type === 'BUY_PLATE') {
      expect(game.state.cash).toBe(before.cash - 60);
      expect(view(game.state).life.currentAttempt!.plate).toMatchObject({ id: 'KM2-PLATE-1-1', status: 'BLANK', paidPennies: 60 });
    } else {
      expect(view(game.state).life.currentAttempt!.stopBar).toMatchObject({ id: 'KM2-STOP-BAR', location: 'ROUTE', placed: true, triggered: false });
      expect(game.state.alchemist.life.creations).toEqual(before.alchemist.life.creations); // damage requires the later actual blocked step
    }
    assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('shows PROGRAM and PARCEL as separate current answers and submits only the missing original permission', async () => {
    const captured = boundary('vera-current-consents'), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    expect(captured.lastIntent).toEqual({ type: 'KNOWLEDGE_MENTOR', command: { type: 'CONSENT', caseId: 'consented-transfer', permission: 'PARCEL' } });
    expect(view(before).life.currentAttempt).toMatchObject({ programPermission: 'GRANTED', parcelPermission: 'UNASKED' });
    await mountGame(game);
    const permissions = screen.getByRole('region', { name: '维拉两份独立当前许可' });
    expect(permissions.textContent).toContain('PROGRAM · 本次程序许可当前明确同意');
    expect(permissions.textContent).toContain('PARCEL · 本次原包裹交接许可尚未询问');
    expect(permissions.textContent).toContain('旧海伦娜与内尔的许可不沿用');
    await clickCommand(game, capturedCommand(captured));
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(view(game.state).life.currentAttempt).toMatchObject({ programPermission: 'GRANTED', parcelPermission: 'GRANTED' });
    expect(game.state.actionsRemaining).toBe(before.actionsRemaining); expect(game.state.spirituality).toBe(before.spirituality);
    assertSavedEnvelope(game, before, captured.lastIntent); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it.each(['PROGRAM', 'PARCEL'] as const)('keeps the other permission after an explicit separate %s withdrawal branch and cannot silently re-consent', async permission => {
    // Deliberate UI branch from a genuine save, not the natural branch outcome.
    const game = savedGame(boundary('vera-current-consents').final), before = structuredClone(game.state);
    await mountGame(game); await clickCommand(game, { type: 'REVOKE_CONSENT', caseId: 'consented-transfer', permission });
    const current = view(game.state).life.currentAttempt!;
    expect(current.programPermission).toBe(permission === 'PROGRAM' ? 'WITHDRAWN' : 'GRANTED');
    expect(current.parcelPermission).toBe(permission === 'PARCEL' ? 'WITHDRAWN' : 'GRANTED');
    expect(actionButton(game.state, { type: 'CONSENT', caseId: 'consented-transfer', permission }).disabled).toBe(true);
    expect(game.state.cash).toBe(before.cash); expect(game.state.spirituality).toBe(before.spirituality);
    expect(game.state.alchemist.life.creations).toEqual(before.alchemist.life.creations);
    assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('keeps the actual second binding failure, then displays ordinary completion without a false ability mastery reward', async () => {
    const failed = boundary('consented-transfer-binding-outcome'), game = savedGame(failed.final), before = structuredClone(game.state);
    const a = view(before).life.currentAttempt!;
    expect(a.bindCheck?.tier).toBe('FAILURE'); expect(a.runCheck).toBeNull();
    expect(a.plate?.status).toBe('FAILED'); expect(a.paidPennies).toBe(60); expect(a.spiritualitySpent).toBe(4);
    await mountGame(game);
    expect(actionButton(game.state, { type: 'BIND_PLATE', caseId: 'consented-transfer' }).disabled).toBe(true);
    expect(actionButton(game.state, { type: 'START_PROGRAM', caseId: 'consented-transfer' }).disabled).toBe(true);
    expect(screen.getByRole('region', { name: '本次原片与实际工序' }).textContent).toContain('绑定：失败');
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    // Inspect a later real captured result; no synthetic success or fixture patch.
    const closed = migrateSliceState(boundary('consented-transfer-closed').final);
    const completed = view(closed).life.cases.find(c => c.id === 'consented-transfer')!.attempts.at(-1)!;
    expect(completed).toMatchObject({ result: 'ORDINARY', completedSteps: 3, automaticSteps: 0, verified: true, closed: true, originalsReturned: true });
    expect(completed.parcel.returned).toBe(true); expect(completed.plate!.id).toBe(a.plate!.id);
    expect(completed.plate!.location).toBe('RECYCLE');
    expect(closed.progression.mastery).toEqual(before.progression.mastery);
  }, 20_000);

  it.each(['STOP_PROGRAM', 'WAIT_PROGRAM'] as const)('uses the public %s command without refund, teleportation, automatic return or page-clock effects', async type => {
    // Separate branches from the actual successful first program, not natural claims.
    const game = savedGame(boundary('documented-cycle-program-outcome').final), before = structuredClone(game.state), prior = view(before).life.currentAttempt!;
    expect(prior.programActive).toBe(true); expect(prior.programRemainingSeconds).toBe(45);
    await mountGame(game); const afterMount = structuredClone(game.state);
    fireEvent.focus(screen.getByRole('heading', { name: view(before).title }));
    expect(game.state).toEqual(afterMount); expect(game.submit).not.toHaveBeenCalled();
    await clickCommand(game, { type, caseId: 'documented-cycle' });
    const current = view(game.state).life.currentAttempt!;
    expect(current.programActive).toBe(false); expect(current.programRemainingSeconds).toBe(0);
    expect(current.programEnd).toBe(type === 'STOP_PROGRAM' ? 'STOPPED' : 'EXPIRED');
    expect(current.elapsedSeconds).toBe(prior.elapsedSeconds + (type === 'WAIT_PROGRAM' ? 45 : 0));
    expect(current.originalsReturned).toBe(false); expect(current.ownerNode).toBe(prior.ownerNode);
    expect(current.plate).toEqual(prior.plate); expect(current.parcel).toEqual(prior.parcel);
    expect(game.state.alchemist.life.creations).toEqual(before.alchemist.life.creations);
    expect(game.state.spirituality).toBe(before.spirituality); expect(game.state.cash).toBe(before.cash);
    expect(actionButton(game.state, { type: 'CLOSE', caseId: 'documented-cycle' }).disabled).toBe(true);
    expect(actionButton(game.state, { type: 'MANUAL_STEP', caseId: 'documented-cycle' }).disabled).toBe(false);
    expect(screen.queryByRole('button', { name: '关闭知识导师页面' })).toBeNull();
    assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('physically returns the exact borrowed parcel even after a separate PARCEL withdrawal, without treating delivery as return', async () => {
    const captured = boundary('vera-same-parcel-returned'), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    const prior = view(before).life.currentAttempt!;
    expect(prior.parcel).toMatchObject({ id: 'KM2-VERA-PARCEL', owner: 'KM2-VERA', holder: 'PLAYER', delivered: true, returned: false });
    await mountGame(game);
    expect(screen.getByRole('region', { name: '维拉两份独立当前许可' }).textContent).toContain('送达不等于归还');
    await clickCommand(game, { type: 'REVOKE_CONSENT', caseId: 'consented-transfer', permission: 'PARCEL' });
    expect(view(game.state).life.currentAttempt!.parcel).toEqual(prior.parcel);
    expect(actionButton(game.state, { type: 'CLOSE', caseId: 'consented-transfer' }).disabled).toBe(true);
    await clickCommand(game, { type: 'RETURN_PARCEL', caseId: 'consented-transfer' });
    expect(view(game.state).life.currentAttempt!.parcel).toMatchObject({ id: 'KM2-VERA-PARCEL', holder: 'KM2-VERA', location: 'OWNER', returned: true });
    expect(game.state.alchemist.life.creations).toEqual(before.alchemist.life.creations);
    expect(view(game.state).life.currentAttempt!.originalsReturned).toBe(false);
    expect(game.state.cash).toBe(before.cash); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('submits the actual same-parcel return and closed third-case boundary without skipping original cleanup', async () => {
    const captured = boundary('vera-same-parcel-returned'), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    await mountGame(game); await clickCommand(game, capturedCommand(captured));
    expect(game.state).toEqual(migrateSliceState(captured.final)); assertSavedEnvelope(game, before, captured.lastIntent);
    const blocked = migrateSliceState(boundary('blocked-cycle-closed').final), a = view(blocked).life.cases.find(c => c.id === 'blocked-cycle')!.attempts.at(-1)!;
    expect(a).toMatchObject({ frameDurabilityLost: 5, calibrationSucceeded: true, originalsReturned: true, closed: true });
    expect(a.stopBar).toMatchObject({ id: 'KM2-STOP-BAR', location: 'RACK', loadRunning: false, triggered: true, cleared: true });
    expect(a.plate?.location).toBe('RECYCLE');
    for (const original of blocked.alchemist.life.creations) expect(original).toMatchObject({ location: 'PLAYER', active: false });
    assertLegacyPreserved(before, blocked);
  }, 20_000);

  it.each(['blocked-cycle-calibration-outcome', 'paid-recharge-al4-frame-1', 'combat-plate-attempt-1', 'combat-plate-attempt-2', 'combat-plate-attempt-3'])('confirms the actual paid %s only once, retaining failed materials and durability', async name => {
    const captured = boundary(name), game = savedGame(captured.beforeLast), before = structuredClone(game.state), command = capturedCommand(captured);
    await mountGame(game); const trigger = await commandControl(game.state, command); await userEvent.click(trigger);
    let review = screen.getByRole('dialog', { name: '确认本次实际消耗与风险' });
    await userEvent.click(within(review).getByRole('button', { name: '取消，返回查看' }));
    expect(game.submit).not.toHaveBeenCalled(); expect(game.state).toEqual(before);
    await userEvent.click(trigger); review = screen.getByRole('dialog', { name: '确认本次实际消耗与风险' });
    const confirm = within(review).getByRole('button', { name: '确认执行这一次操作' });
    fireEvent.click(confirm); fireEvent.click(confirm); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final)); assertSavedEnvelope(game, before, captured.lastIntent);
    if (command.type === 'RECHARGE') {
      const original = game.state.alchemist.life.creations.find(o => o.id === command.objectId)!;
      expect(original.charge).toBe(3); expect(original.durability).toBe(before.alchemist.life.creations.find(o => o.id === command.objectId)!.durability);
      expect(game.state.knowledgeMentor.life.recharges.at(-1)).toMatchObject({ paidPennies: 40, spiritualitySpent: 3, actionsSpent: 1 });
    }
    if (command.type === 'PREPARE_COMBAT_PLATE') {
      const plate = game.state.knowledgeMentor.life.combatPlates.at(-1)!;
      expect(plate).toMatchObject({ paidPennies: 60, spiritualitySpent: 4, actionsSpent: 1 });
      expect(plate.status).toBe(name.endsWith('-1') ? 'READY' : 'FAILED');
      expect(plate.location).toBe(name.endsWith('-1') ? 'PLAYER' : 'RECYCLE');
      if (name.endsWith('-3')) expect(actionButton(game.state, command).disabled).toBe(true);
    }
    assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('returns actual practiced ordinary life with closed consent and no free plate, repair or inherited revival', async () => {
    const game = savedGame(naturalEntry('practiced')), before = structuredClone(game.state);
    expect(before.knowledgeMentor.life.combatPlates).toEqual([]); expect(before.progression.acting).toBe(100);
    expect(view(before).life.cases.map(c => c.attempts.at(-1)!.result)).toEqual(['ABILITY', 'ORDINARY', 'ABILITY']);
    await mountGame(game); await userEvent.selectOptions(screen.getByRole('combobox', { name: '选择知识导师生活情境' }), 'consented-transfer');
    expect(screen.getByRole('region', { name: '维拉两份独立当前许可' }).textContent).toContain('当前无生效许可，旧记录不延续');
    expect(screen.getByRole('region', { name: PANEL }).textContent).toContain('掌握0不表示从未尝试，也不否认已付成本');
    await userEvent.click(screen.getByRole('button', { name: '关闭知识导师页面' }));
    expect(screen.getByRole('button', { name: /^工作，1行动/ })).toBeTruthy();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);
});
