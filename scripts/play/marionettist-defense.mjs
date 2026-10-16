import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createSliceRun,applySliceIntent,assertValidSliceState} from '../../dist/domain/slice/index.js';
const original=JSON.parse(readFileSync('tests/fixtures/marionettist-v0950/natural.json','utf8'));
const start=original.commands.findIndex(c=>c.type==='MARIONETTIST'&&c.command.type==='ENCOUNTER_FIGHT');
assert(start>=0);const commands=original.commands.slice(0,start+1);let s=createSliceRun(original.final.runId,original.creation,original.seed);
for(const c of commands){s=applySliceIntent(s,c);assertValidSliceState(s);}assert.deepEqual(s,original.combatStart);
const boundaries={},combatStart=structuredClone(s);let beforeLast,lastIntent;
function go(c,key){beforeLast=structuredClone(s);lastIntent=c;s=applySliceIntent(s,c);assertValidSliceState(s);commands.push(c);if(key)boundaries[key]={beforeLast,lastIntent,final:structuredClone(s)};console.log(JSON.stringify({step:commands.length,type:c.type==='MARIONETTIST'?c.command.type:c.type,round:s.combat?.round,ap:s.actionsRemaining,S:s.spirituality,health:s.health,target:s.marionettist.puppet.target?.status,check:s.lastCheck}));}
for(let n=0;s.combat&&n<60;n++){go({type:'COMBAT_ROUND',stance:'DEFEND'});if(!s.combat)boundaries.combat={beforeLast,lastIntent,final:structuredClone(s)};}
assert.equal(s.combat,null);const fought=structuredClone(s);
if(s.status==='ACTIVE'&&s.marionettist.puppet.target?.status==='SURRENDERED'){
 go({type:'MARIONETTIST',command:{type:'BEGIN_CAPTURE'}},'capture-begin');
 if(s.marionettist.puppet.target?.status==='INITIAL_CONTROL')go({type:'MARIONETTIST',command:{type:'COMPLETE_CAPTURE',confirmedDeath:true}},'capture-complete');
 if(s.marionettist.puppet.active){go({type:'MARIONETTIST',command:{type:'PUPPET_DELIVER'}},'puppet-use');go({type:'MARIONETTIST',command:{type:'DISMISS_PUPPET'}},'puppet-release');}
}
writeFileSync('output/play/marionettist-defense-natural.json',JSON.stringify({creation:original.creation,seed:original.seed,prefixCount:start+1,commands,combatStart,fought,beforeLast,lastIntent,final:s}));
for(const[k,b]of Object.entries(boundaries))writeFileSync(`output/play/marionettist-defense-${k}-save-boundary.json`,JSON.stringify(b));
console.log(JSON.stringify({passed:true,commands:commands.length,week:s.week,status:s.status,health:s.health,puppet:s.marionettist.puppet}));
