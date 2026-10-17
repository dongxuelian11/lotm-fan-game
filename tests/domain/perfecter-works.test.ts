import { describe, expect, it } from 'vitest';
import { advancePerfecterWorks, applyPerfecterWorks, createPerfecterWorks, derivePerfecterWorksWindow,
  getPerfecterWorksActions, perfecterWorksBlock, perfecterWorksChallenge, projectPerfecterWorks,
  validatePerfecterWorksCommand, validatePerfecterWorksState } from '../../src/domain/perfecter/works.js';
import { PERFECTER_WORKS_STATIONS } from '../../src/domain/perfecter/works-content.js';
import { perfecterWorksRunner } from '../helpers/perfecter-works.js';
describe('Perfecter finite three-station civic repair', () => {
  it('starts three independently owned damaged apparatus, adult operators and finite stocks', () => {
    const s = createPerfecterWorks('finite-civic-works', 188);
    expect(validatePerfecterWorksState(s)).toBe(true); expect(s.startWeek).toBe(188);
    expect(s.stations).toHaveLength(3); expect(s.stations.map(st => st.durability)).toEqual([42, 48, 38]);
    expect(s.stations.every(st => st.owner === 'MUNICIPAL' && st.supplierStock === 6 && st.partsStock === 0 && st.serviceStock === 3)).toBe(true);
    expect(PERFECTER_WORKS_STATIONS.every(st => st.operatorAge > 18)).toBe(true);
    expect(s.stations.map(st => st.apparatusId)).not.toContain('AL4-BOX-1');
    expect(s.stations.map(st => st.apparatusId)).not.toContain('AL4-FRAME-1');
    expect(s.epilogueOrigin.flow.status).toBe('ISOLATED_PENDING');
  });
  it('requires actual repair order and paid finite parts, with no random reroll', () => {
    const r = perfecterWorksRunner();
    expect(perfecterWorksBlock(r.state, { type: 'WORKS_TRIAL', stationId: 'ARCHIVE' }, r.host)).not.toBeNull();
    r.step({ type: 'WORKS_INSPECT', stationId: 'ARCHIVE' });
    const before = structuredClone(r.state), poor = { ...r.host, cash: 8 };
    expect(() => applyPerfecterWorks(r.state, { type: 'WORKS_BUY_PARTS', stationId: 'ARCHIVE' }, poor)).toThrow('9');
    expect(r.state).toEqual(before);
    r.step({ type: 'WORKS_BUY_PARTS', stationId: 'ARCHIVE' });
    r.step({ type: 'WORKS_REPAIR', stationId: 'ARCHIVE' });
    expect(r.state.stations[0]).toMatchObject({ supplierStock: 3, purchasedParts: 3, partsStock: 1, installedParts: 2, durability: 92 });
    expect(perfecterWorksChallenge(r.state, { type: 'WORKS_CALIBRATE', stationId: 'ARCHIVE' })).toBeNull();
  });
  it('lets independent operators produce dated physical service results before verification', () => {
    const r = perfecterWorksRunner();
    for (const type of ['WORKS_INSPECT', 'WORKS_BUY_PARTS', 'WORKS_REPAIR', 'WORKS_CALIBRATE', 'WORKS_TRIAL'] as const) r.step({ type, stationId: 'ARCHIVE' });
    const trialWeek = r.state.stations[0]!.trialWeek!;
    expect(r.state.stations[0]!.operations).toHaveLength(1);
    expect(perfecterWorksBlock(r.state, { type: 'WORKS_VERIFY', stationId: 'ARCHIVE' }, { ...r.host, actions: 3 })).toContain(`第${trialWeek + 2}周`);
    r.wait(trialWeek + 1); expect(r.state.stations[0]!.operations).toHaveLength(2);
    r.wait(trialWeek + 2);
    expect(r.state.stations[0]).toMatchObject({ verifiedWeek: null, serviceStock: 0, durability: 92 });
    expect(r.state.stations[0]!.operations.map(op => op.week)).toEqual([trialWeek, trialWeek + 1, trialWeek + 2]);
    expect(new Set(r.state.stations[0]!.operations.flatMap(op => op.residents)).size).toBe(6);
    const operations = structuredClone(r.state.stations[0]!.operations);
    r.step({ type: 'WORKS_VERIFY', stationId: 'ARCHIVE' }); expect(r.state.stations[0]!.operations).toEqual(operations);
    expect(derivePerfecterWorksWindow(r.state, r.host)).toBeNull();
  });
  it('qualifies only all three actual results and preserves durable proof without quarterly lottery', () => {
    const r = perfecterWorksRunner(); r.complete();
    const proof = derivePerfecterWorksWindow(r.state, r.host);
    expect(proof).not.toBeNull(); expect(proof!.endWeek).toBe(Number.MAX_SAFE_INTEGER);
    expect(r.state.stations.every(st => st.verifiedWeek !== null && st.operations.length === 3)).toBe(true);
    const original = structuredClone(r.state.stations); r.wait(r.host.week + 52);
    expect(r.state.stations).toEqual(original); expect(derivePerfecterWorksWindow(r.state, r.host)).toEqual(proof);
    expect(r.state.epilogueOrigin.apparatus).toMatchObject({ id: 'BC-ARC-17', durability: 92, modelVerified: true, supplierPartsStock: 3 });
  });
  it('rejects forged stock, phantom services, duplicate operators and noncanonical extra input', () => {
    const r = perfecterWorksRunner(); r.complete();
    for (const mutate of [
      (s: typeof r.state) => { s.stations[0]!.partsStock++; },
      (s: typeof r.state) => { s.stations[0]!.operations[0]!.residents.push('invented'); },
      (s: typeof r.state) => { s.stations[0]!.operatorId = s.stations[1]!.operatorId; },
      (s: typeof r.state) => { s.epilogueOrigin.apparatus.durability = 100; },
    ]) { const forged = structuredClone(r.state); mutate(forged); expect(validatePerfecterWorksState(forged)).toBe(false); }
    expect(validatePerfecterWorksCommand({ type: 'WORKS_VERIFY', stationId: 'ARCHIVE', check: { tier: 'SUCCESS' } })).toBe(false);
    const reorder = (v: unknown): unknown => Array.isArray(v) ? v.map(reorder) : v !== null && typeof v === 'object' ? Object.fromEntries(Object.entries(v).reverse().map(([key, value]) => [key, reorder(value)])) : v;
    expect(validatePerfecterWorksState(reorder(r.state))).toBe(true);
  });
  it('does not leak private journal hosts or future rolls through explicit public output', () => {
    const r = perfecterWorksRunner(); r.complete();
    const projected = projectPerfecterWorks(r.state), actions = getPerfecterWorksActions(r.state, r.host);
    expect(Object.keys(projected).sort()).toEqual(['lines', 'nextStep', 'story']);
    expect(JSON.stringify(projected)).not.toMatch(/seed|cursor|beforeDigest|afterDigest|actorId|original-player/);
    expect(actions.find(a => a.command.type === 'WORKS_VERIFY')!.enabled).toBe(false);
    expect(() => advancePerfecterWorks(r.state, r.state.week - 1)).toThrow();
  });
});
