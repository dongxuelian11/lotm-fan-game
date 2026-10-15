import { stableStringify } from '../../src/domain/canonical.js';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createSilverKnightState, hasSilverKnightLock } from '../../src/domain/silver-knight/index.js';
import { SILVER_KNIGHT_ABILITY_IDS } from '../../src/domain/silver-knight/types.js';

interface Capture { creation: Parameters<typeof createSliceRun>[1]; seed: string; prefixCount: number; commands: SliceIntent[]; departureStart?: SliceState; promoted?: SliceState; practiced?: SliceState; final: SliceState }
interface Original { creation: Parameters<typeof createSliceRun>[1]; seed: string; commands: SliceIntent[]; final: SliceState }
interface Boundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
const path = 'tests/fixtures/silver-knight-v01520/';
const original = (): Original => JSON.parse(readFileSync('tests/fixtures/demon-hunter-v01290/natural.json', 'utf8'));
const capture = (): Capture => JSON.parse(readFileSync(`${path}natural.json`, 'utf8'));
const roots = ['warrior', 'gladiator', 'weaponmaster', 'dawnPaladin', 'guardian', 'demonHunter'] as const;
function originals(s: SliceState, before = original().final) {
  for (const root of roots) expect(s[root]).toEqual(before[root]); expect(s.random.seed).toBe(before.random.seed); expect(s.runId).toBe(before.runId); expect(s.character.gender).toBe(before.character.gender);
  expect(s.demonHunter.encounter).toMatchObject({ targetId: 'DH4-CINDER-GUARD', enemyHealth: 70, enemySpirituality: 14, enemyStatus: 'SURRENDERED' }); expect(s.demonHunter.encounter.coatings.filter(c => c.status === 'SEALED')).toHaveLength(1);
}

describe('Silver Knight full untouched340-command prefix and actual continuation', () => {
  it('migrates W93 without refilling, resetting old originals or consuming RNG', () => {
    const prior = original(), bytes = JSON.stringify(prior.final), s = migrateSliceState(prior.final);
    expect(prior.commands).toHaveLength(340); expect(s.schemaVersion).toBe(174); expect(s.contentVersion).toBe('calamity-demoness-v174'); expect(s.silverKnight).toEqual(createSilverKnightState());
    expect(s).toMatchObject({ week: 93, status: 'ACTIVE', health: 100, mind: 100, spirituality: 112, cash: 490, actionsRemaining: 1, progression: { pathwayId: 'warrior', sequence: 4, acting: 100 } });
    for (const [key, value] of Object.entries(prior.final)) if (!['schemaVersion', 'contentVersion'].includes(key)) expect((s as unknown as Record<string, unknown>)[key]).toEqual(value);
    originals(s); expect(s.random).toEqual(prior.final.random); expect(JSON.stringify(prior.final)).toBe(bytes); expect(migrateSliceState(s)).toEqual(s); assertValidSliceState(s);
  });
  it('replays new creation plus every original command without changing seed or assuming hunt success', () => {
    const data = capture(), prior = original(); expect(data.prefixCount).toBe(340); expect(data.commands.length).toBeGreaterThan(340); expect(data.commands.slice(0, 340)).toEqual(prior.commands); expect(data.creation).toEqual(prior.creation); expect(data.seed).toBe('warrior-natural-v042'); expect(data.seed).toBe(prior.seed);
    let s = createSliceRun(data.final.runId, data.creation, data.seed);
    for (const [index, command] of data.commands.entries()) { s = applySliceIntent(s, command); if (index === 339) { expect(s).toEqual(migrateSliceState(prior.final)); if (data.departureStart) expect(s).toEqual(migrateSliceState(data.departureStart)); } }
    expect(s).toEqual(migrateSliceState(data.final)); assertValidSliceState(s); originals(s);
    if (s.status === 'DEAD') { expect(s.health).toBe(0); expect(s.ending?.kind).toBe('DEATH'); }
    else expect(s.health).toBeGreaterThan(0);
  }, 60_000);
  it('each saved actual boundary commits deterministically without mutating submitted originals', () => {
    const boundaries = JSON.parse(readFileSync(`${path}boundaries.json`, 'utf8')) as Record<string, Boundary>; expect(Object.keys(boundaries).length).toBeGreaterThan(0);
    for (const boundary of Object.values(boundaries)) { const before = migrateSliceState(boundary.beforeLast), final = migrateSliceState(boundary.final), bytes = JSON.stringify(before), command = JSON.stringify(boundary.lastIntent); assertValidSliceState(before); assertValidSliceState(final); expect(applySliceIntent(before, boundary.lastIntent)).toEqual(final); expect(JSON.stringify(before)).toBe(bytes); expect(JSON.stringify(boundary.lastIntent)).toBe(command); originals(final); }
  }, 60_000);
  it('natural original hunt outcome and actual remains always agree; surrender never supplies a ritual slot', () => {
    const s = migrateSliceState(capture().final); assertValidSliceState(s);
    for (const remains of s.silverKnight.encounter.remains) { const originalBody = s.silverKnight.encounter.hunts.find(h => h.id === remains.instanceId)!; expect(originalBody).toBeTruthy(); expect(originalBody).toMatchObject({ status: 'DEAD', enemyHealth: 0, enemyStatus: 'DEAD', remainsId: remains.id }); expect(originalBody.attempts.at(-1)!.terminal?.outcome).toBe('ENEMY_DEAD'); expect(remains.killedBy).toBe('PLAYER'); expect(remains.outcome).toBe('ENEMY_DEAD'); }
    for (const living of s.silverKnight.encounter.hunts.filter(h => h.status === 'SURRENDERED')) { expect(living.enemyHealth).toBeGreaterThan(0); expect(living.remainsId).toBeNull(); }
    const bodies = s.silverKnight.encounter.hunts; expect(new Set(bodies.map(b => b.id)).size).toBe(bodies.length); originals(s);
  });
  it('successful promotion, if reached naturally, preserves all inherited mastery and proves six consumed sources', () => {
    const data = capture(); if (!data.promoted) { expect(data.final.silverKnight.promotionWeek).toBeNull(); return; }
    const s = migrateSliceState(data.promoted); assertValidSliceState(s); originals(s); expect(s.progression.sequence).toBe(3); expect(s.silverKnight.demonHunterActingAtPromotion).toBe(100); expect(s.silverKnight.promotionWeek! - s.demonHunter.promotionWeek!).toBeGreaterThanOrEqual(12);
    const successful = s.silverKnight.ritual.attempts.find(a => a.status === 'CONSUMED' && ['SUCCESS', 'GREAT_SUCCESS'].includes(a.outcome ?? ''))!; expect(successful.remainsIds).toHaveLength(6); expect(new Set(successful.remainsIds).size).toBe(6); expect(s.silverKnight.ritual.meetings.find(m => m.blessing?.id === successful.blessingId)?.blessing?.status).toBe('CONSUMED');
    for (const [id, value] of Object.entries(original().final.progression.mastery)) expect(s.progression.mastery[id]).toBe(value); for (const id of SILVER_KNIGHT_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    const bytes = JSON.stringify(s); expect(() => applySliceIntent(s, { type: 'DEMON_HUNTER', command: { type: 'LEARN_GUIDANCE' } })).toThrow(); expect(JSON.stringify(s)).toBe(bytes);
  });
  it('three real reports and reflection, if reached, award only actual successful abilities', () => {
    const data = capture(); if (!data.practiced) return; const s = migrateSliceState(data.practiced); assertValidSliceState(s); originals(s);
    expect(s.progression.acting).toBe(100); expect(s.silverKnight.life.reflected).toBe(true); expect(hasSilverKnightLock(s)).toBe(false); expect(s.seer.completedSources).toContain('silver-knight-reflection');
    for (const scene of Object.values(s.silverKnight.life.cases)) expect(scene.status).toBe('RESOLVED');
  });
  it('does not promise unknown higher sequences or add blessing-specific silver powers', () => {
    const s = migrateSliceState(capture().final), view = projectSliceState(s).silverKnight; expect(view.formulaKnown).toBe(false); expect(view.formula).toEqual([]);
    expect(view.risk).toContain('不补满'); expect(view.story).toContain('精确布局'); expect(view.story).toContain('天使'); expect(SILVER_KNIGHT_ABILITY_IDS).toEqual(['warrior.s3.silver-armor', 'warrior.s3.light-concealment', 'warrior.s3.silver-thrust']);
  });
  it('replays a separately declared directed continuation only from its own explicit starting state, when supplied', () => {
    if (!existsSync(`${path}directed.json`)) return;
    const directed = JSON.parse(readFileSync(`${path}directed.json`, 'utf8')) as { startingState: SliceState; commands: SliceIntent[]; final: SliceState; provenance: string };
    expect(typeof directed.provenance).toBe('string'); expect(directed.provenance.length).toBeGreaterThan(0); let s = migrateSliceState(directed.startingState); assertValidSliceState(s); const old = structuredClone(s);
    for (const command of directed.commands) s = applySliceIntent(s, command); expect(s).toEqual(migrateSliceState(directed.final)); assertValidSliceState(s); originals(s, old);
  }, 60_000);
  it('replays every explicitly selected RNG boundary without claiming a natural hunt', () => {
    const data = JSON.parse(readFileSync(`${path}directed-segments.json`, 'utf8')) as {provenance: string; segments: Boundary[]};
    expect(data.provenance).toContain('DIRECTED'); expect(data.segments).toHaveLength(8);
    for(const b of data.segments) { b.beforeLast=migrateSliceState(b.beforeLast);b.final=migrateSliceState(b.final);assertValidSliceState(b.beforeLast); assertValidSliceState(b.final); expect(applySliceIntent(b.beforeLast,b.lastIntent)).toEqual(b.final); originals(b.final); }
  });
  it('replays the complete directed setup with each cursor intervention declared, keeping both natural living surrenders', () => {
    const data=JSON.parse(readFileSync(`${path}directed-setup.json`,'utf8')) as {provenance:string;startingState:SliceState;commands:SliceIntent[];adjustments:{commandIndex:number;cursorBefore:number;selectedCursor:number}[];final:SliceState};
    expect(data.provenance).toContain('DIRECTED'); let s=migrateSliceState(data.startingState);expect(s).toEqual(migrateSliceState(capture().final));
    for(const [i,command]of data.commands.entries()){const change=data.adjustments.find(a=>a.commandIndex===i);if(change){expect(s.random.cursor).toBe(change.cursorBefore);s.random.cursor=change.selectedCursor;}s=applySliceIntent(s,command);}
    expect(s).toEqual(migrateSliceState(data.final));assertValidSliceState(s);originals(s);
    for(const id of ['SK3-HUNT-ROCK_HUSK-1','SK3-HUNT-ROCK_HUSK-2'])expect(s.silverKnight.encounter.hunts.find(h=>h.id===id)).toMatchObject({status:'SURRENDERED',enemyHealth:70,remainsId:null});
    expect(s.silverKnight.encounter.remains).toHaveLength(6);expect(s.silverKnight.encounter.remains.every(r=>r.status==='CONSUMED')).toBe(true);
  },60_000);

  it('restores the same original anchor after canonical SQLite key ordering', () => {
    const data=JSON.parse(readFileSync(`${path}directed.json`,'utf8'));const before=migrateSliceState(data.startingState);
    const restored=JSON.parse(stableStringify(before)) as SliceState;expect(restored).toEqual(before);assertValidSliceState(restored);
    expect(applySliceIntent(restored,data.commands[0])).toEqual(applySliceIntent(before,data.commands[0]));
  });

});
