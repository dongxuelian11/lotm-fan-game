import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState} from '../../dist/domain/slice/index.js';
const natural=JSON.parse(readFileSync('tests/fixtures/chaos-walker-v01580/natural.json','utf8'));
const original=natural.combatStart;
let selected=null;
for(let cursor=0;cursor<100;cursor++){
 const before=structuredClone(original);before.random.cursor=cursor;
 const intent={type:'COMBAT_ROUND',stance:'ATTACK',winnerPolicy:'SPEND_FIRST'};
 const after=applySliceIntent(before,intent);assertValidSliceState(after);
 if(after.status==='DEAD'){selected={beforeLast:before,lastIntent:intent,final:after};break;}
}
assert(selected,'No bounded directed fatal branch; preserve ordinary rules.');
assert.deepEqual(selected.final.calamityPriest,original.calamityPriest);
assert.deepEqual(selected.final.misfortuneMage,original.misfortuneMage);
assert.equal(selected.final.chaosWalker.encounter.scene.playerPosition,'COURT');
const provenance={kind:'DIRECTED_RNG_FATAL_HISTORY_REGRESSION',source:'tests/fixtures/chaos-walker-v01580/natural.json#combatStart',naturalCursor:original.random.cursor,selectedCursor:selected.beforeLast.random.cursor,reason:'Explicit directed public combat death tests historical earned awards, original body location and save recovery; it does not replace the natural five-round victory.'};
writeFileSync('tests/fixtures/chaos-walker-v01580/directed-death.json',JSON.stringify({...selected,provenance}));
writeFileSync('output/play/chaos-walker-directed-death-save-boundary.json',JSON.stringify({...selected,provenance}));
console.log(JSON.stringify({passed:true,provenance,status:selected.final.status,oldCalamity:selected.final.calamityPriest.dispute,enemy:selected.final.chaosWalker.encounter}));
