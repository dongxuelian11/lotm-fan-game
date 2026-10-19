/* @vitest-environment jsdom */
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { migrateSliceState } from '../../src/domain/slice/migration';
import {
  CASES, PANEL, boundary, directedBoundary, naturalEntry, capturedCommand, savedGame, mountGame,
  commandControl, actionButton, clickCommand, settled, view,
  assertLegacyPreserved, assertSavedEnvelope, renderBoundaryProjection,
} from './life-giver-ui-fixture';

describe('Life Giver same original body, separate consent and individual paid beads', () => {
  it.each(['tired-guest-real-two-trip-fatigue', 'tired-guest-vitality-outcome', 'withdrawn-consent-actual-stop', 'interrupted-link-actual-obstruction', 'reflection'])('renders actual %s with attempts, effects and paid costs separately', renderBoundaryProjection);

  it.each(CASES)('separately confirms 120 pence for the two distinct %s originals and never implies consent', async caseId => {
    const captured = boundary(`${caseId}-paid-preparation`), game = savedGame(captured.beforeLast), before = structuredClone(game.state), command = capturedCommand(captured);
    await mountGame(game); const trigger = await commandControl(game.state, command); await userEvent.click(trigger);
    let review = screen.getByRole('dialog', { name: '确认本次实际消耗与风险' });
    expect(review.textContent).toContain('120便士取得两粒不同的60便士原珠');
    await userEvent.click(within(review).getByRole('button', { name: '取消，返回查看' }));
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(trigger); review = screen.getByRole('dialog', { name: '确认本次实际消耗与风险' });
    const confirm = within(review).getByRole('button', { name: '确认执行这一次操作' });
    fireEvent.click(confirm); fireEvent.click(confirm); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final)); expect(game.state.cash).toBe(before.cash - 120);
    const beads = game.state.lifeGiver.life.beads.slice(before.lifeGiver.life.beads.length);
    expect(beads).toHaveLength(2); expect(new Set(beads.map(b => b.id)).size).toBe(2);
    for (const bead of beads) expect(bead).toMatchObject({ paidPennies: 60, purpose: 'LIFE', caseId, status: 'READY', location: 'PLAYER' });
    expect(game.state.summoningMaster.life.partner).toEqual(before.summoningMaster.life.partner);
    expect(view(game.state).life.currentAttempt).toBeNull();
    expect(game.state.lifeGiver.life.cases[caseId].attempts).toEqual(before.lifeGiver.life.cases[caseId].attempts);
    expect(screen.queryByRole('button', { name: '关闭创生者页面' })).toBeNull();
    assertSavedEnvelope(game, before, captured.lastIntent); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('shows original-body inspection and separately acquires guest then owner permission', async () => {
    const captured = boundary('tired-guest-current-guest-consent'), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    await mountGame(game);
    const body = screen.getByRole('region', { name: '创生者原来客当前身体' });
    expect(body.textContent).toContain('SM3-LUMEN'); expect(body.textContent).toContain('SM3-LUMEN-BODY');
    expect(body.textContent).toContain(before.summoningMaster.life.partner.chime.id);
    expect(view(before).life.currentAttempt).toMatchObject({ originChecked: true, consent: 'UNASKED', ownerConsent: false });
    await clickCommand(game, capturedCommand(captured));
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(view(game.state).life.currentAttempt).toMatchObject({ consent: 'GRANTED', ownerConsent: false });
    expect(screen.getByRole('region', { name: '米拉本次许可与原借物' }).textContent).toContain('当前没有生效的物主许可');
    await clickCommand(game, { type: 'FETCH_GUEST', caseId: 'tired-guest' });
    await clickCommand(game, { type: 'CONSENT_OWNER', caseId: 'tired-guest' });
    expect(game.state).toEqual(migrateSliceState(boundary('tired-guest-current-owner-consent').final));
    const token = screen.getByRole('region', { name: '米拉本次许可与原借物' });
    for (const text of ['LG2-MIRA41', 'LG2-MIRA-TOKEN', '200克', '当前已明确同意', '旧艾达许可不沿用']) expect(token.textContent).toContain(text);
    expect(view(game.state).life.currentAttempt).toMatchObject({ consent: 'GRANTED', ownerConsent: true });
    assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('keeps the actual two-trip fatigue and consumes one original even when vitality fails', async () => {
    const captured = boundary('tired-guest-vitality-outcome'), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    const prior = view(before).life.currentAttempt!;
    expect(prior.guestTrips).toBe(2); expect(prior.guestStaminaSpent).toBe(16);
    await mountGame(game); await clickCommand(game, capturedCommand(captured));
    expect(game.state).toEqual(migrateSliceState(captured.final));
    const current = view(game.state).life.currentAttempt!;
    expect(current.vitalityTier).not.toBeNull(); expect(current.spiritualitySpent).toBe(prior.spiritualitySpent + 6);
    expect(game.state.spirituality).toBe(before.spirituality - 6);
    const successful = current.vitalityTier === 'SUCCESS' || current.vitalityTier === 'GREAT_SUCCESS';
    expect(current.vitalityRestored).toBe(successful ? Math.min(12, 100 - before.summoningMaster.life.partner.stamina) : 0);
    expect(game.state.summoningMaster.life.partner.stamina).toBe(before.summoningMaster.life.partner.stamina + current.vitalityRestored);
    expect(game.state.summoningMaster.life.partner.health).toBe(before.summoningMaster.life.partner.health);
    expect(game.state.summoningMaster.life.partner.mind).toBe(before.summoningMaster.life.partner.mind);
    const spent = game.state.lifeGiver.life.beads.filter(b => b.caseId === 'tired-guest' && b.status === 'SPENT');
    expect(spent).toHaveLength(1); expect(spent[0]!.abilityId).toBe('moon.s2.bounded-vitality');
    expect(actionButton(game.state, { type: 'VITALITY', caseId: 'tired-guest' }).disabled).toBe(true);
    await userEvent.click(screen.getByText('本情境逐粒原珠与实际去向', { selector: 'summary' }));
    expect(screen.getByRole('region', { name: PANEL }).textContent).toContain(`${spent[0]!.id} · 已耗尽，仍是同一实物`);
    expect(screen.getByRole('region', { name: PANEL }).textContent).toContain('消耗本身不等于成功');
    assertSavedEnvelope(game, before, captured.lastIntent); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('immediately respects revoked guest consent while preserving owner permission and ordinary returns', async () => {
    const captured = boundary('withdrawn-consent-actual-stop'), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    await mountGame(game); await clickCommand(game, capturedCommand(captured));
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(view(game.state).life.currentAttempt).toMatchObject({ consent: 'REVOKED', ownerConsent: true, revoked: true });
    for (const type of ['VITALITY', 'SHELTER', 'GUEST_CARRY'] as const) expect(actionButton(game.state, { type, caseId: 'withdrawn-consent' }).disabled).toBe(true);
    expect(screen.getByRole('region', { name: '创生者原来客当前身体' }).textContent).toContain('本次同意已撤回');
    expect(game.state.summoningMaster.life.partner).toEqual(before.summoningMaster.life.partner);
    await clickCommand(game, { type: 'CARRY_TOKEN', caseId: 'withdrawn-consent' });
    expect(game.state).toEqual(migrateSliceState(boundary('withdrawn-consent-ordinary-fallback').final));
    expect(game.state.spirituality).toBe(before.spirituality);
    expect(game.state.summoningMaster.life.partner.stamina).toBe(before.summoningMaster.life.partner.stamina);
    expect(view(game.state).life.currentAttempt).toMatchObject({ ordinaryCompleted: true, vitalityTier: null, shelterTier: null });
    assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('separately revokes owner permission without pretending that the original token was returned', async () => {
    // Explicit branch from a real save, not a claim about the natural route.
    const game = savedGame(boundary('withdrawn-consent-actual-stop').beforeLast), before = structuredClone(game.state);
    await mountGame(game); await clickCommand(game, { type: 'REVOKE_OWNER', caseId: 'withdrawn-consent' });
    expect(view(game.state).life.currentAttempt).toMatchObject({ consent: 'GRANTED', ownerConsent: false, tokenReturned: false });
    expect(game.state.lifeGiver.life.token).toEqual(before.lifeGiver.life.token);
    expect(actionButton(game.state, { type: 'CLOSE', caseId: 'withdrawn-consent' }).disabled).toBe(true);
    await clickCommand(game, { type: 'RETURN_TOKEN', caseId: 'withdrawn-consent' });
    expect(game.state.lifeGiver.life.token).toMatchObject({ id: 'LG2-MIRA-TOKEN', custodian: 'LG2-MIRA41', location: 'OWNER' });
    expect(view(game.state).life.currentAttempt?.tokenReturned).toBe(true);
    expect(game.state.cash).toBe(before.cash); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('reviews future health−5 separately from opening a window and records the actual obstruction without false effect', async () => {
    const captured = boundary('interrupted-link-shelter-outcome'), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    await mountGame(game); await userEvent.click(await commandControl(game.state, capturedCommand(captured)));
    const review = screen.getByRole('dialog', { name: '确认本次实际消耗与风险' });
    expect(review.textContent).toContain('本人健康实际−5、流灯耗精力8→3');
    expect(review.textContent).toContain('成功只开15秒窗口');
    await userEvent.click(within(review).getByRole('button', { name: '确认执行这一次操作' })); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final)); expect(game.state.health).toBe(before.health);
    expect(game.state.spirituality).toBe(before.spirituality - 4);
    expect(view(game.state).life.currentAttempt?.shelterApplied).toBe(false);
    expect(game.state.progression.mastery['moon.s2.shared-shelter']).toBe(before.progression.mastery['moon.s2.shared-shelter']);
    const afterWindow = structuredClone(game.state);
    fireEvent.focus(screen.getByRole('heading', { name: view(game.state).title }));
    expect(game.state).toEqual(afterWindow); // screen time/focus is not scene time
    await clickCommand(game, { type: 'BLOCK_PATH', caseId: 'interrupted-link' });
    expect(game.state).toEqual(migrateSliceState(boundary('interrupted-link-actual-obstruction').final));
    expect(view(game.state).life.currentAttempt?.shelterStatus).not.toBe('ACTIVE');
    expect(view(game.state).life.currentAttempt?.shelterApplied).toBe(false);
    expect(actionButton(game.state, { type: 'GUEST_CARRY', caseId: 'interrupted-link' }).disabled).toBe(true);
    expect(game.state.health).toBe(before.health); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('applies the explicit directed ordinary-carry branch after the real successful window: actual health−5, guest stamina−3', async () => {
    // This is the lead-recorded alternate public choice, not the natural obstruction route.
    const captured = directedBoundary('actual-shared-load'), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    expect(before).toEqual(migrateSliceState(boundary('interrupted-link-shelter-outcome').final));
    expect(view(before).life.currentAttempt).toMatchObject({ shelterStatus: 'ACTIVE', shelterApplied: false });
    await mountGame(game); await clickCommand(game, capturedCommand(captured));
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(game.state.health).toBe(before.health - 5);
    expect(game.state.summoningMaster.life.partner.stamina).toBe(before.summoningMaster.life.partner.stamina - 3);
    expect(game.state.random).toEqual(before.random);
    expect(view(game.state).life.currentAttempt).toMatchObject({ shelterStatus: 'APPLIED', shelterApplied: true, playerHealthSpent: 5 });
    expect(game.state.progression.mastery['moon.s2.shared-shelter']).toBe(8);
    const panel = screen.getByRole('region', { name: PANEL });
    expect(panel.textContent).toContain('已在真实搬运中应用一次');
    expect(panel.textContent).toContain('本人健康5');
    assertSavedEnvelope(game, before, captured.lastIntent);
    for (const key of ['return_token', 'return_guest', 'return_player', 'return_beads', 'inspect', 'close']) {
      const step = directedBoundary(key);
      await clickCommand(game, capturedCommand(step));
      expect(game.state).toEqual(migrateSliceState(step.final));
    }
    expect(game.state.health).toBe(95); expect(game.state.summoningMaster.life.partner.stamina).toBe(97);
    expect(game.state.summoningMaster.life.partner.location).toBe('HOME');
    expect(game.state.lifeGiver.life.token.location).toBe('OWNER');
    expect(game.state.lifeGiver.life.beads.filter(b => b.caseId === 'interrupted-link').every(b => b.location === 'RETURN_TRAY')).toBe(true);
    assertLegacyPreserved(before, game.state);
  }, 20_000);

  it.each(CASES)('physically returns the same %s body, token and both bead originals before closing', async caseId => {
    const captured = boundary(`${caseId}-same-body-returned`), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    await mountGame(game); expect(screen.queryByRole('button', { name: '关闭创生者页面' })).toBeNull();
    expect(actionButton(game.state, { type: 'CLOSE', caseId }).disabled).toBe(true);
    const token = game.state.lifeGiver.life.token;
    expect(token).toMatchObject({ id: 'LG2-MIRA-TOKEN', location: 'OWNER', custodian: 'LG2-MIRA41' });
    await clickCommand(game, capturedCommand(captured));
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(game.state.summoningMaster.life.partner).toMatchObject({ id: 'SM3-LUMEN', bodyId: 'SM3-LUMEN-BODY', location: 'HOME' });
    expect(game.state.summoningMaster.life.partner.chime).toEqual(before.summoningMaster.life.partner.chime);
    await clickCommand(game, { type: 'RETURN_PLAYER', caseId });
    await clickCommand(game, { type: 'RETURN_BEADS', caseId });
    expect(game.state).toEqual(migrateSliceState(boundary(`${caseId}-same-beads-returned`).final));
    for (const bead of game.state.lifeGiver.life.beads.filter(b => b.caseId === caseId)) expect(bead.location).toBe('RETURN_TRAY');
    await clickCommand(game, { type: 'INSPECT', caseId }); await clickCommand(game, { type: 'CLOSE', caseId });
    expect(game.state).toEqual(migrateSliceState(boundary(`${caseId}-closed`).final));
    expect(game.state.lifeGiver.life.cases[caseId].attempts.at(-1)).toMatchObject({ closed: true, inspected: true, guestReturned: true, tokenReturned: true });
    // Closing a zero-AP scene resumes the real weekly pulse and its ordinary30p living cost.
    expect(game.state.cash).toBe(migrateSliceState(boundary(`${caseId}-closed`).final).cash); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it.each(['paid-battle-bead-1', 'paid-battle-bead-2', 'paid-battle-bead-3'])('confirms actual %s for 60 pence without converting life beads to battle inventory', async name => {
    const captured = boundary(name), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    await mountGame(game); await clickCommand(game, capturedCommand(captured));
    expect(game.state).toEqual(migrateSliceState(captured.final)); expect(game.state.cash).toBe(before.cash - 60);
    expect(game.state.lifeGiver.life.beads.slice(0, -1)).toEqual(before.lifeGiver.life.beads);
    expect(game.state.lifeGiver.life.beads.at(-1)).toMatchObject({ purpose: 'COMBAT', caseId: null, paidPennies: 60, status: 'READY', location: 'PLAYER' });
    assertSavedEnvelope(game, before, captured.lastIntent); assertLegacyPreserved(before, game.state);
  }, 20_000);

  it('closes and reopens only the practiced view without mutating permits, clocks, originals or mastery', async () => {
    const game = savedGame(naturalEntry('practiced')), before = structuredClone(game.state);
    await mountGame(game); await userEvent.selectOptions(screen.getByRole('combobox', { name: '选择创生者生活情境' }), 'withdrawn-consent');
    expect(screen.getByRole('region', { name: '创生者原来客当前身体' }).textContent).toContain('没有生效中的生活许可');
    expect(screen.getByRole('region', { name: '米拉本次许可与原借物' }).textContent).toContain('当前没有生效的物主许可');
    expect(screen.getByRole('region', { name: PANEL }).textContent).toContain('开出窗口、仅尝试过、消耗原珠和掌握0都是不同事实');
    await userEvent.click(screen.getByRole('button', { name: '关闭创生者页面' }));
    expect(screen.getByRole('button', { name: /^工作，1行动/ })).toBeTruthy();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);
});
