import assert from 'node:assert/strict';import{readFileSync,writeFileSync}from'node:fs';
import{applySliceIntent,assertValidSliceState}from'../../dist/domain/slice/index.js';
const root='tests/fixtures/wanderer-v01500',boundaries=JSON.parse(readFileSync(`${root}/boundaries.json`));
const initial=structuredClone(boundaries['directed-return-marker'].final),commands=[];
let s=structuredClone(initial),beforeLast,lastIntent;
while(s.status==='ACTIVE'){
 assert(commands.length<30);beforeLast=structuredClone(s);lastIntent={type:'WANDERER',command:{type:'WAIT_EXPOSURE',caseId:'offworld-visit'}};
 s=applySliceIntent(s,lastIntent);assertValidSliceState(s);commands.push(lastIntent);
}
assert.equal(s.status,'DEAD');assert.equal(s.health,0);assert.equal(s.wanderer.life.playerLocation,'REMOTE');
assert.equal(s.wanderer.life.suit.location,'PLAYER');assert.equal(s.wanderer.life.packet.location,'REMOTE');
assert.equal(s.wanderer.life.energy.remaining,1);assert.equal(s.spirituality,initial.spirituality);
assert.throws(()=>applySliceIntent(s,{type:'WANDERER',command:{type:'RETURN_LOCAL',caseId:'offworld-visit'}}));
const provenance={kind:'DIRECTED_OFFWORLD_SUCCESS_THEN_PUBLIC_EXPOSURE_DEATH',source:`${root}/boundaries.json#directed-return-marker.final`,newRandomChanges:false};
const b={beforeLast,lastIntent,final:s};boundaries['directed-exposure-death']=b;
writeFileSync(`${root}/exposure-directed.json`,JSON.stringify({provenance,initial,commands,...b}));writeFileSync(`${root}/boundaries.json`,JSON.stringify(boundaries));writeFileSync('output/play/wanderer-directed-exposure-death-save-boundary.json',JSON.stringify(b));
console.log(JSON.stringify({passed:true,provenance,commands:commands.length,status:s.status,H:s.health,M:s.mind,S:s.spirituality,location:s.wanderer.life.playerLocation,protection:s.wanderer.life.suit.protectionSeconds,ending:s.ending}));
