import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {createSliceRun,applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState,SliceIntent} from '../../src/domain/slice/types.js';
const read=()=>{const d=JSON.parse(readFileSync('tests/fixtures/dream-weaver-v01420/natural.json','utf8'));for(const k of ['departureStart','guidanceStart','promoted','practiced','combatStart','beforeLast','final'])if(d[k])d[k]=migrateSliceState(d[k]);return d;};
const old=()=>JSON.parse(readFileSync('tests/fixtures/manipulator-v01190/natural.json','utf8'));
describe('Dream Weaver original public route and shared runtime',()=>{
 it('replays the complete354 original commands and every new public choice with the original seed',()=>{
  const d=read(),prior=old();expect(prior.commands).toHaveLength(354);expect(d.commands.slice(0,354)).toEqual(prior.commands);expect(d.seed).toBe(prior.seed);
  let s=createSliceRun(d.final.runId,d.creation,d.seed);for(const c of d.commands)s=applySliceIntent(s,c);assertValidSliceState(s);expect(s).toEqual(d.final);
 },30000);
 it('migrates the originalS4 without altering seven donors, assemblies, old personas or the original surrendered Rulan',()=>{
  const d=old(),bytes=JSON.stringify(d.final),s=migrateSliceState(d.final);expect(s.schemaVersion).toBe(176);
  expect(s.dreamWeaver.promotionWeek).toBeNull();expect(s.dreamWeaver.preparations).toEqual([]);
  for(const key of Object.keys(d.final))if(!['schemaVersion','contentVersion'].includes(key))expect((s as unknown as Record<string,unknown>)[key]).toEqual(d.final[key]);
  expect(s.manipulator.promotionWeek).toBe(74);expect(s.progression.promotionWeek).toBe(5);expect(JSON.stringify(d.final)).toBe(bytes);
 });
 it('preserves all lower-stage originals and exposes the exact inherited mastery pool after promotion',()=>{
  const s=read().promoted as SliceState,prior=old().final as SliceState;assertValidSliceState(s);expect(s.progression.sequence).toBe(3);
  for(const key of ['audience','mindreader','psychologist','hypnotist','dreamwalker','manipulator'] as const)expect(s[key]).toEqual(prior[key]);
  expect(s.character.gender).toBe(prior.character.gender);expect(s.injuries).toEqual(prior.injuries);
  expect(Object.keys(s.progression.mastery).filter(id=>!Object.hasOwn(prior.progression.mastery,id))).toEqual(['audience.s3.external-identity','audience.s3.woven-image']);
  const p=projectSliceState(s);expect(p.manipulator.acting).toBe(100);expect(p.dreamwalker.acting).toBe(100);
  expect(p.dreamWeaver.abilities.map(a=>a.id).sort()).toEqual(Object.keys(s.progression.mastery).sort());
 });
 it('replays saved transaction boundaries and leaves input bytes unchanged',()=>{
  const d=JSON.parse(readFileSync('tests/fixtures/dream-weaver-v01420/boundaries.json','utf8')) as Record<string,{beforeLast:SliceState;lastIntent:SliceIntent;final:SliceState}>;
  for(const b of Object.values(d)){b.beforeLast=migrateSliceState(b.beforeLast);b.final=migrateSliceState(b.final);assertValidSliceState(b.beforeLast);assertValidSliceState(b.final);const bytes=JSON.stringify(b.beforeLast);expect(applySliceIntent(b.beforeLast,b.lastIntent)).toEqual(b.final);expect(JSON.stringify(b.beforeLast)).toBe(bytes);}
 },30000);
 it('finishes three distinct practices, returns the original paper and does not leave a copied actor or bell',()=>{
  const d=read(),s=d.practiced as SliceState;assertValidSliceState(s);expect(s.progression.acting).toBe(100);
  expect(Object.values(s.dreamWeaver.life.cases).every(c=>c.status==='RESOLVED')).toBe(true);
  const p=s.dreamWeaver.life.practice;expect(p.identity).toBeNull();expect(p.image).toBeNull();expect(p.ownerNode).toBe('NEAR');expect(p.message).toEqual({id:'DWV3-MESSAGE',ownerId:'DWV3-IRIS',holder:'FAR_DESK'});expect(p.bell.id).toBe('DWV3-BELL');
  expect(s.dreamWeaver.life.cases['original-message'].attempts.at(-1)?.ownerTravelMetres).toBe(12);
  const final=d.final as SliceState;assertValidSliceState(final);expect(final.combat).toBeNull();expect(final.dreamWeaver.encounter.status).not.toBe('FIGHTING');expect(final.combatHistory.some(r=>r.dreamWeaverOutcome)).toBe(true);expect(final.manipulator).toEqual(old().final.manipulator);
 });
 it('replays the separate living pre-combat exit without loading or reviving the dead terminal state',()=>{
  const d=JSON.parse(readFileSync('tests/fixtures/dream-weaver-v01420/peaceful-exit.json','utf8')),death=read();
  d.final=migrateSliceState(d.final);d.branchPoint=migrateSliceState(d.branchPoint);expect(d.differentChoiceFromDeathBranch).toBe(true);expect(d.sourcePrefixCount).toBe(439);expect(d.commands.slice(0,439)).toEqual(death.commands.slice(0,439));
  let s=createSliceRun(d.final.runId,d.creation,d.seed);for(const c of d.commands)s=applySliceIntent(s,c);
  expect(s).toEqual(d.final);expect(s.status).toBe('ACTIVE');expect(s.combat).toBeNull();expect(s.dreamWeaver.encounter.attemptWeek).toBeNull();expect(s.combatHistory).toEqual(d.branchPoint.combatHistory);
  expect(death.final.status).toBe('DEAD');expect(death.final.health).toBe(0);expect(death.final.dreamWeaver.encounter.mentalPlague).toBe(2);
 },30000);
 it('cannot consume, purchase or collect new tears for an oldS4 batch afterS3 promotion',()=>{
  const s=read().promoted as SliceState,bytes=JSON.stringify(s),batch=s.manipulator.batches.find(b=>b.status==='SUPPLIER')!;
  expect(()=>applySliceIntent(s,{type:'MANIPULATOR',command:{type:'BUY_MATERIALS',batchId:batch.id}})).toThrow();expect(JSON.stringify(s)).toBe(bytes);
 });
});
