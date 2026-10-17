const currentCapture=(v:any)=>Object.fromEntries(Object.entries(v).map(([k,x])=>[k,x&&typeof x==='object'&&'schemaVersion'in x&&'runId'in x?migrateSliceState(x):x]));
import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const read=(name:string)=>currentCapture(name==='fire-thief-stage-natural'?JSON.parse(readFileSync('tests/fixtures/fire-thief-v0840/natural.json','utf8')):JSON.parse(readFileSync('tests/fixtures/fire-thief-v0840/boundaries.json','utf8'))[name.replace('fire-thief-','').replace('-save-boundary','')]);
describe('fire thief actual shared route',()=>{
 it('keeps prior growth and each real source restored after practice',()=>{
  const s=read('fire-thief-stage-natural').final as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(6);expect(s.fireThief.promotionWeek).toBeGreaterThanOrEqual(s.cryptologist.promotionWeek!+12);
  expect(s.fireThief.cryptologistActingAtPromotion).toBe(100);expect(s.progression.acting).toBe(100);
  expect(Object.values(s.fireThief.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
  for(const id of ['borrowed-flash','separate-windows'])expect(s.fireThief.cases[id]).toMatchObject({sourceRestored:true,usedCount:2,playerExpiredObserved:true});
  expect(s.fireThief.loan.playerSteps).toBe(0);expect(s.fireThief.loan.targetSteps).toBe(0);
 });
 it.each(['promotion','steal','use','expired','close','combat'])('replays %s from the original natural boundary',key=>{
  const b=read(`fire-thief-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);
  expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('shows personal expiry while the source is still disabled and requires real waiting',()=>{
  const b=read('fire-thief-expired-save-boundary'),s=b.final as SliceState,caseId=b.lastIntent.command.caseId;
  expect(s.fireThief.loan.playerSteps).toBe(0);expect(s.fireThief.loan.targetSteps).toBe(1);
  expect(s.spirituality).toBe(b.beforeLast.spirituality-2);expect(s.actionsRemaining).toBe(b.beforeLast.actionsRemaining);expect(s.week).toBe(b.beforeLast.week);
  expect(()=>applySliceIntent(s,{type:'FIRE_THIEF',command:{type:'USE',caseId}})).toThrow();
  expect(()=>applySliceIntent(s,{type:'ACTION',action:'WORK'})).toThrow();
  const after=applySliceIntent(s,{type:'FIRE_THIEF',command:{type:'CLOSE',caseId}});
  expect(after.fireThief.cases[caseId]!.sourceRestored).toBe(true);expect(after.fireThief.loan.targetSteps).toBe(0);
  expect(projectSliceState(after).fireThief.insideCase).toBe(false);
 });
 it('does not restore the current borrower for free or grant a permanent ability',()=>{
  const c=read('fire-thief-stage-natural');expect(c.final.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
  expect(c.final.town.clubLocation).toBe(c.combatStart.town.clubLocation);
  expect(Object.keys(c.final.progression.mastery).some(k=>k.startsWith('sun.')||k.startsWith('door.'))).toBe(false);
  expect(c.final.fireThief.encounter.battleLoan.playerRounds).toBe(0);expect(c.final.fireThief.encounter.battleLoan.targetRounds).toBe(0);
 });
 it('migrates full prior Recorder save with original records and all old facts unchanged',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/recorder-v0830/natural.json','utf8')).final,current=migrateSliceState(old);
  expect(current.fireThief.promotionWeek).toBeNull();
  const{fireThief:_,schemaVersion:__,contentVersion:___,...facts}=current;
  const{schemaVersion:____,contentVersion:_____,...prior}=old;for(const k of Object.keys(prior))expect((facts as any)[k]).toEqual(prior[k]);
 });
});
