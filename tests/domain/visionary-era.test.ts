import { describe, expect, it } from 'vitest';
import {
  advanceVisionaryEra, applyVisionaryEra, createVisionaryEra, deriveVisionaryEraWindow,
  getVisionaryEraActions, projectVisionaryEra, validateVisionaryEraCommand, validateVisionaryEraState,
  visionaryEraBlock, visionaryEraChallenge, VISIONARY_ERA_LOCATIONS,
  type VisionaryEraCommand, type VisionaryEraState,
} from '../../src/domain/visionary/era.js';
import { VISIONARY_ERA_CITIES, VISIONARY_ERA_GOVERNMENTS, VISIONARY_ERA_INCIDENTS } from '../../src/domain/visionary/era-content.js';
import type { VisionaryHost } from '../../src/domain/visionary/ports.js';

function host(): VisionaryHost {
  return { eventId: 'era-1', revision: 660, week: 144, actorId: 'lina-original', location: VISIONARY_ERA_LOCATIONS.BACKLUND, sequence: 1, status: 'ACTIVE', cash: 400, actions: 3, health: 100, mind: 100, spirituality: 120, check: null };
}
function runner() {
  let state = createVisionaryEra('source-659', 144), actor = host(), counter = 1;
  const wait = (week: number) => { state = advanceVisionaryEra(state, week); actor = { ...actor, week, actions: 3 }; };
  const step = (command: VisionaryEraCommand) => {
    if (actor.actions < 1) wait(actor.week + 1);
    const result = applyVisionaryEra(state, command, actor); state = result.state;
    actor = { ...actor, cash: actor.cash - result.effect.cashCost + result.effect.cashGain, actions: result.effect.weeks ? 3 : actor.actions - result.effect.actions, week: actor.week + result.effect.weeks, location: result.effect.toLocation ?? actor.location, revision: actor.revision + 1, eventId: `era-${++counter}` };
    return result;
  };
  const travel = (cityId: typeof VISIONARY_ERA_CITIES[number]['id']) => { if (actor.location !== VISIONARY_ERA_LOCATIONS[cityId]) step({ type: 'ERA_TRAVEL', cityId }); };
  const survey = () => { for (const city of VISIONARY_ERA_CITIES) { travel(city.id); step({ type: 'ERA_SURVEY', cityId: city.id }); } travel('BACKLUND'); };
  const connect = () => {
    const adopted = new Set<string>();
    for (const city of VISIONARY_ERA_CITIES) {
      travel(city.id); step({ type: 'ERA_PILOT', cityId: city.id }); step({ type: 'ERA_CONNECT', cityId: city.id });
      if (!adopted.has(city.governmentId)) { step({ type: 'ERA_ADOPT', governmentId: city.governmentId }); adopted.add(city.governmentId); }
    }
    travel('BACKLUND');
  };
  const prepare = () => { survey(); step({ type: 'ERA_FORECAST', plan: 'PUBLIC_RELAY' }); connect(); };
  const resolveQuarter = (index: number) => {
    for (const definition of VISIONARY_ERA_INCIDENTS.filter(incident => incident.node === index)) {
      const incident = state.incidents.find(item => item.id === definition.id)!;
      wait(incident.releaseWeek); step({ type: 'ERA_RESPOND', incidentId: incident.id, mode: 'COORDINATED' });
    }
    wait(state.nodes[index]!.startWeek); step({ type: 'ERA_VERIFY', nodeId: state.nodes[index]!.id });
  };
  return { get state() { return state; }, get actor() { return actor; }, wait, step, travel, survey, connect, prepare, resolveQuarter };
}

describe('Visionary finite original era institutions', () => {
  it('creates four governments, six original stations and four fixed quarterly opportunities without a player grant', () => {
    const state = createVisionaryEra('source-659', 144);
    expect(validateVisionaryEraState(state)).toBe(true);
    expect(state.governments).toHaveLength(4); expect(state.cities).toHaveLength(6);
    expect(state.nodes.map(node => node.startWeek)).toEqual([183, 196, 209, 222]);
    expect(state.incidents).toHaveLength(8); expect(state.journal).toEqual([]);
    expect(state.epilogueOrigin.rescuers.every(person => person.age > 18)).toBe(true);
    expect(state.epilogueOrigin.patients.every(person => person.age > 18)).toBe(true);
    expect(state.epilogueOrigin.id).toBe('tingen:west-relay-fault');
  });
  it('strictly rejects host fields, unknown commands, extra keys and foreign identifiers in public commands', () => {
    expect(validateVisionaryEraCommand({ type: 'ERA_FORECAST', plan: 'PUBLIC_RELAY' })).toBe(true);
    for (const command of [null, [], { type: 'ERA_TRAVEL', cityId: 'UNKNOWN' }, { type: 'ERA_VERIFY', nodeId: 'quarter-5' }, { type: 'ERA_CONNECT', cityId: 'BACKLUND', cash: 999 }, { type: 'ERA_RESPOND', incidentId: 'harbor-tide', mode: 'COORDINATED', check: { tier: 'SUCCESS' } }]) expect(validateVisionaryEraCommand(command)).toBe(false);
  });
  it('uses real travel time and money, does not mutate the host and permits no remote survey', () => {
    const state = createVisionaryEra('source-659', 144), actor = host(), before = structuredClone(actor);
    expect(visionaryEraBlock(state, { type: 'ERA_SURVEY', cityId: 'TRIER' }, actor)).toContain('实际到达');
    const result = applyVisionaryEra(state, { type: 'ERA_TRAVEL', cityId: 'TRIER' }, actor);
    expect(result.effect).toMatchObject({ cashCost: 12, cashGain: 0, weeks: 2, actions: 1, toLocation: VISIONARY_ERA_LOCATIONS.TRIER });
    expect(result.state.week).toBe(146); expect(state.week).toBe(144); expect(actor).toEqual(before);
  });
  it('charges only an actual local trip from another Backlund location and retains travel after promotion', () => {
    const state = createVisionaryEra('source-659', 144), actor = { ...host(), location: 'backlund:workshop', sequence: 0 as const };
    expect(applyVisionaryEra(state, { type: 'ERA_TRAVEL', cityId: 'BACKLUND' }, actor).effect).toMatchObject({ cashCost: 2, weeks: 0, actions: 1 });
    expect(visionaryEraBlock(state, { type: 'ERA_SURVEY', cityId: 'BACKLUND' }, actor)).toContain('序列1');
  });
  it('requires physical four-party investigation and locks the forecast before any original result can qualify', () => {
    const run = runner();
    expect(visionaryEraBlock(run.state, { type: 'ERA_FORECAST', plan: 'PUBLIC_RELAY' }, run.actor)).toContain('实地调查四方');
    run.survey(); run.step({ type: 'ERA_FORECAST', plan: 'PUBLIC_RELAY' });
    expect(run.state.forecast).toMatchObject({ minimumStations: 5, rounds: 2 });
    expect(visionaryEraBlock(run.state, { type: 'ERA_FORECAST', plan: 'PUBLIC_RELAY' }, run.actor)).toContain('事前锁定');
  });
  it('can actually prepare all six original stations from 400 cash and three weekly actions before the first event', () => {
    const run = runner(); run.prepare();
    expect(run.actor.cash).toBeGreaterThan(0); expect(run.actor.cash).toBeLessThan(400);
    expect(run.actor.week).toBeLessThan(run.state.incidents[0]!.releaseWeek);
    expect(run.state.governments.every(government => government.adopted)).toBe(true);
    expect(run.state.cities.every(city => city.connected && city.staffAssigned === 2)).toBe(true);
    expect(run.state.journal.every(receipt => receipt.effect.cashGain === 0)).toBe(true);
    expect(validateVisionaryEraState(run.state)).toBe(true);
  });
  it('does not open the window with paperwork or allow a future catastrophe to be generated', () => {
    const run = runner(); run.prepare();
    expect(deriveVisionaryEraWindow(run.state, run.actor)).toBeNull();
    expect(visionaryEraBlock(run.state, { type: 'ERA_RESPOND', incidentId: 'harbor-tide', mode: 'COORDINATED' }, run.actor)).toContain('尚未发生');
    expect(getVisionaryEraActions(run.state, run.actor).some(action => action.command.type === 'ERA_RESPOND')).toBe(false);
    expect(visionaryEraBlock(run.state, { type: 'ERA_VERIFY', nodeId: 'quarter-1' }, run.actor)).toContain('不能提前');
  });
  it('opens a dated window only after real two-round coordinated delivery and a real quarterly meeting', () => {
    const run = runner(); run.prepare(); run.resolveQuarter(0);
    const window = deriveVisionaryEraWindow(run.state, { ...run.actor, location: 'backlund:workshop' });
    expect(window).toMatchObject({ id: 'source-659:quarter-1', startWeek: 183, endWeek: 184 });
    expect(window!.receipts).toHaveLength(8);
    expect(run.state.incidents[0]).toMatchObject({ assisted: 18, delivered: 12, phase: 'RESOLVED', resolution: 'COORDINATED' });
    expect(run.state.incidents[1]).toMatchObject({ assisted: 24, delivered: 16 });
    expect(run.state.cities.find(city => city.id === 'PRITZ')).toMatchObject({ stock: 68, supplied: 12, residentsDisplaced: 0 });
    for (const government of run.state.governments) expect(government.budget + government.spent).toBe(VISIONARY_ERA_GOVERNMENTS.find(item => item.id === government.id)!.budget);
    expect(visionaryEraChallenge(run.state, { type: 'ERA_RESPOND', incidentId: 'trier-water', mode: 'COORDINATED' })).toBeNull();
  });
  it('accepts exactly five running original stations without silently requiring all six', () => {
    const run = runner(); run.survey(); run.step({ type: 'ERA_FORECAST', plan: 'PUBLIC_RELAY' });
    const adopted = new Set<string>();
    for (const city of VISIONARY_ERA_CITIES.filter(item => item.id !== 'TINGEN')) {
      run.travel(city.id); run.step({ type: 'ERA_PILOT', cityId: city.id }); run.step({ type: 'ERA_CONNECT', cityId: city.id });
      if (!adopted.has(city.governmentId)) { run.step({ type: 'ERA_ADOPT', governmentId: city.governmentId }); adopted.add(city.governmentId); }
    }
    run.travel('BACKLUND'); run.resolveQuarter(0);
    expect(run.state.cities.filter(city => city.connected)).toHaveLength(5);
    expect(deriveVisionaryEraWindow(run.state, run.actor)).not.toBeNull();
  });
  it('never retroactively supplies a missed dosing window and preserves three genuine later quarters', () => {
    const run = runner(); run.prepare(); run.resolveQuarter(0); run.wait(185);
    expect(deriveVisionaryEraWindow(run.state, run.actor)).toBeNull();
    expect(visionaryEraBlock(run.state, { type: 'ERA_VERIFY', nodeId: 'quarter-1' }, run.actor)).not.toBeNull();
    run.resolveQuarter(1);
    expect(deriveVisionaryEraWindow(run.state, run.actor)?.id).toBe('source-659:quarter-2');
    expect(run.state.nodes.filter(node => node.startWeek > 185)).toHaveLength(3);
  });
  it('lets later real events qualify after a failed first quarter while retaining original departed people and spoilage', () => {
    const run = runner(); run.prepare(); run.wait(185);
    const first = structuredClone(run.state.incidents.slice(0, 2));
    expect(first.every(incident => incident.phase === 'EXPIRED' && incident.departed === 4)).toBe(true);
    run.resolveQuarter(1);
    expect(deriveVisionaryEraWindow(run.state, run.actor)).not.toBeNull();
    expect(run.state.incidents.slice(0, 2)).toEqual(first);
    expect(run.state.cities.find(city => city.id === 'PRITZ')!.residentsDeparted).toBe(4);
    expect(run.state.cities.find(city => city.id === 'PRITZ')!.spoiled).toBe(2);
  });
  it('keeps ordinary rescue as a slower paid exit, with actual losses when the deadline passes during work', () => {
    const run = runner(); run.prepare();
    run.travel('TRIER'); run.wait(run.state.incidents[1]!.deadlineWeek);
    const before = run.actor.cash;
    const result = run.step({ type: 'ERA_RESPOND', incidentId: 'trier-water', mode: 'ORDINARY' });
    expect(result.effect).toMatchObject({ cashCost: 12, weeks: 2 }); expect(run.actor.cash).toBe(before - 12);
    expect(run.state.incidents[1]).toMatchObject({ phase: 'RESOLVED', resolution: 'ORDINARY', departed: 4, assisted: 20, delivered: 16 });
    expect(deriveVisionaryEraWindow(run.state, run.actor)).toBeNull();
    expect(validateVisionaryEraState(run.state)).toBe(true);
  });
  it('keeps later prospective planning possible without treating already-known reports as a prediction', () => {
    const run = runner(); run.survey(); run.wait(185); run.step({ type: 'ERA_FORECAST', plan: 'PUBLIC_RELAY' });
    expect(run.state.forecast!.week).toBe(185);
    expect(run.state.incidents[0]!.phase).toBe('EXPIRED');
    expect(validateVisionaryEraState(run.state)).toBe(true);
  });
  it('does not reset the finite event ledger or losses after very long waiting', () => {
    const state = createVisionaryEra('source-659', 144), later = advanceVisionaryEra(state, 250), muchLater = advanceVisionaryEra(later, 500);
    expect(muchLater.incidents).toEqual(later.incidents); expect(muchLater.cities).toEqual(later.cities);
    expect(muchLater.messages).toEqual(later.messages); expect(muchLater.nodes).toHaveLength(4);
    expect(projectVisionaryEra(muchLater).nextStep).toContain('不再补开');
    expect(deriveVisionaryEraWindow(muchLater, { ...host(), week: 500 })).toBeNull();
  });
  it('rejects changed budgets, original stock, duplicated populations, invented receipts and altered epilogue adults', () => {
    const run = runner(); run.prepare();
    const changes: ((state: VisionaryEraState) => void)[] = [
      state => { state.governments[0]!.budget += 1; }, state => { state.cities[0]!.stock += 1; },
      state => { state.cities[0]!.residentsSafe += 1; }, state => { state.cities[0]!.staffAssigned = 3; },
      state => { state.nodes[0]!.verifiedReceipt = 'invented'; state.nodes[0]!.verifiedWeek = 183; },
      state => { state.epilogueOrigin.rescuers[0]!.age = 17; },
    ];
    for (const change of changes) { const bad = structuredClone(run.state); change(bad); expect(validateVisionaryEraState(bad)).toBe(false); }
  });
  it('rejects duplicate event settlement, stale actor versions, off-site stamps and insufficient original resources', () => {
    const state = createVisionaryEra('source-659', 144), actor = host(), command: VisionaryEraCommand = { type: 'ERA_SURVEY', cityId: 'BACKLUND' };
    const result = applyVisionaryEra(state, command, actor);
    expect(visionaryEraBlock(result.state, command, actor)).toContain('已结算');
    expect(visionaryEraBlock(result.state, command, { ...actor, eventId: 'other', actorId: 'other-person', revision: 661 })).toContain('原行动者');
    expect(visionaryEraBlock(state, { type: 'ERA_TRAVEL', cityId: 'TRIER' }, { ...actor, cash: 0 })).toContain('不足');
    expect(visionaryEraBlock(state, command, { ...actor, status: 'DEAD' })).toContain('仍然存活');
    expect(() => advanceVisionaryEra(state, 143)).toThrow('backwards');
  });
});
