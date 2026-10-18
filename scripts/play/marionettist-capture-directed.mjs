/** Directed integration test, NOT a natural seed result. Only the explicitly
 * listed random draws are injected; all commands, costs, bodies and saves use
 * the public implementation. The two natural death branches remain unchanged. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../dist/domain/slice/index.js';
import {DeterministicActionRandomStream} from '../../dist/resolution/deterministic-random.js';
import {SqliteSliceStore} from '../../dist/persistence/slice-store.js';
const route=JSON.parse(readFileSync('tests/fixtures/marionettist-v0950/natural.json','utf8'));
let s=structuredClone(route.combatStart);assertValidSliceState(s);
const initial=structuredClone(s),records=[];
function withRolls(rolls,operation){
 const original=DeterministicActionRandomStream.prototype.nextInt;let cursor=0;
 DeterministicActionRandomStream.prototype.nextInt=function(min,max){const normal=original.call(this,min,max);if(cursor>=rolls.length)return normal;const v=rolls[cursor++];assert(Number.isSafeInteger(v)&&v>=min&&v<=max,`directed roll ${v} outside ${min}..${max}`);return v;};
 try{const result=operation();assert.equal(cursor,rolls.length,'all specified test draws must be consumed');return result;}finally{DeterministicActionRandomStream.prototype.nextInt=original;}
}
const file=join(mkdtempSync(join(tmpdir(),'lotm-marionettist-directed-')),'capture.sqlite');let fail=false;
const open=()=>new SqliteSliceStore(file,{beforeWrite(){if(fail)throw new Error('directed save failure');}});
let app=open();app.repository.transaction(()=>{app.repository.put({state:s,updatedAt:'2026-10-12T14:50:00.000Z'});app.repository.selectRun(s.runId);});
function go(payload,rolls=[]){
 const before=structuredClone(s),after=withRolls(rolls,()=>applySliceIntent(before,payload));assertValidSliceState(after);
 const envelope={intentId:`directed-${records.length}`,runId:s.runId,expectedRevision:s.revision,payload};
 fail=true;const rejected=withRolls(rolls,()=>app.submitIntent(envelope));assert.equal(rejected.ok,false);assert.equal(rejected.error.code,'SAVE_FAILED');
 assert.deepEqual(app.repository.get(s.runId).state,before);assert.equal(app.repository.receipt(envelope.intentId),null);app.close();
 fail=false;app=open();assert.deepEqual(app.repository.get(s.runId).state,before);
 const saved=withRolls(rolls,()=>app.submitIntent(envelope));assert.equal(saved.ok,true);assert.deepEqual(saved.value.state,projectSliceState(after));assert.deepEqual(app.repository.get(s.runId).state,after);app.close();
 app=open();assert.deepEqual(app.repository.get(s.runId).state,after);const repeated=app.submitIntent(envelope);assert.equal(repeated.ok,true);assert.equal(repeated.value.replayed,true);assert.deepEqual(repeated.value.state,saved.value.state);assert.deepEqual(app.repository.get(s.runId).state,after);
 records.push({payload,injectedDraws:rolls,beforeLast:before,lastIntent:payload,final:after});s=after;
 console.log(JSON.stringify({type:payload.type==='MARIONETTIST'?payload.command.type:payload.type,week:s.week,ap:s.actionsRemaining,spirit:s.spirituality,target:s.marionettist.puppet.target?.status,passed:true}));
}
go({type:'COMBAT_ROUND',stance:'ATTACK'},[1,1,1,400,1,66]);
assert.equal(s.marionettist.puppet.target.status,'SURRENDERED');assert(s.marionettist.puppet.target.health>0);const fought=structuredClone(s.marionettist.puppet.target);
go({type:'MARIONETTIST',command:{type:'BEGIN_CAPTURE'}},[1]);assert.equal(s.marionettist.puppet.capture.elapsedSeconds,20);assert.equal(s.marionettist.puppet.target.alive,true);
go({type:'MARIONETTIST',command:{type:'COMPLETE_CAPTURE',confirmedDeath:true}},[1]);assert.equal(s.marionettist.puppet.capture.elapsedSeconds,300);assert.equal(s.marionettist.puppet.target.alive,false);assert.equal(s.actionsRemaining,0);
const master=s.spirituality,body=s.marionettist.puppet.target.spirituality;
go({type:'MARIONETTIST',command:{type:'PUPPET_DELIVER'}});assert.equal(s.spirituality,master-2);assert.equal(s.marionettist.puppet.target.spirituality,body-1);assert.equal(s.actionsRemaining,0);assert.equal(s.marionettist.puppet.note.deliveries,1);assert.equal(s.marionettist.puppet.note.location,'RECIPIENT_TABLE');
go({type:'MARIONETTIST',command:{type:'DISMISS_PUPPET'}});assert.equal(s.marionettist.puppet.target.status,'INERT');assert.equal(s.marionettist.puppet.target.alive,false);assert.equal(s.marionettist.puppet.active,false);assert.equal(s.week,initial.week+1);
assert.equal(s.marionettist.puppet.target.id,fought.id);assert.equal(s.marionettist.puppet.target.health,fought.health);assert.deepEqual(s.marionettist.puppet.target.injuries,fought.injuries);assert.equal(s.marionettist.puppet.target.club.id,fought.club.id);assert.equal(s.marionettist.puppet.target.club.ownerId,fought.club.ownerId);assert.equal(s.marionettist.puppet.target.club.location,'COURTYARD_GROUND');
assert.deepEqual(s.faceless,initial.faceless);assert.equal(s.world.carrierAlive,initial.world.carrierAlive);app.close();
writeFileSync('output/play/marionettist-directed-capture.json',JSON.stringify({source:'DIRECTED_RANDOM_PUBLIC_COMMANDS_NOT_NATURAL',sourceFixture:'marionettist-v0950/natural.json combatStart',database:file,initial,fought,records,final:s,checks:['five real public commands','same body and original club','explicit irreversible death','actual original note use','0AP exit and week continuation','each save failure rollback','same database reopen and retry','idempotent reopen']}));
console.log(JSON.stringify({passed:true,kind:'DIRECTED_RANDOM_NOT_NATURAL',commands:records.length,database:file,health:s.marionettist.puppet.target.health,note:s.marionettist.puppet.note,week:s.week}));
