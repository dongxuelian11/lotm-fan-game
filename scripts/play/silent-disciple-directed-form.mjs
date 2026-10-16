import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState} from '../../dist/domain/slice/index.js';
const natural=JSON.parse(readFileSync('tests/fixtures/silent-disciple-v01570/natural.json','utf8'));
const original=natural.combatStart;
let selected=null;
for(let cursor=0;cursor<200;cursor++){
 const before=structuredClone(original);before.random.cursor=cursor;
 const intent={type:'COMBAT_ROUND',stance:'CONTROL',puppetCurse:false,madmanPolicy:'HOLD'};
 const after=applySliceIntent(before,intent);try{assertValidSliceState(after);}catch(error){writeFileSync("output/qa-0157/directed-validation-blocker.json",JSON.stringify({cursor,beforeLast:before,lastIntent:intent,final:after}));throw error;}
 if(cursor===3){assert.equal(after.status,'DEAD');writeFileSync('output/play/silent-disciple-directed-death-save-boundary.json',JSON.stringify({beforeLast:before,lastIntent:intent,final:after,provenance:{kind:'DIRECTED_RNG_FATAL_HISTORY_REGRESSION',naturalCursor:original.random.cursor,selectedCursor:cursor}}));}
 const out=after.lastCombatRound.silentDiscipleOutcome;
 if(out.transfigurationSuccesses>0&&out.weaponLocation==='COURT'&&after.combat){selected={beforeLast:before,lastIntent:intent,final:after};break;}
}
assert(selected,'No bounded directed form case found; do not change mechanics.');
const nextIntent={type:'COMBAT_ROUND',stance:'DEFEND',puppetCurse:false,madmanPolicy:'HOLD'};
const next=applySliceIntent(selected.final,nextIntent);assertValidSliceState(next);
assert(next.lastCombatRound.silentDiscipleOutcome.enemyActions.some(a=>a.executed==='PICK_UP'||a.label.includes('拾')),'Original enemy must actually spend an action to pick up the original rod.');
const pickup={beforeLast:selected.final,lastIntent:nextIntent,final:next};
const provenance={kind:'DIRECTED_RNG_START_THEN_PUBLIC_COMMANDS',source:'tests/fixtures/silent-disciple-v01570/natural.json#combatStart',naturalCursor:original.random.cursor,selectedCursor:selected.beforeLast.random.cursor,reason:'Exercise successful enemy original-body transformation, dropped original rod, and following actual pickup. This is not the natural branch.'};
writeFileSync('tests/fixtures/silent-disciple-v01570/directed-form.json',JSON.stringify({provenance,form:selected,pickup}));
for(const[k,b]of Object.entries({form:selected,pickup}))writeFileSync(`output/play/silent-disciple-directed-${k}-save-boundary.json`,JSON.stringify({...b,provenance}));
console.log(JSON.stringify({passed:true,provenance,first:selected.final.lastCombatRound.silentDiscipleOutcome,second:next.lastCombatRound.silentDiscipleOutcome}));
