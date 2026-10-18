import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../dist/domain/slice/index.js';
const natural=JSON.parse(readFileSync('tests/fixtures/miracle-worker-v01640/continuation.json','utf8'));
const original=natural.combatStart,boundaries={};let found;
// Explicit directed coverage only: vary the starting test RNG cursor, never mutate natural capture.
// No invented wounds, foe, death or pending record. The actual public round must create PLAYER_DEAD.
for(let cursor=0;cursor<1000;cursor++){
 const before=structuredClone(original);before.random.cursor=cursor;assertValidSliceState(before);
 const lastIntent={type:'COMBAT_ROUND',stance:'ATTACK'};const final=applySliceIntent(before,lastIntent);assertValidSliceState(final);
 if(final.status==='REVIVAL_PENDING'){found={beforeLast:before,lastIntent,final};break;}
}
assert(found,'directed death cursor must be found');boundaries['directed-real-death']=found;
let s=structuredClone(found.final);const pending=structuredClone(s),id=s.miracleWorker.revival.pendingDeathId;
const go=(c,key)=>{const beforeLast=structuredClone(s),lastIntent={type:'MIRACLE_WORKER',command:c};s=applySliceIntent(s,lastIntent);assertValidSliceState(s);boundaries[key]={beforeLast,lastIntent,final:structuredClone(s)};};
go({type:'WAIT_REVIVAL',deathId:id},'wait-30');go({type:'REVIVE_NEARBY',deathId:id,confirmed:true},'first-revival');const revived=structuredClone(s);
assert.equal(s.miracleWorker.revival.used,1);assert.equal(s.health,30);assert.equal(s.mind,pending.mind);assert.equal(s.spirituality,pending.spirituality);assert.deepEqual(s.injuries,pending.injuries);assert.deepEqual(s.random,pending.random);
go({type:'ENCOUNTER_RECOVER_ORIGINALS'},'real-originals-recovered');go({type:'ENCOUNTER_LEAVE'},'ordinary-exit');const exited=structuredClone(s);
s=structuredClone(pending);go({type:'FORFEIT_REVIVAL',deathId:id,confirmed:true},'forfeit');const forfeited=structuredClone(s);
s=structuredClone(pending);for(let n=1;n<=4;n++)go({type:'WAIT_REVIVAL',deathId:id},`expiry-wait-${n}`);const expired=structuredClone(s);
assert.equal(expired.status,'DEAD');assert.equal(forfeited.status,'DEAD');assert.equal(expired.miracleWorker.revival.used,0);
const provenance={kind:'DIRECTED_REAL_COMBAT_DEATH_FROM_NATURAL_S2_START',naturalSource:'tests/fixtures/miracle-worker-v01640/continuation.json',changedFields:['random.cursor'],naturalCursor:original.random.cursor,directedCursor:found.beforeLast.random.cursor,naturalResultUnchanged:true};
writeFileSync('tests/fixtures/miracle-worker-v01640/directed-revival.json',JSON.stringify({provenance,pending,revived,exited,forfeited,expired,boundaries}));
console.log(JSON.stringify({passed:true,provenance,boundaries:Object.keys(boundaries),pendingStatus:pending.status,revivedStatus:revived.status,revivalUsed:revived.miracleWorker.revival.used,exit:exited.miracleWorker.encounter.location,expired:expired.status,forfeited:forfeited.status,pendingActions:projectSliceState(pending).miracleWorker.actions.map(a=>a.command.type)}));
