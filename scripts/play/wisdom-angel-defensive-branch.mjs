import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,copyFileSync,constants} from 'node:fs';
import {applySliceIntent,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const root='tests/fixtures/wisdom-angel-v01700';
// One explicitly labelled alternate strategy from an actual living original
// opening. No altered seed/cursor/resource, no recovery of the natural dead end.
let s=migrateSliceState(JSON.parse(readFileSync(`${root}/snapshot-combatStart.json`,'utf8')));
assertValidSliceState(s);assert(s.combat?.encounterId==='WISDOM_ANGEL_DISPUTE');assert.equal(s.status,'ACTIVE');
const original=structuredClone(s),index={},rows=[],dir=mkdtempSync('output/play/wisdom-angel-defensive-01700-');
for(let n=0;s.combat&&n<32;n++){
 const beforeLast=s,lastIntent={type:'COMBAT_ROUND',stance:n<8?'DEFEND':'RETREAT'};
 s=applySliceIntent(s,lastIntent);assertValidSliceState(s);assert.equal(s.random.seed,original.random.seed);
 const name=`defensive-round-${n+1}`,file=`${name}.json`;
 writeFileSync(`${dir}/${file}`,JSON.stringify({beforeLast,lastIntent,final:s}),{flag:'wx'});index[name]=file;
 const r=s.combatHistory.at(-1),o=r.wisdomAngelOutcome;
 const row={name,stance:lastIntent.stance,status:s.status,H:s.health,S:s.spirituality,enemyS:s.wisdomAngel.encounter.enemySpirituality,conditionVersion:o.conditionVersion,uses:o.abilityUses,powers:o.powerUses,retreat:r.retreat,random:s.random};rows.push(row);console.log(JSON.stringify(row));
}
const summary={scope:'DIRECTED_PUBLIC_ALTERNATE_STRATEGY_FROM_ACTUAL_LIVING_COMBAT_START',stateEdits:false,seedChanges:false,cursorChanges:false,originalRevision:original.revision,commands:rows.length,terminal:s.wisdomAngel.encounter.terminal,status:s.status,rows};
writeFileSync(`${dir}/directed.index.json`,JSON.stringify(index,null,2),{flag:'wx'});writeFileSync(`${dir}/directed-summary.json`,JSON.stringify(summary,null,2),{flag:'wx'});
for(const file of [...Object.values(index),'directed.index.json','directed-summary.json'])copyFileSync(`${dir}/${file}`,`${root}/${file}`,constants.COPYFILE_EXCL);
console.log(JSON.stringify({passed:true,dir,boundaries:rows.length,terminal:summary.terminal,status:s.status}));
