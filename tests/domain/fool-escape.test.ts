import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import {
  FOOL_ESCAPE_CASE_ID, FOOL_ESCAPE_MAX_JOURNAL, createFoolEscapeState,
  applyFoolEscapeCommand, foolEscapeCheckInput, projectFoolEscape,
  replayFoolEscape, validateFoolEscapeCommand, validateFoolEscapeState,
  type FoolEscapeAuthority, type FoolEscapeBody, type FoolEscapeBudget,
  type FoolEscapeCommand, type FoolEscapeHost, type FoolEscapeInitial,
  type FoolEscapeState,
} from '../../src/domain/fool/escape.js';

/** Candidate NOT_RUN. Receipts below are an independent exact-byte test ledger,
 * not ID membership or a player-supplied trusted boolean. Production controller
 * must sign real central resources and original-RNG resolveNormalCheck results. */
function initial(): FoolEscapeInitial {
  const make = (id: string, role: FoolEscapeBody['role'], name: string, age: number): FoolEscapeBody => ({
    id, role, name, age, sourceEra: 'CONTEMPORARY', health: 80, injuries: [],
    place: role === 'GUARD' ? 'CORRIDOR' : 'DOOR', walkedMetres: 0,
  });
  const actor = make('original-player', 'ACTOR', '原玩家', 39);
  actor.injuries.push({ id: 'old-1868-real-injury', kind: '原有轻伤', healthLoss: 7 });
  return { version: 1, caseId: FOOL_ESCAPE_CASE_ID, runId: 'original-run-1868', actorId: actor.id,
    originReceiptId: 'central-original-accident', now: 1000, conditionId: 'vault-clear-light',
    bodies: [actor, make('original-adult-messenger-a', 'MESSENGER_A', '莉迪亚', 31),
      make('original-adult-messenger-b', 'MESSENGER_B', '托马斯', 44), make('original-guard-victor', 'GUARD', '维克托', 46)],
    objects: [
      { id: 'original-door', role: 'ORIGINAL_DOOR', holderId: null, place: 'DOOR' },
      { id: 'original-sealed-crate', role: 'SEALED_CRATE', holderId: null, place: 'DOOR' },
      { id: 'original-satchel-a', role: 'SATCHEL_A', holderId: 'original-adult-messenger-a', place: 'DOOR' },
      { id: 'original-satchel-b', role: 'SATCHEL_B', holderId: 'original-adult-messenger-b', place: 'DOOR' },
      { id: 'original-guard-baton', role: 'BATON', holderId: 'original-guard-victor', place: 'CORRIDOR' },
      { id: 'original-player-coat', role: 'ACTOR_ITEM', holderId: actor.id, place: 'DOOR' },
    ], consentReceiptIds: ['adult-a-actual-consent', 'adult-b-actual-consent'],
    guardIntentReceiptId: 'independent-guard-pending-intent', guardInstinctiveStop: true };
}
class Harness {
  readonly ledger = new Map<string, string>();
  readonly originBytes: string;
  registered = false;
  readonly authority: FoolEscapeAuthority = {
    verifyInitial: i => stableStringify(i) === this.originBytes,
    canStartCase: (runId, caseId) => !this.registered && runId === this.source.runId && caseId === this.source.caseId,
    verifyHost: h => this.ledger.get(h.id) === stableStringify(h),
  };
  state: FoolEscapeState;
  budget: FoolEscapeBudget;
  serial = 0;
  constructor(readonly source = initial()) {
    this.originBytes = stableStringify(source);
    this.state = createFoolEscapeState(source, this.authority);
    this.registered = true;
    this.budget = { actions: 3, spirituality: 60, mind: 60, health: source.bodies[0]!.health };
  }
  host(type: FoolEscapeCommand['type'], roll = 1, patch: Partial<FoolEscapeHost> = {}): FoolEscapeHost {
    const n = ++this.serial;
    const h: FoolEscapeHost = {
      id: `exact-host-${n}`, eventId: `central-event-${n}`, expectedRevision: this.state.revision,
      command: { type }, actorId: this.source.actorId, alive: this.budget.health > 0, sequence: 0,
      now: this.state.scene.now, budget: { ...this.budget }, stats: { physique: 35, perception: 35, will: 35, knowledge: 35 },
      environment: { conditionId: this.state.scene.conditionId, lineOfSight: true },
      check: null, rngBeforeRef: null, rngAfterRef: null, ...patch,
    };
    const input = foolEscapeCheckInput(this.state, h.command, h);
    if (input) { h.check = resolveNormalCheck({ ...input, roll }); h.rngBeforeRef = `original-rng-before-${n}`; h.rngAfterRef = `original-rng-after-${n}`; }
    this.sign(h); return h;
  }
  sign(h: FoolEscapeHost): void { this.ledger.set(h.id, stableStringify(h)); }
  apply(h: FoolEscapeHost) {
    const r = applyFoolEscapeCommand(this.state, h.command, h, this.authority);
    this.state = r.state; this.budget = { ...r.effect.resourcesAfter }; return r;
  }
  act(type: FoolEscapeCommand['type'], roll = 1, patch: Partial<FoolEscapeHost> = {}) { return this.apply(this.host(type, roll, patch)); }
  body(role: FoolEscapeBody['role']) { return this.state.scene.bodies.find(b => b.role === role)!; }
  corridor() { this.act('OPEN_DOOR'); this.act('WALK'); }
  image() { this.corridor(); this.act('PRIOR_PLACE'); }
}

describe('208 bounded original-vault rescue, candidate NOT_RUN', () => {
  it('pins one real adult rescue with original bodies, door, crate, satchels and old player injury', () => {
    const h = new Harness();
    expect(h.state.scene.bodies.map(b => [b.id, b.place])).toEqual(h.source.bodies.map(b => [b.id, b.place]));
    expect(h.body('ACTOR').injuries).toEqual(h.source.bodies[0]!.injuries);
    expect(h.state.scene.look).toBe('PENDING');
    expect(h.state.scene.tracking).toBe('DORMANT');
    expect(validateFoolEscapeState(h.state, h.authority)).toBe(true);
    expect(() => createFoolEscapeState(h.source, h.authority)).toThrow('ESCAPE_CASE_ALREADY_REGISTERED');
    const changed = structuredClone(h.source); changed.bodies[1]!.id = 'replacement-messenger';
    expect(() => createFoolEscapeState(changed, h.authority)).toThrow('ESCAPE_UNVERIFIED_ORIGIN');
  });

  it('rejects forged minors, duplicate originals and false initial locations even with an exact origin receipt', () => {
    for (const corrupt of [
      (s: FoolEscapeInitial) => { s.bodies[1]!.age = 17; },
      (s: FoolEscapeInitial) => { s.objects[1]!.id = s.objects[0]!.id; },
      (s: FoolEscapeInitial) => { s.bodies[1]!.place = 'EXIT'; },
      (s: FoolEscapeInitial) => { s.objects[2]!.holderId = s.actorId; },
    ]) { const s = initial(); corrupt(s); expect(() => new Harness(s)).toThrow(); }
  });

  it('uses both bounded abilities in a real six-action rescue and awards each used ability only on one report', () => {
    const h = new Harness(), sourceBytes = stableStringify(h.source), before = stableStringify(h.state);
    h.act('OPEN_DOOR'); h.act('MOMENTARY_BLINDNESS');
    const crossing = h.host('WALK');
    expect(crossing.check?.modifiers).toEqual([{ source: '片刻盲愚', value: 35 }]);
    const moved = h.apply(crossing);
    expect(moved.effect.elapsedSeconds).toBe(3);
    expect(h.state.scene.instinctiveStopExecuted).toBe(true);
    expect(h.state.scene.look).toBe('SETTLED');
    expect(h.body('ACTOR').place).toBe('CORRIDOR');
    h.act('PRIOR_PLACE');
    expect(h.state.scene.bodies.filter(b => b.role !== 'GUARD').every(b => b.place === 'CORRIDOR')).toBe(true);
    expect(h.state.scene.image?.place).toBe('CORRIDOR');
    const rescued = h.act('WALK');
    expect(rescued.effect.status).toBe('RESCUED');
    expect(rescued.effect.rescuedIds).toHaveLength(2);
    expect(rescued.effect.mastery).toEqual([]);
    expect(h.body('GUARD').place).toBe('CORRIDOR');
    const report = h.act('REPORT');
    expect(report.effect.mastery).toEqual([
      { abilityId: 'diviner.s0.momentary-blindness', amount: 8 },
      { abilityId: 'diviner.s0.prior-place', amount: 8 },
    ]);
    expect(h.budget).toEqual({ actions: 0, spirituality: 36, mind: 52, health: 80 });
    expect(h.body('ACTOR').injuries).toEqual(h.source.bodies[0]!.injuries);
    expect(h.state.scene.objects.find(o => o.role === 'SEALED_CRATE')?.place).toBe('DOOR');
    expect(h.state.scene.objects.filter(o => o.role.startsWith('SATCHEL')).every(o => o.place === 'EXIT')).toBe(true);
    expect(h.state.scene.objects.map(o => o.id)).toEqual(h.source.objects.map(o => o.id));
    expect(stableStringify(h.source)).toBe(sourceBytes);
    expect(before).not.toBe(stableStringify(h.state));
    expect(validateFoolEscapeState(h.state, h.authority)).toBe(true);
    expect(() => h.act('REPORT')).toThrow('已经报告');
  });

  it('charges a resisted cast and preserves the guard preformed stop with no invented blind success', () => {
    const h = new Harness(); h.act('OPEN_DOOR');
    const failed = h.act('MOMENTARY_BLINDNESS', 100);
    expect(failed.effect.cost).toEqual({ actions: 1, spirituality: 12, mind: 4 });
    expect(h.state.scene.blindness).toBeNull();
    const crossing = h.host('WALK'); expect(crossing.check?.modifiers).toEqual([]);
    h.apply(crossing); expect(h.state.scene.instinctiveStopExecuted).toBe(true);
    h.act('WITHDRAW'); expect(h.act('REPORT').effect.mastery).toEqual([]);
  });

  it('cannot cast before sight, repeat a cast, or alter already executed inspection and pursuit', () => {
    const h = new Harness();
    expect(() => h.act('MOMENTARY_BLINDNESS')).toThrow('打开原门');
    h.act('OPEN_DOOR'); h.act('MOMENTARY_BLINDNESS');
    expect(() => h.act('MOMENTARY_BLINDNESS')).toThrow('已尝试干扰');
    h.act('WALK'); expect(() => h.act('MOMENTARY_BLINDNESS')).toThrow('已经落定');
    h.act('WALK', 70); expect(h.state.scene.tracking).toBe('SETTLED');
    expect(() => h.act('PRIOR_PLACE')).toThrow('尚未落定');
  });

  it('expires the short blind window rather than extending it through repeated waiting', () => {
    const h = new Harness(); h.act('OPEN_DOOR'); h.act('MOMENTARY_BLINDNESS'); h.act('WAIT');
    const crossing = h.host('WALK');
    // One second waiting plus the guard's three-second stop/cross exceeds it.
    expect(crossing.check?.modifiers).toEqual([]);
    h.apply(crossing); expect(h.state.scene.appliedAbilities).toEqual([]);
  });

  it('the next historical-image impact mitigates real new injury only, and never guarantees invulnerability', () => {
    const h = new Harness(); h.image();
    const outcome = h.act('WALK', 70);
    expect(outcome.effect.consequences.find(c => c.bodyId === h.source.actorId)?.injury.healthLoss).toBe(5);
    expect(h.body('ACTOR').health).toBe(75);
    expect(h.body('ACTOR').injuries[0]).toEqual(h.source.bodies[0]!.injuries[0]);
    expect(h.body('ACTOR').place).toBe('CORRIDOR');
    expect(h.body('MESSENGER_A').health).toBe(77);
    expect(h.state.scene.image).toBeNull();
    expect(h.state.scene.appliedAbilities).toEqual(['diviner.s0.prior-place']);
    const again = h.act('WALK', 70);
    expect(again.effect.consequences.find(c => c.bodyId === h.source.actorId)?.injury.healthLoss).toBe(35);
    expect(h.body('ACTOR').health).toBe(40);
    h.act('WITHDRAW');
    expect(h.act('REPORT').effect.mastery).toEqual([{ abilityId: 'diviner.s0.prior-place', amount: 8 }]);
  });

  it.each(['elapsed', 'conditions', 'occlusion', 'release', 'bypass'] as const)('invalidates the image on %s without reversing original movement or harm', mode => {
    const h = new Harness(); h.image(); const prior = h.body('ACTOR').injuries.slice();
    if (mode === 'elapsed') h.act('WAIT', 1, { now: h.state.scene.now + 21 });
    if (mode === 'conditions') h.act('WAIT', 1, { environment: { conditionId: 'fallen-screen', lineOfSight: true } });
    if (mode === 'occlusion') h.act('WAIT', 1, { environment: { conditionId: 'vault-clear-light', lineOfSight: false } });
    if (mode === 'release') h.act('RELEASE_IMAGE');
    if (mode === 'bypass') h.act('BYPASS', 70);
    expect(h.state.scene.image).toBeNull();
    expect(h.state.scene.appliedAbilities).toEqual([]);
    if (mode !== 'bypass') {
      const outcome = h.act('WALK', 70);
      expect(outcome.effect.consequences.find(c => c.bodyId === h.source.actorId)?.injury.healthLoss).toBe(35);
    }
    expect(h.body('ACTOR').injuries.slice(0, prior.length)).toEqual(prior);
    expect(validateFoolEscapeState(h.state, h.authority)).toBe(true);
  });

  it('ordinary open/walk uses central percentile checks and the guard really follows if no image misleads him', () => {
    const h = new Harness(); h.corridor();
    const outcome = h.act('WALK');
    expect(outcome.effect.status).toBe('RESCUED');
    expect(h.body('GUARD')).toMatchObject({ place: 'EXIT', walkedMetres: 4 });
    expect(h.state.scene.objects.find(o => o.role === 'BATON')?.place).toBe('EXIT');
    expect(h.act('REPORT').effect.mastery).toEqual([]);
  });

  it('zero AP, spirituality and mind still permit ordinary bypass, waiting and a timed retreat', () => {
    const h = new Harness(); h.budget = { actions: 0, spirituality: 0, mind: 0, health: 80 };
    const actions = projectFoolEscape(h.state, h.budget).actions;
    expect(actions.find(a => a.command.type === 'OPEN_DOOR')?.enabled).toBe(false);
    expect(actions.find(a => a.command.type === 'WITHDRAW')?.enabled).toBe(true);
    h.act('WAIT');
    const bypass = h.act('BYPASS'); expect(bypass.effect.cost).toEqual({ actions: 0, spirituality: 0, mind: 0 });
    expect(h.body('ACTOR')).toMatchObject({ place: 'CORRIDOR', walkedMetres: 8 });
    const out = h.act('WITHDRAW');
    expect(out.effect.elapsedSeconds).toBe(8);
    expect(out.effect.rescuedIds).toHaveLength(2);
    expect(h.body('ACTOR')).toMatchObject({ place: 'EXIT', walkedMetres: 16 });
    expect(h.act('REPORT').effect.mastery).toEqual([]);
    const direct = new Harness(); direct.budget.actions = 0;
    expect(direct.act('WITHDRAW').effect.elapsedSeconds).toBe(12);
  });

  it('does not create an enabled insufficient-resource spell loop', () => {
    const h = new Harness(); h.act('OPEN_DOOR'); h.budget.spirituality = 0;
    const before = stableStringify(h.state);
    expect(() => h.act('MOMENTARY_BLINDNESS')).toThrow('当前资源不足');
    expect(stableStringify(h.state)).toBe(before);
    const p = projectFoolEscape(h.state, h.budget);
    expect(p.actions.find(a => a.command.type === 'MOMENTARY_BLINDNESS')?.enabled).toBe(false);
    expect(p.actions.find(a => a.command.type === 'WITHDRAW')?.enabled).toBe(true);
  });

  it('can kill the player; neither report, continuation nor an image revives them', () => {
    const source = initial(); source.bodies[0]!.health = 20;
    const h = new Harness(source); h.act('OPEN_DOOR');
    const dead = h.act('WALK', 100);
    expect(dead.effect.status).toBe('DEAD');
    expect(dead.effect.resourcesAfter.health).toBe(0);
    expect(h.body('ACTOR').place).toBe('DOOR');
    expect(projectFoolEscape(h.state, h.budget).actions).toEqual([]);
    expect(() => h.act('REPORT')).toThrow();
    expect(() => h.act('WITHDRAW')).toThrow();
    expect(validateFoolEscapeState(h.state, h.authority)).toBe(true);
  });

  it.each(['MOMENTARY_BLINDNESS', 'PRIOR_PLACE'] as const)('an actual last-four-mind %s payment ends in death, while five mind leaves one', type => {
    for (const mind of [4, 5]) {
      const h = new Harness();
      if (type === 'MOMENTARY_BLINDNESS') h.act('OPEN_DOOR'); else h.corridor();
      h.budget.mind = mind;
      const oldInjuries = structuredClone(h.body('ACTOR').injuries);
      const oldPositions = h.state.scene.objects.map(o => ({ id: o.id, place: o.place }));
      const place = h.body('ACTOR').place, outcome = h.act(type);
      expect(outcome.effect.cost).toEqual({ actions: 1, spirituality: 12, mind: 4 });
      expect(outcome.effect.resourcesAfter.mind).toBe(mind - 4);
      expect(h.body('ACTOR').place).toBe(place);
      expect(h.body('ACTOR').injuries).toEqual(oldInjuries);
      expect(h.state.scene.objects.map(o => ({ id: o.id, place: o.place }))).toEqual(oldPositions);
      if (mind === 4) {
        expect(outcome.effect.status).toBe('DEAD'); expect(outcome.effect.resourcesAfter.health).toBe(0);
        expect(h.state.scene.image).toBeNull(); expect(h.state.scene.blindness).toBeNull();
        expect(projectFoolEscape(h.state, h.budget).actions).toEqual([]);
        expect(() => h.act('WITHDRAW')).toThrow();
      } else {
        expect(outcome.effect.status).toBe('ACTIVE'); expect(outcome.effect.resourcesAfter.health).toBe(80);
        expect(h.act('WITHDRAW').effect.status).toBe('WITHDRAWN');
      }
      expect(validateFoolEscapeState(h.state, h.authority)).toBe(true);
    }
  });

  it('preserves a dead messenger and original satchel at the accident while survivors actually retreat', () => {
    const source = initial(); source.bodies[1]!.health = 10;
    const h = new Harness(source); h.act('OPEN_DOOR'); h.act('WALK', 70);
    expect(h.body('MESSENGER_A').health).toBe(0);
    const out = h.act('WITHDRAW');
    expect(out.effect.status).toBe('WITHDRAWN'); expect(out.effect.rescuedIds).toEqual(['original-adult-messenger-b']);
    expect(h.body('MESSENGER_A').place).toBe('DOOR');
    expect(h.body('MESSENGER_B').place).toBe('EXIT');
    expect(h.state.scene.objects.find(o => o.role === 'SATCHEL_A')?.place).toBe('DOOR');
    expect(h.state.scene.objects.find(o => o.role === 'SATCHEL_B')?.place).toBe('EXIT');
    h.act('REPORT'); expect(validateFoolEscapeState(h.state, h.authority)).toBe(true);
  });

  it('does not make the independent guard invulnerable to the same falling-frame accident', () => {
    const source = initial(); source.bodies[3]!.health = 5;
    const h = new Harness(source); h.corridor();
    const bad = h.act('WALK', 100);
    expect(h.body('GUARD').health).toBe(0);
    expect(bad.effect.consequences.some(c => c.bodyId === 'original-guard-victor' && c.healthAfter === 0)).toBe(true);
    expect(h.state.scene.tracking).toBe('SETTLED');
    expect(h.state.scene.objects.find(o => o.role === 'BATON')?.place).toBe('CORRIDOR');
    h.act('WITHDRAW'); expect(validateFoolEscapeState(h.state, h.authority)).toBe(true);
  });

  it('checks exact signed bytes rather than accepting a genuine receipt ID with altered RNG/check/resources', () => {
    for (const corrupt of [
      (h: FoolEscapeHost) => { h.budget.spirituality += 100; },
      (h: FoolEscapeHost) => { h.rngAfterRef = 'different-original-stream'; },
      (h: FoolEscapeHost) => { h.check = h.check && { ...h.check, roll: 1, tier: 'GREAT_SUCCESS' }; },
    ]) {
      const h = new Harness(); const receipt = h.host('BYPASS', 70); corrupt(receipt);
      expect(() => h.apply(receipt)).toThrow('ESCAPE_UNVERIFIED_HOST');
      expect(h.state.revision).toBe(0);
    }
  });

  it('rejects a signed-but-wrong percentile result, hidden extra fields, stale actor, time and command', () => {
    const h = new Harness();
    const wrong = h.host('BYPASS'); wrong.check = { ...wrong.check!, chance: 100 }; h.sign(wrong);
    expect(() => h.apply(wrong)).toThrow('ESCAPE_NORMAL_CHECK_MISMATCH');
    for (const patch of [{ actorId: 'replacement-player' }, { sequence: 1 }, { alive: false }, { now: 999 }, { expectedRevision: 8 }]) {
      const receipt = h.host('WAIT', 1, patch as Partial<FoolEscapeHost>);
      expect(() => h.apply(receipt)).toThrow('ESCAPE_UNVERIFIED_HOST');
    }
    const extra = { ...h.host('WAIT'), trustMe: true }; h.sign(extra);
    expect(() => h.apply(extra)).toThrow('ESCAPE_UNVERIFIED_HOST');
    const command = h.host('WAIT');
    expect(() => applyFoolEscapeCommand(h.state, { type: 'WITHDRAW' }, command, h.authority)).toThrow('ESCAPE_UNVERIFIED_HOST');
    expect(validateFoolEscapeCommand({ type: 'WALK', privateIntent: 'SETTLED' })).toBe(false);
  });

  it('rejects journal/state tampering, reordered history, replayed receipts and a replaced origin', () => {
    const h = new Harness(); h.corridor(); h.act('PRIOR_PLACE'); h.act('WALK', 70);
    expect(replayFoolEscape(h.source, h.state.journal, h.authority)).toEqual(h.state);
    const mutations: ((s: FoolEscapeState) => void)[] = [
      s => { s.scene.bodies[0]!.health = 100; },
      s => { s.scene.bodies[1]!.place = 'EXIT'; },
      s => { s.scene.objects[1]!.id = 'copied-crate'; },
      s => { s.scene.reported = true; },
      s => { s.scene.image = null; s.scene.appliedAbilities = []; },
      s => { s.journal[0]!.effect.cost.actions = 0; },
      s => { s.journal[1]!.host.check = s.journal[1]!.host.check && { ...s.journal[1]!.host.check!, roll: 100 }; },
      s => { s.journal.reverse(); },
      s => { s.journal.push(structuredClone(s.journal[0]!)); },
      s => { s.initial.bodies[0]!.injuries = []; },
    ];
    for (const mutate of mutations) { const copy = structuredClone(h.state); mutate(copy); expect(validateFoolEscapeState(copy, h.authority)).toBe(false); }
    const old = h.state.journal[0]!.host;
    expect(() => h.apply(old)).toThrow('ESCAPE_UNVERIFIED_HOST');
  });

  it('bounds one case to 32 entries, reserving ordinary exit and one report instead of a stuck loop', () => {
    const h = new Harness(); h.budget.actions = 0;
    for (let n = 0; n < FOOL_ESCAPE_MAX_JOURNAL - 2; n++) h.act('WAIT');
    expect(() => h.act('WAIT')).toThrow('不能继续拖延');
    const p = projectFoolEscape(h.state, h.budget);
    expect(p.actions.filter(a => a.enabled).map(a => a.command.type)).toEqual(['WITHDRAW']);
    h.act('WITHDRAW'); h.act('REPORT');
    expect(h.state.journal).toHaveLength(32);
    expect(validateFoolEscapeState(h.state, h.authority)).toBe(true);
    expect(() => h.act('REPORT')).toThrow('ESCAPE_JOURNAL_LIMIT');
  });

  it('projects only fixed visible people/resources/original locations, never private checks, future intentions or receipts', () => {
    const h = new Harness(); h.image(); const p = projectFoolEscape(h.state, h.budget), bytes = stableStringify(p);
    for (const forbidden of ['rngBeforeRef', 'rngAfterRef', 'guardIntentReceiptId', 'guardInstinctiveStop', 'consentReceiptIds', 'originReceiptId', 'expectedRevision', '"look"', '"tracking"', '"roll"', '"chance"', '"journal"']) expect(bytes).not.toContain(forbidden);
    expect(bytes).not.toContain('本作平衡'); expect(bytes).not.toContain('L243');
    expect(p.resources).toEqual(h.budget); expect(p.actions.length).toBeLessThanOrEqual(6);
    expect(p.bodies.map(b => b.id)).toEqual(h.source.bodies.map(b => b.id));
    p.bodies[0]!.health = 0; p.objects[0]!.place = 'EXIT'; p.resources.spirituality = 999;
    expect(h.body('ACTOR').health).toBe(80); expect(h.state.scene.objects[0]!.place).toBe('DOOR'); expect(h.budget.spirituality).toBe(48);
  });
});
