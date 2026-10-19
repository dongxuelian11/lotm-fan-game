import { afterEach, describe, expect, it, vi } from 'vitest';

// Exercise both actual module orders in fresh registries. These checks only
// construct an empty root and reject invalid ingress; no campaign is rebuilt.
afterEach(() => { vi.resetModules(); });
describe('Fool owned-session module initialization', () => {
  it.each(['engine-first', 'session-first'] as const)('loads %s without an initialization cycle failure', async order => {
    vi.resetModules();
    const loadEngine = () => import('../../src/domain/fool/engine.js');
    const loadSession = () => import('../../src/domain/fool/owned-session.js');
    if (order === 'engine-first') { await loadEngine(); await loadSession(); }
    else { await loadSession(); await loadEngine(); }
    const engine = await loadEngine(), session = await loadSession();
    const boundary = await import('../../src/domain/fool/index.js');
    expect(engine.createFoolState()).toMatchObject({ version: 1, guidanceKnown: false, source: null, journal: [] });
    expect(boundary.validateFoolCommand({ type: 'RECEPTION_WORK' })).toBe(true);
    expect(boundary.validateFoolCommand({ type: 'RECEPTION_WORK', verified: true })).toBe(false);
    expect(typeof session.openFoolRuntimeSession).toBe('function');
    expect(() => session.openFoolRuntimeSession({})).toThrow();
  }, 30_000);
});
