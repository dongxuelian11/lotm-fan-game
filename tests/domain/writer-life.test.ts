import { describe, expect, it } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { WRITER_PREPARATION_IDS } from '../../src/domain/writer/types.js';
import { blockWriterActivity, createWriterLifeState, hasWriterLifeLock, projectWriterLife, validateWriterActivityCommand, validateWriterLife, WRITER_CASE_IDS, writerLifeActions, type WriterActivityCommand, type WriterCaseId } from '../../src/domain/writer/life.js';
import { directedInitial2, dose, originalAudienceRoots, originalDiscerner, rejectWriter, step, wr } from './writer-directed-helper.js';

const IDS = ['audience.s1.reciprocal-insight', 'audience.s1.plausible-arrangement'] as const;
const ok = (tier: string) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
const lifeCache = new Map<string, SliceState>();
/** All directed inputs are selected BEFORE the first new acquisition receipt.
 * We then really buy and consume the potion through the public reducer. Neither
 * old history nor health, mind, mastery or a later roll is repaired. */
function lifeState(insight = true, arrangement = true): SliceState {
  const key = `${insight}:${arrangement}`, cached = lifeCache.get(key); if (cached) return structuredClone(cached);
  let s = directedInitial2(); let selected: number | null = null;
  for (let cursor = s.random.cursor; cursor < s.random.cursor + 2048; cursor++) {
    const rng = new DeterministicActionRandomStream(s.random.seed, cursor);
    const promotion = resolveNormalCheck({ ability: 'will', baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [], roll: rng.nextInt(1, 100) });
    const first = resolveNormalCheck({ ability: 'will', baseAbility: s.character.coreStats.will + 1, difficulty: 18, modifiers: [], roll: rng.nextInt(1, 100) });
    const second = resolveNormalCheck({ ability: 'will', baseAbility: s.character.coreStats.will + 1, difficulty: 20, modifiers: [], roll: rng.nextInt(1, 100) });
    if (promotion.tier === 'SUCCESS' && ok(first.tier) === insight && ok(second.tier) === arrangement) { selected = cursor; break; }
  }
  if (selected === null) throw new Error('No bounded declared life input found.');
  s.random.cursor = selected; assertValidSliceState(s);
  s = wr(s, { type: 'LEARN_GUIDANCE' }); for (const taskId of WRITER_PREPARATION_IDS) s = wr(s, { type: 'PREPARE_TASK', taskId });
  s = wr(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); s = wr(s, { type: 'PREPARE_PROMOTION' }); s = wr(s, dose);
  expect(s.progression.sequence).toBe(1); expect(validateWriterLife(s)).toBe(true); lifeCache.set(key, structuredClone(s)); return s;
}
function act(s: SliceState, ...commands: WriterActivityCommand[]): SliceState {
  for (const command of commands) { s = wr(s, command); expect(validateWriterLife(s), JSON.stringify(command)).toBe(true); }
  return s;
}
const begin = (s: SliceState, id: WriterCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') => act(s, { type: 'OBSERVE', caseId: id }, { type: 'INVITE', caseId: id, method }, { type: 'ENTER_ROOM' });
function finish(s: SliceState, id: WriterCaseId): SliceState {
  if (s.writer.life.practice.ownerNode === 'FAR') s = act(s, { type: 'MOVE', to: 'NEAR' });
  return act(s, { type: 'RETURN_HOME' }, { type: 'REPORT', caseId: id });
}
function readAndReturn(s: SliceState): SliceState {
  return act(s, { type: 'TAKE_BOOK' }, { type: 'MOVE', to: 'NEAR' }, { type: 'CHECK_BOOK' }, { type: 'MOVE', to: 'FAR' }, { type: 'RETURN_BOOK' });
}
function completeMutual(s: SliceState, ability = false): SliceState {
  s = begin(s, 'mutual-clue', ability ? 'ABILITY' : 'ORDINARY');
  if (ability) s = act(s, { type: 'INTRODUCE' }, { type: 'MUTUAL_INSIGHT' });
  return finish(readAndReturn(s), 'mutual-clue');
}
function giveThomasBook(s: SliceState): SliceState { return act(s, { type: 'TAKE_BOOK' }, { type: 'MOVE', to: 'NEAR' }, { type: 'HAND_TO_THOMAS' }); }
function nextActualWeek(s: SliceState): SliceState {
  const week = s.week;
  for (let n = 0; n < 160 && s.week === week; n++) {
    if (s.activeEvent) {
      if (s.activeEvent.id !== 'LIFE-CARE-01') throw new Error(`Unexpected ordinary-week event: ${s.activeEvent.id}`);
      s = step(s, { type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent.instanceId, choiceId: 'DECLINE' });
    } else s = step(s, { type: 'ACTION', action: 'REST' });
  }
  expect(s.week).toBeGreaterThan(week); return s;
}

describe('Writer finite reading-room life', () => {
  it('keeps the exact old source, new original adults and the genuine prior report without granting mastery', () => {
    const source = originalDiscerner(), s = lifeState(), p = s.writer.life.practice;
    expect(originalAudienceRoots(s)).toEqual(originalAudienceRoots(source));
    for (const [id, mastery] of Object.entries(source.progression.mastery)) expect(s.progression.mastery[id]).toBe(mastery);
    expect(Object.entries(source.progression.mastery).filter(([, value]) => value === 0)).toHaveLength(8);
    expect(s.progression.mastery[IDS[0]]).toBe(0); expect(s.progression.mastery[IDS[1]]).toBe(0);
    expect(p.participants.map(person => [person.id, person.name, person.age, person.present])).toEqual([
      ['WR1-EVELYN', '伊芙琳·赛尔', 36, false], ['WR1-THOMAS', '托马斯·里德', 42, false],
    ]);
    expect(p.book).toEqual({ id: 'WR1-RETURN-BOOK', ownerId: 'WR1-EVELYN', holder: 'SHELF', node: 'FAR' });
    expect(s.writer.life.sourceRecord).toMatchObject({ ownerName: source.character.name, reportId: 'discerner-case:present-mark' });
    expect(p.introduction).toBeNull(); expect(p.knownClues).toEqual([]); expect(createWriterLifeState().sourceRecord).toBeNull();
    expect(s.health).toBe(98); expect(s.mind).toBe(83); expect(s.spirituality).toBe(120);
  });

  it('requires actual introduction and showing the source record, pays once, and physically verifies and returns the original', () => {
    let s = lifeState(true); const roots = structuredClone(originalAudienceRoots(s)), spirit = s.spirituality, mind = s.mind, cash = s.cash, cursor = s.random.cursor;
    s = begin(s, 'mutual-clue'); rejectWriter(s, { type: 'MUTUAL_INSIGHT' }); rejectWriter(s, { type: 'REPORT', caseId: 'mutual-clue' });
    expect(s.writer.life.practice.ownerNode).toBe('FAR'); expect(s.writer.life.practice.ownerWalkedMetres).toBe(6);
    expect(s.writer.life.practice.record.node).toBe('FAR'); s = act(s, { type: 'INTRODUCE' });
    expect(s.writer.life.practice.introduction).toMatchObject({ name: s.character.name, reportId: 'discerner-case:present-mark', reportDigest: s.writer.life.sourceRecord!.reportDigest });
    s = act(s, { type: 'MUTUAL_INSIGHT' });
    expect(s.random.cursor).toBe(cursor + 1); expect(s.spirituality).toBe(spirit - 6); expect(s.mind).toBe(mind - 2);
    expect(s.writer.life.practice.knownClues).toEqual([{ source: 'RECIPROCAL_INSIGHT', text: '东架第三层，蓝色书脊旁的七号位。', caseId: 'mutual-clue' }]);
    expect(s.writer.life.practice.abilityUses[IDS[0]]).toEqual({ attempts: 1, successes: 1, applied: 1 });
    expect(s.progression.mastery[IDS[0]]).toBe(0); rejectWriter(s, { type: 'MUTUAL_INSIGHT' }); rejectWriter(s, { type: 'RETURN_HOME' });
    s = act(s, { type: 'TAKE_BOOK' }); rejectWriter(s, { type: 'CHECK_BOOK' });
    s = act(s, { type: 'MOVE', to: 'NEAR' }, { type: 'CHECK_BOOK' }); rejectWriter(s, { type: 'RETURN_BOOK' }); rejectWriter(s, { type: 'RETURN_HOME' });
    s = act(s, { type: 'MOVE', to: 'FAR' }, { type: 'RETURN_BOOK' }); rejectWriter(s, { type: 'RETURN_HOME' });
    s = finish(s, 'mutual-clue');
    expect(s.writer.life.practice.ownerWalkedMetres).toBe(24); expect(s.writer.life.journal.reduce((sum, entry) => sum + entry.bookTravelMetres, 0)).toBe(12);
    expect(s.writer.life.practice.participants.every(person => !person.present && person.node === 'NEAR')).toBe(true);
    expect(s.cash).toBe(cash - 20); expect(s.progression.mastery[IDS[0]]).toBe(8); expect(s.progression.mastery[IDS[1]]).toBe(0);
    expect(s.progression.acting).toBe(25); expect(originalAudienceRoots(s)).toEqual(roots); expect(hasWriterLifeLock(s)).toBe(false);
  });

  it('retains seeded failure and paid costs, and ordinary reading never creates a successful ability', () => {
    let s = lifeState(false); const spirit = s.spirituality, mind = s.mind;
    s = begin(s, 'mutual-clue'); s = act(s, { type: 'INTRODUCE' }, { type: 'MUTUAL_INSIGHT' });
    expect(s.writer.life.cases['mutual-clue'].abilityApplied).toBe(false); expect(s.writer.life.practice.knownClues).toEqual([]);
    expect(s.spirituality).toBe(spirit - 6); expect(s.mind).toBe(mind - 2); rejectWriter(s, { type: 'MUTUAL_INSIGHT' });
    const failed = s.writer.life.cases['mutual-clue'].outcome; s = finish(readAndReturn(s), 'mutual-clue');
    expect(s.writer.life.cases['mutual-clue']).toMatchObject({ result: 'ORDINARY', outcome: failed, abilityAttempted: true, abilityApplied: false });
    expect(s.writer.life.practice.abilityUses[IDS[0]]).toEqual({ attempts: 1, successes: 0, applied: 0 }); expect(s.progression.mastery[IDS[0]]).toBe(0);
  });

  it('arranges only a future return with existing motive, original book and a real explicit 30-second wait', () => {
    let s = completeMutual(lifeState(true, true), true); s = begin(s, 'scheduled-return');
    rejectWriter(s, { type: 'ARRANGE_RETURN' }); s = giveThomasBook(s);
    const spirit = s.spirituality, mind = s.mind, clock = s.writer.life.practice.elapsedSeconds;
    s = act(s, { type: 'ARRANGE_RETURN' });
    expect(s.spirituality).toBe(spirit - 8); expect(s.mind).toBe(mind - 3);
    expect(s.writer.life.practice.book).toMatchObject({ holder: 'WR1-THOMAS', node: 'NEAR' });
    expect(s.writer.life.practice.pendingArrangement).toMatchObject({ caseId: 'scheduled-return', createdAt: clock + 2, executeAt: clock + 32 });
    expect(s.writer.life.cases['scheduled-return']).toMatchObject({ abilityApplied: false, result: 'NONE', arrangementEnd: 'PENDING', thomasWantsReturn: true });
    expect(s.progression.mastery[IDS[1]]).toBe(0); rejectWriter(s, { type: 'ARRANGE_RETURN' }); rejectWriter(s, { type: 'ORDINARY_RETURN' }); rejectWriter(s, { type: 'RETURN_HOME' });
    s = act(s, { type: 'WAIT_ARRANGEMENT' });
    expect(s.writer.life.practice.elapsedSeconds).toBe(clock + 32); expect(s.writer.life.practice.pendingArrangement).toBeNull();
    expect(s.writer.life.journal.at(-1)).toMatchObject({ elapsedSeconds: 30, ownerWalkedMetres: 0, bookTravelMetres: 6, participantWalks: [{ id: 'WR1-EVELYN', metres: 0 }, { id: 'WR1-THOMAS', metres: 6 }] });
    expect(s.writer.life.practice.book).toMatchObject({ holder: 'SHELF', node: 'FAR' }); expect(s.writer.life.practice.bell.rings).toBe(1); expect(s.writer.life.practice.participants[1]!.node).toBe('FAR');
    rejectWriter(s, { type: 'WAIT_ARRANGEMENT' }); rejectWriter(s, { type: 'CANCEL_ARRANGEMENT' }); rejectWriter(s, { type: 'ARRANGE_RETURN' });
    s = finish(s, 'scheduled-return'); expect(s.progression.mastery[IDS[1]]).toBe(8); expect(s.writer.life.practice.abilityUses[IDS[1]]).toEqual({ attempts: 1, successes: 1, applied: 1 });
  });

  it.each(['door', 'permission', 'cancel'] as const)('keeps paid successful casting but awards nothing when the pending event is invalidated by %s', mode => {
    let s = completeMutual(lifeState(true, true), true); s = giveThomasBook(begin(s, 'scheduled-return'));
    const spirit = s.spirituality, mind = s.mind; s = act(s, { type: 'ARRANGE_RETURN' });
    if (mode === 'door') s = act(s, { type: 'CLOSE_DOOR' }, { type: 'OPEN_DOOR' }, { type: 'WAIT_ARRANGEMENT' });
    if (mode === 'permission') s = act(s, { type: 'REVOKE_CONSENT', permission: 'ABILITY' });
    if (mode === 'cancel') s = act(s, { type: 'CANCEL_ARRANGEMENT' });
    expect(s.writer.life.practice.pendingArrangement).toBeNull(); expect(s.writer.life.practice.book.holder).toBe('WR1-THOMAS');
    expect(s.writer.life.cases['scheduled-return'].abilityApplied).toBe(false); expect(s.spirituality).toBe(spirit - 8); expect(s.mind).toBe(mind - 3);
    rejectWriter(s, { type: 'ARRANGE_RETURN' }); s = act(s, { type: 'ORDINARY_RETURN' }); s = finish(s, 'scheduled-return');
    expect(s.progression.mastery[IDS[1]]).toBe(0); expect(s.writer.life.practice.abilityUses[IDS[1]]).toEqual({ attempts: 1, successes: 1, applied: 0 });
    expect(s.writer.life.cases['scheduled-return'].result).toBe('ORDINARY');
  });

  it('charges a failed arrangement once and allows only an actual ordinary handoff afterward', () => {
    let s = completeMutual(lifeState(true, false), true); s = giveThomasBook(begin(s, 'scheduled-return')); const spirit = s.spirituality, mind = s.mind;
    s = act(s, { type: 'ARRANGE_RETURN' }); expect(s.writer.life.cases['scheduled-return'].arrangementEnd).toBe('FAILED'); expect(s.writer.life.practice.pendingArrangement).toBeNull();
    expect(s.spirituality).toBe(spirit - 8); expect(s.mind).toBe(mind - 3); rejectWriter(s, { type: 'WAIT_ARRANGEMENT' }); rejectWriter(s, { type: 'ARRANGE_RETURN' });
    s = act(s, { type: 'ORDINARY_RETURN' }); expect(s.writer.life.journal.at(-1)!.bookTravelMetres).toBe(6); s = finish(s, 'scheduled-return'); expect(s.progression.mastery[IDS[1]]).toBe(0);
  });

  it('honors third-case withdrawal, permits entirely ordinary completion and gives exactly three reports plus reflection', () => {
    let s = completeMutual(lifeState()); const spirit = s.spirituality, cursor = s.random.cursor;
    for (const id of ['scheduled-return', 'withdrawn-request'] as const) {
      s = begin(s, id, 'ORDINARY'); if (id === 'withdrawn-request') expect(s.writer.life.cases[id].permission.ability).toBe('WITHDRAWN');
      rejectWriter(s, { type: 'ARRANGE_RETURN' }); s = giveThomasBook(s); s = act(s, { type: 'ORDINARY_RETURN' }); s = finish(s, id);
    }
    s = act(s, { type: 'REFLECT' }); expect(s.progression.acting).toBe(100); expect(s.progression.mastery[IDS[0]]).toBe(0); expect(s.progression.mastery[IDS[1]]).toBe(0);
    expect(s.spirituality).toBe(spirit); expect(s.random.cursor).toBe(cursor); expect(s.writer.life.practice.participants.every(person => !person.present)).toBe(true);
    expect(WRITER_CASE_IDS.every(id => s.writer.life.cases[id].status === 'RESOLVED')).toBe(true); rejectWriter(s, { type: 'REFLECT' });
    expect(s.seer.completedSources.filter(source => source.startsWith('writer-case:'))).toHaveLength(3); expect(s.seer.completedSources.filter(source => source === 'writer-reflection')).toHaveLength(1);
  });

  it('withdraws material permission without confiscating originals and aborts by actual return walking', () => {
    let s = begin(lifeState(), 'mutual-clue', 'ORDINARY'); s = act(s, { type: 'TAKE_BOOK' }, { type: 'MOVE', to: 'NEAR' }, { type: 'REVOKE_CONSENT', permission: 'MATERIAL' });
    rejectWriter(s, { type: 'CHECK_BOOK' }); const clock = s.writer.life.practice.elapsedSeconds, travel = s.writer.life.practice.ownerWalkedMetres;
    s = act(s, { type: 'ABORT' }); expect(s.writer.life.cases['mutual-clue'].status).toBe('PAUSED'); expect(s.writer.life.practice.book.holder).toBe('SHELF');
    expect(s.writer.life.practice.ownerWalkedMetres).toBe(travel + 12); expect(s.writer.life.practice.elapsedSeconds).toBeGreaterThan(clock + 12);
    expect(s.writer.life.journal.at(-1)!.bookTravelMetres).toBe(6); expect(hasWriterLifeLock(s)).toBe(false); expect(s.writer.life.practice.participants.every(person => !person.present)).toBe(true);
  });

  it('requires a later real paid ordinary resumption and preserves the one failed outcome without another draw', () => {
    let s = begin(lifeState(false), 'mutual-clue'); s = act(s, { type: 'INTRODUCE' }, { type: 'MUTUAL_INSIGHT' }, { type: 'TAKE_BOOK' }, { type: 'ABORT' });
    const outcome = s.writer.life.cases['mutual-clue'].outcome, oldAttempts = s.writer.life.practice.abilityUses[IDS[0]].attempts;
    rejectWriter(s, { type: 'INVITE', caseId: 'mutual-clue', method: 'ORDINARY' }); s = nextActualWeek(s);
    rejectWriter(s, { type: 'INVITE', caseId: 'mutual-clue', method: 'ABILITY' }); const cash = s.cash, cursor = s.random.cursor;
    s = act(s, { type: 'INVITE', caseId: 'mutual-clue', method: 'ORDINARY' }, { type: 'ENTER_ROOM' }); expect(s.cash).toBe(cash - 20); rejectWriter(s, { type: 'MUTUAL_INSIGHT' });
    s = finish(readAndReturn(s), 'mutual-clue'); expect(s.random.cursor).toBe(cursor); expect(s.writer.life.cases['mutual-clue'].outcome).toBe(outcome);
    expect(s.writer.life.practice.abilityUses[IDS[0]].attempts).toBe(oldAttempts); expect(s.progression.mastery[IDS[0]]).toBe(0); expect(projectWriterLife(s).cases[0]!.attempts).toHaveLength(2);
  });

  it('rejects tampering of originals, knowledge, permissions, public budget, seeded checks, cursor and normal calendar', () => {
    let s = begin(lifeState(), 'mutual-clue'); s = act(s, { type: 'INTRODUCE' }, { type: 'MUTUAL_INSIGHT' });
    const edits: ((state: SliceState) => void)[] = [
      x => { x.writer.life.practice.book.id = 'COPY' as 'WR1-RETURN-BOOK'; },
      x => { x.writer.life.practice.participants[0]!.age = 17; },
      x => { x.writer.life.practice.participants.push(structuredClone(x.writer.life.practice.participants[0]!)); },
      x => { x.writer.life.practice.introduction!.name = 'invented'; },
      x => { x.writer.life.sourceRecord!.reportDigest = '0'.repeat(64); },
      x => { x.writer.life.practice.knownClues[0]!.text = 'unbounded private secrets'; },
      x => { x.writer.life.cases['mutual-clue'].permission.ability = 'WITHDRAWN'; },
      x => { x.writer.life.practice.ownerNode = 'NEAR'; },
      x => { x.writer.life.practice.ownerWalkedMetres = 0; },
      x => { x.writer.life.journal.at(-1)!.after.spirituality++; },
      x => { x.writer.life.journal.at(-1)!.randomCursor++; },
      x => { x.writer.life.journal.at(-1)!.randomAfter!++; },
      x => { x.writer.life.journal.at(-1)!.checkBase = 0; },
      x => { const check = x.writer.life.journal.at(-1)!.check!; check.roll = check.roll === 1 ? 2 : 1; },
      x => { x.writer.life.journal.at(-1)!.revision = 1; },
      x => { x.writer.life.journal.at(-1)!.date.day = x.writer.life.journal.at(-1)!.date.day === 1 ? 2 : 1; },
      x => { x.spirituality++; }, x => { x.random.cursor++; },
      x => { (x.writer.life.journal.at(-1)! as unknown as Record<string, unknown>).command = null; },
    ];
    for (const edit of edits) { const changed = structuredClone(s); edit(changed); expect(validateWriterLife(changed)).toBe(false); }
    const reordered = JSON.parse(stableStringify(s)) as SliceState; expect(validateWriterLife(reordered)).toBe(true); expect(projectWriterLife(reordered)).toEqual(projectWriterLife(s));
    expect(validateWriterActivityCommand({ type: 'MUTUAL_INSIGHT', known: true })).toBe(false);
    expect(validateWriterActivityCommand({ type: 'MOVE', to: 'FAR', metres: 0 })).toBe(false);
    expect(blockWriterActivity(s, { type: 'MUTUAL_INSIGHT' })).not.toBeNull();
    expect(writerLifeActions(s).filter(action => action.preferredAction && action.enabled)).toHaveLength(1);
  });
});
