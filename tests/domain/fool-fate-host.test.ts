import { describe, expect, it } from 'vitest';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { fateOriginalsDigest } from '../../src/domain/fool/fate.js';
import {
  blockFoolFateHostCommand, buildFoolFateRegistry, createFoolFateHostState, evaluateFoolFateRitual,
  projectFoolFateHost, transitionFoolFateHost, validateFoolFateHost,
  type FoolFateHostAuthority, type FoolFateHostCommand, type FoolFateHostContext,
  type FoolFateHostReceipt, type FoolFateOrigin,
} from '../../src/domain/fool/fate-host.js';
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
type WithoutId<T> = T extends { id: string } ? Omit<T, 'id'> : never;
function fixture() {
  const origin: FoolFateOrigin = { runId: 'run-1868', actorId: 'original-player', worldSourceSecond: 0, worldSourceReceipt: 'authored-high-order-occurrence', inheritedTerminalReceipt: 'actual-1868-terminal', independentUniquenessCustodyReceipt: 'independent-safe-custody' };
  const history = new Map<string, FoolFateHostReceipt>();
  const authority: FoolFateHostAuthority = { origin, committedReceiptCount: 0, originIsAuthentic: o => JSON.stringify(o) === JSON.stringify(origin), receiptIsAuthentic: r => JSON.stringify(history.get(r.context.receiptId)) === JSON.stringify(r) };
  let state = createFoolFateHostState(authority), serial = 0, at = 604800, week = 15971;
  let bodyHealth = { actor: 100, crew: Object.fromEntries(state.registry.commissions.flatMap(i => i.crew).map(c => [c.id, 100])) };
  let cash = 200, actions = 20, spirituality = 40, mental = 30;
  let access: FoolFateHostContext['access'] = 'CANAL_APPROACH';
  const context = (changes: Partial<FoolFateHostContext> = {}): FoolFateHostContext => ({ receiptId: `host-receipt-${++serial}`, ledgerRevision: `central-ledger-${serial}`, expectedRevision: state.receipts.length, at, week, actorId: origin.actorId, actorAlive: bodyHealth.actor > 0, actorConscious: bodyHealth.actor > 0, bodyHealth: clone(bodyHealth), actionPoints: actions, spirituality, mental, pennies: cash, access, otherComplexGraftActive: false, worldFacts: [], ...changes });
  const perform = (input: WithoutId<FoolFateHostCommand>, changes: Partial<FoolFateHostContext> = {}) => {
    const c = context(changes), command = { ...input, id: `host-command-${serial}` } as FoolFateHostCommand;
    if (command.type === 'CASE' && command.action.type === 'GRAFT' && !c.check) c.check = { id: `check-${serial}`, result: resolveNormalCheck({ ability: 'knowledge', baseAbility: 20, difficulty: 20, modifiers: [], roll: 10 }), rngBeforeRef: `before-${serial}`, rngAfterRef: `after-${serial}` };
    history.set(c.receiptId, clone({ command, context: c }));
    const result = transitionFoolFateHost(state, command, c, authority);
    if (result.ok) {
      bodyHealth = clone(c.bodyHealth);
      for (const consequence of result.consequences) {
        if (consequence.subjectId === origin.actorId) bodyHealth.actor = consequence.healthAfter;
        else bodyHealth.crew[consequence.subjectId] = consequence.healthAfter;
      }
      if (c.mental - result.cost.mental === 0) bodyHealth.actor = 0;
      state = result.state; authority.committedReceiptCount = state.receipts.length; at = state.now; week = c.week; cash = c.pennies - result.cost.pennies; actions = c.actionPoints - result.cost.actionPoints; spirituality = c.spirituality - result.cost.spirituality; mental = c.mental - result.cost.mental; if (result.enteredCaseId) access = 'AT_CURRENT_CASE'; }
    return { ...result, context: c, command };
  };
  const current = () => state.cases[state.currentCaseId!]!.state;
  const buy = (kind: 'INSPECTION' | 'PREPARATION') => { const item = state.inventory.find(i => i.commissionId === current().instance.initial.commissionId && i.kind === kind && i.holder === 'MERCHANT')!; expect(perform({ type: 'BUY_KIT', itemId: item.id }).ok).toBe(true); return item.id; };
  const prepared = () => {
    expect(perform({ type: 'ENTER_FIRST_CASE' }).ok).toBe(true);
    const probe = buy('INSPECTION'), prep = buy('PREPARATION');
    expect(perform({ type: 'CASE', action: { type: 'INSPECT_CONSTRAINT', branch: 'SHIELD_MAIN', kitId: probe } }).ok).toBe(true);
    expect(perform({ type: 'CASE', action: { type: 'PREPARE_ENDPOINTS', kitId: prep } }).ok).toBe(true);
    expect(perform({ type: 'CASE', action: { type: 'TRANSIT', route: 'MAIN' } }).ok).toBe(true);
  };
  return { origin, authority, history, perform, context, current, buy, prepared, get state() { return state; }, get at() { return at; }, get cash() { return cash; } };
}

describe('F208 narrow central-host adapter candidate', () => {
  it('requires original central health, resolves death before movement, and never returns the injury twice', () => {
    const h = fixture(); h.prepared();
    h.perform({ type: 'CASE', action: { type: 'WAIT', seconds: h.current().scene.thirdBellAt! - 10 - h.at } });
    const result = h.perform({ type: 'CASE', action: { type: 'WITHDRAW' } }, { bodyHealth: { ...h.context().bodyHealth, actor: 35 } });
    expect(result.ok).toBe(true); expect(h.current().scene.actorAlive).toBe(false);
    expect(h.current().scene.actorPlace).toBe('GATE');
    expect(result.consequences.find(c => c.subjectId === h.origin.actorId)).toMatchObject({ healthBefore: 35, healthAfter: 0, died: true });
    const later = h.perform({ type: 'SYNC_WORLD' }, { at: h.at + 604800 });
    expect(later.ok).toBe(true); expect(later.consequences).toEqual([]);
    expect(validateFoolFateHost(h.state, h.authority).valid).toBe(true);
    expect(evaluateFoolFateRitual(h.state, h.authority)).toBeNull();
  });

  it('rejects omitted or altered body health even when every other field is unchanged', () => {
    const h = fixture();
    expect(h.perform({ type: 'ENTER_FIRST_CASE' }, { bodyHealth: undefined as unknown as FoolFateHostContext['bodyHealth'] }).ok).toBe(false);
    h.perform({ type: 'ENTER_FIRST_CASE' });
    const changed = clone(h.state); changed.receipts[0]!.context.bodyHealth.actor = 1;
    expect(validateFoolFateHost(changed, h.authority).valid).toBe(false);
  });

  it('constructs exactly three fixed independent originals from a trusted nonnegative source anchor', () => {
    const h = fixture(), registry = buildFoolFateRegistry(h.origin);
    expect(registry.commissions).toHaveLength(3); expect(registry.registeredAt).toBe(120);
    expect(registry.commissions.map(i => i.binding.createdAt)).toEqual([10, 20, 30]);
    expect(new Set(registry.commissions.map(i => i.originals.crateId)).size).toBe(3);
    expect(h.state.inventory).toHaveLength(12); expect(h.state.inventory.every(i => i.holder === 'MERCHANT')).toBe(true);
  });

  it('walks twenty real seconds from the verified base approach before first entry', () => {
    const h = fixture(); expect(h.perform({ type: 'ENTER_FIRST_CASE' }, { access: 'ELSEWHERE' }).ok).toBe(false);
    const r = h.perform({ type: 'ENTER_FIRST_CASE' });
    expect(r.elapsedSeconds).toBe(20); expect(h.at).toBe(604820); expect(r.positions?.actor).toBe('BERTH');
    expect(h.current().scene.thirdBellAt).toBeNull(); expect(h.current().scene.departureAt).toBeNull();
  });

  it('buys actual stock, debits cash once, then consumes those same item IDs during preparation', () => {
    const h = fixture(); h.prepared();
    expect(h.cash).toBe(184);
    const consumed = h.state.inventory.filter(i => i.holder === 'CONSUMED'); expect(consumed).toHaveLength(2);
    expect(consumed.every(i => i.purchasedByReceipt && i.consumedByReceipt)).toBe(true);
    expect(h.perform({ type: 'BUY_KIT', itemId: consumed[0]!.id }).ok).toBe(false);
    expect(validateFoolFateHost(h.state, h.authority).valid).toBe(true);
  });

  it('runs the standard check and preserves all original resources through the complete case', () => {
    const h = fixture(); h.prepared();
    for (const crew of h.current().scene.crew) expect(h.perform({ type: 'CASE', action: { type: 'RESCUE', crewId: crew.id } }).ok).toBe(true);
    const activeAt = h.current().scene.departureAt! + 150;
    h.perform({ type: 'CASE', action: { type: 'WAIT', seconds: activeAt - h.at } });
    const cast = h.perform({ type: 'CASE', action: { type: 'GRAFT' } }); expect(cast.cost).toMatchObject({ spirituality: 8, mental: 2, actionPoints: 1 });
    h.perform({ type: 'CASE', action: { type: 'WAIT', seconds: h.current().scene.thirdBellAt! - h.at } });
    h.perform({ type: 'CASE', action: { type: 'ARRIVE_AND_VERIFY' } });
    const view = projectFoolFateHost(h.state, h.context(), h.authority);
    expect(view.currentCase?.evaluation?.verdict).toBe('VERIFIED_DEVIATION');
    const proof = evaluateFoolFateRitual(h.state, h.authority);
    expect(proof).toMatchObject({ caseId: h.state.currentCaseId, verdict: 'VERIFIED_DEVIATION' });
    expect(proof!.evidence.length).toBeGreaterThan(10);
    const tampered = clone(h.state); tampered.cases[tampered.currentCaseId!]!.state.scene.everDamaged = true;
    expect(evaluateFoolFateRitual(tampered, h.authority)).toBeNull();
    expect(evaluateFoolFateRitual(h.state, { ...h.authority, receiptIsAuthentic: () => false })).toBeNull();
    expect(view.returnToBase).toEqual({ from: 'DOCK', seconds: 20 });
    expect(validateFoolFateHost(h.state, h.authority).valid).toBe(true);
  });

  it('preflight never requires or generates a random result', () => {
    const h = fixture(); h.prepared(); h.perform({ type: 'CASE', action: { type: 'WAIT', seconds: h.current().scene.departureAt! + 150 - h.at } });
    const c = h.context(), command: FoolFateHostCommand = { id: 'preview-cast', type: 'CASE', action: { type: 'GRAFT' } };
    expect(c.check).toBeUndefined(); const bytes = JSON.stringify(h.state);
    expect(blockFoolFateHostCommand(h.state, command, c, h.authority)).toBeNull();
    expect(JSON.stringify(h.state)).toBe(bytes);
  });

  it('requires world synchronization first so blocked player commands cannot roll back elapsed disaster', () => {
    const h = fixture(); h.prepared(); const afterBell = h.current().scene.thirdBellAt! + 10;
    expect(h.perform({ type: 'CASE', action: { type: 'GRAFT' } }, { at: afterBell }).blockedReason).toBe('SYNC_WORLD_BEFORE_PLAYER_ACTION');
    const sync = h.perform({ type: 'SYNC_WORLD' }, { at: afterBell });
    expect(sync.ok).toBe(true); expect(sync.elapsedSeconds).toBe(0); expect(sync.caughtUpSeconds).toBeGreaterThan(0);
    expect(h.current().scene.everDamaged).toBe(true);
    expect(h.perform({ type: 'CASE', action: { type: 'GRAFT' } }).ok).toBe(false);
    expect(h.current().scene.everDamaged).toBe(true);
  });

  it('handles years of real predeparture time in one host-only synchronization without starting the bell', () => {
    const h = fixture(); h.perform({ type: 'ENTER_FIRST_CASE' });
    const sync = h.perform({ type: 'SYNC_WORLD' }, { at: 10 * 365 * 86400, week: 16491 });
    expect(sync.ok).toBe(true); expect(sync.elapsedSeconds).toBe(0); expect(h.current().scene.thirdBellAt).toBeNull();
  });

  it('refuses a forged registry, free inventory, altered receipt and truncated central history', () => {
    const h = fixture(); h.prepared();
    const registry = clone(h.state); registry.registry.commissions[0]!.originals.crateId = 'replacement';
    expect(validateFoolFateHost(registry, h.authority).valid).toBe(false);
    const inventory = clone(h.state); inventory.inventory[0]!.holder = 'PLAYER';
    expect(validateFoolFateHost(inventory, h.authority).valid).toBe(false);
    const altered = clone(h.state); altered.receipts[0]!.context.pennies += 1;
    expect(validateFoolFateHost(altered, h.authority).valid).toBe(false);
    const truncated = clone(h.state); truncated.receipts = [];
    expect(validateFoolFateHost(truncated, h.authority).valid).toBe(false);
    expect(() => createFoolFateHostState(h.authority)).toThrow('ALREADY_HAS_COMMITTED_HISTORY');
  });

  it('recovery charges eighteen pennies, checks next week, creates only the preexisting second case and retains old damage', () => {
    const h = fixture(); h.prepared(); h.perform({ type: 'CASE', action: { type: 'WITHDRAW' } });
    const oldId = h.state.currentCaseId!, old = JSON.stringify(h.current());
    const paid = h.perform({ type: 'INVESTIGATE_RECOVERY', commissionId: 'F208-COMMISSION-2' }); expect(paid.cost.pennies).toBe(18);
    expect(h.perform({ type: 'VERIFY_RECOVERY', commissionId: 'F208-COMMISSION-2' }).ok).toBe(false);
    const target = h.state.registry.commissions[1]!, at = h.at + 604800;
    const verified = h.perform({ type: 'VERIFY_RECOVERY', commissionId: 'F208-COMMISSION-2' }, { at, week: 15972, recoveryChecks: { registerReceipt: target.originals.commercialRegisterReceipt, boatContinuityReceipt: target.originals.boatContinuityReceipt, crateContinuityReceipt: target.originals.crateContinuityReceipt, originReceipt: target.binding.originReceipt, originalsDigest: fateOriginalsDigest(target), inspectedAt: at + 60 } });
    expect(verified.ok).toBe(true); expect(verified.elapsedSeconds).toBe(60);
    expect(h.state.currentCaseId).toBe(target.instanceId); expect(h.current().scene.thirdBellAt).toBeNull();
    expect(JSON.stringify(h.state.cases[oldId]!.state)).toBe(old); expect(h.state.cases[oldId]!.state.scene.everDamaged).toBe(true);
    expect(validateFoolFateHost(h.state, h.authority).valid).toBe(true);
  });

  it('merges purchase and scene actions into one small public set without private evidence or rolls', () => {
    const h = fixture(); h.perform({ type: 'ENTER_FIRST_CASE' });
    const view = projectFoolFateHost(h.state, h.context(), h.authority), text = JSON.stringify(view);
    expect(view.actions.length).toBeLessThanOrEqual(3); expect(view.actions.filter(a => a.recommended)).toHaveLength(1);
    expect(view.actions[0]?.command.type).toBe('BUY_KIT'); expect(view.currentCase?.actions).toHaveLength(0);
    for (const secret of ['worldSourceReceipt', 'originReceipt', 'rngBeforeRef', 'rngAfterRef', 'roll', 'pursuitTable', 'registry']) expect(text).not.toContain(`"${secret}"`);
  });
});
