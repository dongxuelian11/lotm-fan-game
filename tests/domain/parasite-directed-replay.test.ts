import {migrateSliceState} from '../../src/domain/slice/migration.js';
import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState} from '../../src/domain/slice/index.js';
const read=(name:string)=>JSON.parse(readFileSync(`tests/fixtures/parasite-v01280/${name}.json`,'utf8'));
describe('Parasite explicit directed RNG branch, not natural successful theft',()=>{
 it('changes only disclosed starting RNG and replays every public battle command',()=>{
  const c=read('directed'),natural=read('natural');expect(c.provenance).toBe('DIRECTED_RNG_BRANCH');
  expect({...c.selectedInitial,random:natural.combatStart.random}).toEqual(natural.combatStart);
  let s=migrateSliceState(c.selectedInitial);for(const command of c.commands){s=applySliceIntent(s,command);assertValidSliceState(s);}expect(s).toEqual(migrateSliceState(c.final));
  expect(c.acquired.parasite.encounter.borrowed.length).toBeGreaterThan(0);
  expect(c.acquired.parasite.encounter.borrowed.every((p:any)=>p.sourceId===natural.combatStart.parasite.encounter.targetId)).toBe(true);
 });
 it('replays all recorded loan and closure boundaries without replacing body or original resources',()=>{
  const c=read('directed'),boundaries=read('directed-boundaries');expect(Object.keys(boundaries)).toEqual(c.boundaries);
  for(const b of Object.values(boundaries) as any[]){const after=applySliceIntent(migrateSliceState(b.beforeLast),b.lastIntent);expect(after).toEqual(migrateSliceState(b.final));assertValidSliceState(after);}
  for(const branch of Object.values(c.branches) as any[]){let s=migrateSliceState(c.selectedInitial);for(const command of branch.commands)s=applySliceIntent(s,command);expect(s).toEqual(migrateSliceState(branch.final));expect(s.parasite.encounter.borrowed.every((p:any)=>p.closedSeconds!==null)).toBe(true);}
 });
});
