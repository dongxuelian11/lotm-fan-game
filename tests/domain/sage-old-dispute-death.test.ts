import { describe, expect, it } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { validateScrollProfessorState } from '../../src/domain/scroll-professor/index.js';
import { promoted } from './sage-directed-helper.js';

describe('Sage death preserves only already-earned old Scroll Professor history', () => {
  it('retains an actual old resolved award after the later Sage body dies', () => {
    const s = promoted(), old = structuredClone(s.scrollProfessor), awards = [...s.seer.completedSources];
    expect(s.scrollProfessor.encounter.status).toBe('RESOLVED');
    expect(awards).toContain('scroll-professor-dispute');
    s.status = 'DEAD'; s.health = 0;
    expect(validateScrollProfessorState(s)).toBe(true);
    expect(s.scrollProfessor).toEqual(old); expect(s.seer.completedSources).toEqual(awards);
  });
  it('does not grant an award to a player dead during the original S6 stage', () => {
    const s = migrateSliceState(readObjectEntry<unknown>('tests/fixtures/scroll-professor-v0870/natural.json', 'final'));
    expect(s.progression.sequence).toBe(6); expect(validateScrollProfessorState(s)).toBe(true);
    expect(s.seer.completedSources).toContain('scroll-professor-dispute');
    s.status = 'DEAD'; s.health = 0;
    expect(validateScrollProfessorState(s)).toBe(false);
  });
  it('does not accept a lost original encounter or a missing later promotion as a historical award', () => {
    const s = promoted(); s.status = 'DEAD'; s.health = 0;
    s.scrollProfessor.encounter.status = 'LOST'; expect(validateScrollProfessorState(s)).toBe(false);
    const t = promoted(); t.status = 'DEAD'; t.health = 0; t.sage.promotionWeek = null;
    expect(validateScrollProfessorState(t)).toBe(false);
  });
});
