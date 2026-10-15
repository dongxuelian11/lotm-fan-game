import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
const captureFixturePaths: Record<string, string> = {
  "faceless-stage-natural": "../fixtures/faceless-v0730/natural.json",
};
const read = (name:string) => JSON.parse(readFileSync(new URL(captureFixturePaths[name] ?? `../fixtures/release-legacy-output-v0177/${name}.json`, import.meta.url),'utf8'));
const natural = () => read('faceless-stage-natural');
describe('faceless real shared route',()=>{
 it('has actual S9 to S6 history, one real S6 promotion and three completed distinct reports',()=>{
  const c=natural(),s=migrateSliceState(c.final);assertValidSliceState(s);
  expect(s.progression.sequence).toBe(6);expect(s.faceless.promotionWeek).toBeGreaterThanOrEqual(s.magician.promotionWeek!+12);
  expect(s.faceless.magicianActingAtPromotion).toBe(100);expect(s.progression.acting).toBe(100);
  expect(Object.values(s.faceless.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
  expect(s.faceless.outfit.location).toBe('WARDROBE');expect(s.faceless.outfit.loans).toBe(s.faceless.outfit.returns);
  expect(projectSliceState(s).maxSpirituality).toBe(80);
 });
 it.each(['promotion','appearance','restore','close','report','combat'])('replays %s at the original seed and retains full serialized state',(key)=>{
  const b=read(`faceless-${key}-save-boundary`);const after=applySliceIntent(migrateSliceState(b.beforeLast),b.lastIntent);
  expect(after).toEqual(migrateSliceState(b.final));assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('does not restore appearance or return a borrowed outfit when the actual contact closes',()=>{
  const b=read('faceless-close-save-boundary');expect(b.beforeLast.faceless.appearance.templateId).not.toBe('SELF');
  expect(b.final.faceless.appearance).toEqual(b.beforeLast.faceless.appearance);expect(b.final.faceless.outfit).toEqual(b.beforeLast.faceless.outfit);
  expect(b.final.character).toEqual(b.beforeLast.character);
 });
 it('retains changed appearance through actual battle and does not acquire the opponent club',()=>{
  const c=natural();expect(c.final.faceless.appearance).toEqual(c.combatStart.faceless.appearance);
  expect(c.final.faceless.appearance.templateId).toBe('STAGE_DOUBLE');expect(c.final.town.clubLocation).toBe(c.combatStart.town.clubLocation);
  expect(c.final.faceless.encounter.status).not.toBe('FIGHTING');expect(c.final.combat).toBeNull();
 });
 it('migrates the complete prior harvestpriest save without altering existing fields',()=>{
  const old=JSON.parse(readFileSync(new URL('../fixtures/harvestpriest-v0710/natural.json',import.meta.url),'utf8')).final;
  const bytes=JSON.stringify(old),current=migrateSliceState(old);expect(current.faceless.promotionWeek).toBeNull();
  const {schemaVersion,contentVersion,...prior}=old;
  const facts=Object.fromEntries(Object.entries(current).filter(([key])=>Object.prototype.hasOwnProperty.call(prior,key)));expect(facts).toEqual(prior);
  assertValidSliceState(current);expect(JSON.stringify(old)).toBe(bytes);expect(migrateSliceState(current)).toEqual(current);
 });
});
