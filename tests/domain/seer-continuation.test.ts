import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createSliceRun,applySliceIntent,assertValidSliceState,projectSliceState,validateSlicePayload} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import {applySeerCommand} from '../../src/domain/seer/index.js';
import {resolveNormalCheck} from '../../src/resolution/normal-check.js';
const capture=JSON.parse(readFileSync(new URL('../fixtures/seer-v030/natural.json',import.meta.url),'utf8'));
describe('continuing an actual surviving first case',()=>{
 it('migrates real 0.3.0 terminal without rewriting any old fact',()=>{
  const old=structuredClone(capture.final), bytes=JSON.stringify(old), s=migrateSliceState(old);
  const previous:Record<string,unknown>=structuredClone(s) as unknown as Record<string,unknown>;
  const fresh=createSliceRun(old.runId,capture.creation,capture.seed),defaults=fresh as unknown as Record<string,unknown>;
  expect(Object.keys(s).sort()).toEqual(Object.keys(fresh).sort());
  for(const key of Object.keys(previous))if(!Object.hasOwn(old,key)){expect(previous[key],key).toEqual(defaults[key]);delete previous[key];}
  expect(s.seer.resupply).toEqual({requestedWeek:null,deliveries:0});expect(s.seer.practice).toEqual(fresh.seer.practice);
  delete (previous.seer as Record<string,unknown>).resupply;delete (previous.seer as Record<string,unknown>).practice;
  expect([s.schemaVersion,s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION,CURRENT_CONTENT_VERSION]);
  previous.schemaVersion=old.schemaVersion;previous.contentVersion=old.contentVersion;
  expect(previous).toEqual(old);expect(JSON.stringify(old)).toBe(bytes);expect(migrateSliceState(s)).toEqual(s);assertValidSliceState(s);
 });
 it('keeps original ending and world, allows ordinary rest without restarting the first case',()=>{
  const before=migrateSliceState(capture.final),s=applySliceIntent(before,{type:'CONTINUE_LIFE'});
  expect(s.status).toBe('ACTIVE');expect(s.caseArchive).toEqual([before.ending]);expect(s.ending).toBeNull();expect(s.world).toEqual(before.world);expect(s.combatHistory).toEqual(before.combatHistory);expect(s.random).toEqual(before.random);expect(s.actionsRemaining).toBe(before.actionsRemaining);expect(s.arc.stage).toBe('ENDED');assertValidSliceState(s);
  const rest=applySliceIntent(s,{type:'ACTION',action:'REST'});expect(rest.health).toBeGreaterThan(s.health);expect(rest.caseArchive).toEqual(s.caseArchive);expect(rest.world).toEqual(s.world);expect(projectSliceState(rest).seer.practice.cases).toHaveLength(8);assertValidSliceState(rest);
  expect(()=>applySliceIntent(rest,{type:'CONTINUE_LIFE'})).toThrow();
 });
 it('settles an unfinished last-AP week after continuing, without refunding actions',()=>{
  const s=migrateSliceState(capture.final);s.actionsRemaining=0;const next=applySliceIntent(s,{type:'CONTINUE_LIFE'});expect(next.week).toBe(s.week+1);expect(next.actionsRemaining).toBe(3);expect(next.cash).toBeLessThan(s.cash);assertValidSliceState(next);
 });
 it('never lets a dead archive resume and accepts only the exact public command',()=>{
  const s=migrateSliceState(capture.final);s.status='DEAD';s.ending!.kind='DEATH';expect(()=>applySliceIntent(s,{type:'CONTINUE_LIFE'})).toThrow();expect(validateSlicePayload({type:'CONTINUE_LIFE'})).toBe(true);expect(validateSlicePayload({type:'CONTINUE_LIFE',cash:999})).toBe(false);
 });
});


describe('first commission save and public reply routing', () => {
 for (const approachId of ['report-bounded', 'report-cause']) it(`restores OBSERVED and persists ${approachId} through the real slice router`, () => {
  const s = applySliceIntent(migrateSliceState(capture.final), { type: 'CONTINUE_LIFE' });
  applySeerCommand(s, { type: 'PRACTICE', caseId: 'folded-bookmark', approachId: 'sight' }, {
   check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: 20 }),
   roll: min => min, note: () => {},
  });
  const pending = JSON.parse(JSON.stringify(s)) as typeof s;
  expect(pending.seer.practice.cases[0]!.status).toBe('OBSERVED');
  assertValidSliceState(pending);
  expect(migrateSliceState(pending)).toEqual(pending);
  const payload = { type: 'SEER' as const, command: { type: 'PRACTICE' as const, caseId: 'folded-bookmark', approachId } };
  expect(validateSlicePayload(payload)).toBe(true);
  const replied = applySliceIntent(pending, payload);
  assertValidSliceState(replied);
  expect(replied.seer.practice.cases[0]!.status).toBe(approachId === 'report-bounded' ? 'COMPLETED' : 'DISPUTED');
  expect(replied.actionsRemaining).toBe(pending.actionsRemaining);
  expect(replied.spirituality).toBe(pending.spirituality);
  expect(replied.cash - pending.cash).toBe(approachId === 'report-bounded' ? 12 : 0);
  expect(replied.caseArchive).toEqual(pending.caseArchive);
 });
});
