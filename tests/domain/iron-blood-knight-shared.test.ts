import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const captureFixturePaths: Record<string, string> = {
  "iron-blood-knight-stage-natural": "tests/fixtures/iron-blood-knight-v01180/natural.json",
};
const read=(name:string)=>{
 const raw=JSON.parse(readFileSync(captureFixturePaths[name] ?? `tests/fixtures/release-legacy-output-v0177/${name}.json`,'utf8')),bytes=JSON.stringify(raw),value={...raw};
 for(const key of ['guidanceStart','promoted','practiced','combatStart','beforeLast','final'] as const)if(raw[key])value[key]=migrateSliceState(raw[key]);
 expect(JSON.stringify(raw)).toBe(bytes);return value;
};
describe('Iron Blood Knight actual public route',()=>{
 it('retains the old complete Reaper route and actual 30-person shared growth',()=>{
  const c=read('iron-blood-knight-stage-natural'),s=c.final as SliceState;assertValidSliceState(s);
  const old=JSON.parse(readFileSync('tests/fixtures/reaper-v0960/natural.json','utf8'));
  expect(c.commands.slice(0,c.prefixCount)).toEqual(old.commands);expect(c.prefixCount).toBe(old.commands.length);
  expect(s.progression.sequence).toBe(4);expect(c.practiced.progression.acting).toBe(100);
  expect(s.ironBloodKnight.team.members).toHaveLength(30);
  for(const m of s.ironBloodKnight.team.members){expect(m.joined).toBe(true);expect(m.cohortActivities).toHaveLength(3);expect(new Set(m.cohortActivities.map(a=>a.week)).size).toBe(3);expect(m.exerciseWeeks).toHaveLength(2);expect(m.experience).toBe(5);}
  expect(s.ironBloodKnight.promotionWeek!-s.ironBloodKnight.team.firstJoinedWeek!).toBeGreaterThanOrEqual(6);
  expect(s.ironBloodKnight.originalGender).toBe(old.final.character.gender);expect(s.character.gender).toBe('MALE');
  for(const k of ['hunter','provoker','pyromaniac','conspirator','reaper'] as const)expect(s[k]).toEqual(c.guidanceStart[k]);
  expect(Object.keys(s.progression.mastery).filter(k=>!Object.hasOwn(c.guidanceStart.progression.mastery,k))).toEqual(['hunter.s4.flame-steel','hunter.s4.comrade-link']);
  expect(s.ironBloodKnight.life.practice).toMatchObject({activeCase:null,form:'HUMAN',ownerNode:'NEAR',linkedMemberIds:[],beam:{holder:'CRADLE'},crate:{holder:'CRADLE'}});
  expect(projectSliceState(s).reaper.acting).toBe(100);
 });
 it.each(['join','team-activity','exercise','rite','promotion','link','load','unlink','return','flame','close','report','companions','combat'])('replays actual %s save boundary without changing original inputs',key=>{
  const b=read(`iron-blood-knight-${key}-save-boundary`),before=structuredClone(b.beforeLast),after=applySliceIntent(b.beforeLast,b.lastIntent);
  expect(after).toEqual(b.final);expect(b.beforeLast).toEqual(before);assertValidSliceState(after);
  expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);expect(projectSliceState(after)).toEqual(projectSliceState(b.final));
 });
 it('retains real member health costs after stopping the life link and after combat',()=>{
  const load=read('iron-blood-knight-load-save-boundary'),stop=read('iron-blood-knight-unlink-save-boundary');
  for(const id of ['IB4-01','IB4-02']){
   const find=(s:SliceState)=>s.ironBloodKnight.team.members.find(m=>m.id===id)!;
   expect(find(load.final).health).toBe(find(load.beforeLast).health-1);
   expect(find(stop.final).health).toBe(find(stop.beforeLast).health);expect(find(stop.final).present).toBe(false);
  }
  const c=read('iron-blood-knight-stage-natural');expect(c.final.combat).toBeNull();expect(c.final.ironBloodKnight.encounter.status).not.toBe('FIGHTING');
  expect(c.final.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);expect(c.final.combatHistory.length).toBeGreaterThan(c.practiced.combatHistory.length);
 });
 it('migrates the actual 0.117 full save without changing any old field',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/bizarro-sorcerer-v01170/natural.json','utf8')).final,bytes=JSON.stringify(old),s=migrateSliceState(old);
  for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect((s as unknown as Record<string,unknown>)[key]).toEqual(old[key]);
  expect(s.ironBloodKnight.guidanceKnown).toBe(false);assertValidSliceState(s);expect(migrateSliceState(s)).toEqual(s);expect(JSON.stringify(old)).toBe(bytes);
 });
});
