import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import { openDemonessRuntimeSession, type DemonessRuntimeSession } from '../../src/domain/demoness/owned-session.js';
import type { DemonessCommand } from '../../src/domain/demoness/types.js';
import { controlledDemonessRolls, demonessHash, demonessInheritedHash } from '../helpers/demoness-scenario.js';

// Byte-preserved stopped candidate, never a running capture or a new natural attempt.
const candidate = 'tests/fixtures/demoness-v02210/checkpoint883-v2.json.gz';
const candidateSha = 'aa9fd8c9c2f8654668c218497f7801f98fa6b6073c336ddc3861dde059cf069f';
let original: SliceState;
const bytesHash = () => createHash('sha256').update(readFileSync(candidate)).digest('hex');
beforeAll(() => {
  expect(bytesHash()).toBe(candidateSha);
  const saved = JSON.parse(gunzipSync(readFileSync(candidate)).toString('utf8'));
  expect(saved.payload).toMatchObject({ commandCount: 883, newCount: 195, pending: null });
  expect(demonessHash(saved.payload)).toBe(saved.sha256);
  original = saved.payload.state;
  expect(original).toMatchObject({ revision: 884, actionsRemaining: 0, cash: 170, progression: { sequence: 1 } });
  expect(original.demoness.passage!.residents.map(r => r.services.length)).toEqual([24, 0]);
});
afterAll(() => { expect(bytesHash()).toBe(candidateSha); });
const session = () => openDemonessRuntimeSession(structuredClone(original));
const commit = (s: DemonessRuntimeSession, command: DemonessCommand) => {
  const draft = s.prepare({ type: 'DEMONESS', command }, s.inspect().revision); s.commit(draft);
};
const preferred = (s: DemonessRuntimeSession): DemonessCommand => {
  const choices = s.projectDemoness().actions.filter(a => a.preferredAction);
  expect(choices).toHaveLength(1); expect(choices[0]!.enabled).toBe(true); return choices[0]!.command;
};
let prepared: SliceState | undefined;
function reachPreparedDose(): SliceState {
  if (prepared) return structuredClone(prepared);
  const s = session();
  for (let n = 0; n < 180; n++) {
    const command = preferred(s), before = s.snapshot();
    if (command.type === 'CONSUME') { prepared = before; return structuredClone(before); }
    if (command.type === 'MATERIAL' && command.command.type === 'VERIFY_CUSTODY') {
      expect(before.actionsRemaining).toBeGreaterThanOrEqual(2); expect(before.cash).toBeGreaterThanOrEqual(250);
    }
    if (command.type === 'STABILIZE_PROMOTION') {
      expect(before.actionsRemaining).toBeGreaterThanOrEqual(2); expect(before.cash).toBeGreaterThanOrEqual(150);
    }
    commit(s, command);
  }
  throw Error('Funded preferred route did not reach a prepared dose in 180 real commands.');
}

describe('Demoness recommendation reserves real resources before paid entry', () => {
  it('actual883 keeps all prior costs and chooses a real new week before another service', () => {
    const s = session(), hash = demonessHash(s.snapshot());
    expect(preferred(s)).toEqual({ type: 'NEXT_WEEK' });
    expect(demonessHash(s.snapshot())).toBe(hash);
    commit(s, preferred(s));
    const after = s.snapshot();
    expect(after.week).toBe(original.week + 1); expect(after.actionsRemaining).toBe(3);
    expect(after.cash).toBe(original.cash - 30);
    expect(after.random).toEqual(original.random);
    expect(after.demoness.passage!.residents.map(r => r.services)).toEqual(original.demoness.passage!.residents.map(r => r.services));
  }, 60_000);

  it('a manually entered zero-AP scene still pauses normally, then recovers instead of paying again', () => {
    const s = session();
    commit(s, { type: 'PASSAGE', command: { type: 'ARRIVE_RESIDENT', residentId: 'DM221-ENID' } });
    commit(s, { type: 'PASSAGE', command: { type: 'WALK', to: 0 } });
    expect(preferred(s)).toEqual({ type: 'PASSAGE', command: { type: 'PAUSE_SHIFT' } });
    commit(s, preferred(s));
    const paused = s.snapshot(), services = paused.demoness.passage!.residents.map(r => r.services);
    expect(paused.cash).toBe(original.cash - 20); expect(services.map(x => x.length)).toEqual([25, 0]);
    expect(preferred(s)).toEqual({ type: 'PASSAGE', command: { type: 'REST_OUTSIDE' } });
    for (let n = 0; n < 3; n++) {
      const command = preferred(s);
      if (command.type === 'NEXT_WEEK') break;
      expect(command).toEqual({ type: 'PASSAGE', command: { type: 'REST_OUTSIDE' } });
      const before = s.snapshot(); commit(s, command);
      const after = s.snapshot(), passage = after.demoness.passage!, previous = before.demoness.passage!;
      expect(after.demoness.frame!.nowSecond).toBe(before.demoness.frame!.nowSecond + 3600);
      expect(after.actionsRemaining).toBe(before.actionsRemaining); expect(after.cash).toBe(before.cash);
      expect(passage.playerEnergy).toBe(Math.min(100, previous.playerEnergy + 20));
      expect(passage.residents.map(r => r.energy)).toEqual(previous.residents.map(r => Math.min(100, r.energy + 10)));
      expect(passage.residents.map(r => r.services)).toEqual(services);
      expect(after.random).toEqual(original.random);
    }
    expect(preferred(s)).toEqual({ type: 'NEXT_WEEK' }); commit(s, preferred(s));
    const after = s.snapshot();
    expect(after.week).toBe(paused.week + 1); expect(after.actionsRemaining).toBe(3);
    expect(after.cash).toBe(paused.cash - 30);
    expect(after.demoness.passage!.residents.map(r => r.services)).toEqual(services);
    expect(after.demoness.passage!.supports.every(x => x.fittedEventId === null)).toBe(true);
    expect(after.random).toEqual(original.random);
  }, 60_000);

  it('one AP cannot fund two fittings; a cash shortage earns real wages before attendance', () => {
    const s = session(); commit(s, { type: 'NEXT_WEEK' });
    commit(s, { type: 'REST' }); commit(s, { type: 'REST' });
    expect(s.snapshot().actionsRemaining).toBe(1); expect(preferred(s)).toEqual({ type: 'NEXT_WEEK' });
    for (let n = 0; s.snapshot().cash >= 40 && n < 8; n++) commit(s, { type: 'NEXT_WEEK' });
    expect(s.snapshot().cash).toBeLessThan(40); expect(preferred(s)).toEqual({ type: 'WORK' });
    const before = s.snapshot(); commit(s, preferred(s));
    expect(s.snapshot().cash).toBe(before.cash + before.character.weeklyWage);
    expect(s.snapshot().demoness.passage!.residents[0]!.services).toHaveLength(24);
  }, 60_000);

  it('fittings, same-week custody and support complete with finite paid actions and preserved actual history', () => {
    const result = reachPreparedDose(), p = result.demoness.passage!, additions = result.demoness.journal.slice(original.demoness.journal.length);
    expect(p.passageReportEventId).not.toBeNull(); expect(p.residents.map(r => r.services.length)).toEqual([25, 1]);
    expect(p.supports.every(x => x.fittedEventId && x.passagesRemaining === 0)).toBe(true);
    expect(additions.filter(e => e.command.type === 'MATERIAL' && e.command.command.type === 'VERIFY_CUSTODY')).toHaveLength(1);
    expect(additions.filter(e => e.command.type === 'STABILIZE_PROMOTION')).toHaveLength(1);
    expect(result.demoness.journal.slice(0, original.demoness.journal.length)).toEqual(original.demoness.journal);
    expect(demonessInheritedHash(result)).toBe(demonessInheritedHash(original)); expect(result.random).toEqual(original.random);
  }, 180_000);

  it('controlled future failed ability attempts retain ordinary-shoring AP and finish without repeated paid arrivals', () => {
    // Explicit unit branch only: no source field, old draw, payment or natural file is edited.
    const before = reachPreparedDose(), cursor = before.random.cursor;
    const restore = controlledDemonessRolls(before, { [cursor]: 1, [cursor + 1]: 100, [cursor + 2]: 100, [cursor + 3]: 100, [cursor + 4]: 100 });
    try {
      const s = openDemonessRuntimeSession(before); commit(s, preferred(s));
      expect(s.snapshot().progression.sequence).toBe(0);
      let closed = false;
      for (let n = 0; n < 80; n++) {
        const state = s.snapshot();
        if (state.demoness.passage!.phase === 'CLOSED') { closed = true; break; }
        const command = preferred(s);
        if (command.type === 'PASSAGE' && command.command.type === 'RESHAPE_STRUT') expect(state.actionsRemaining).toBeGreaterThan(1);
        commit(s, command);
      }
      expect(closed).toBe(true);
      const end = s.snapshot(), p = end.demoness.passage!;
      expect(p.petrificationAttempts).toBeGreaterThan(0); expect(p.reshapingAttempts).toBeGreaterThan(0);
      expect(p.returnKit!.usedReshaping).toBe(false);
      expect(p.residents.map(r => r.services.length)).toEqual([26, 2]);
      expect(p.residents.every(r => r.position === -2 && r.returnPassage?.crossing && r.returnPassage.exit)).toBe(true);
      expect(demonessInheritedHash(end)).toBe(demonessInheritedHash(original));
    } finally { restore(); }
  }, 180_000);
});
