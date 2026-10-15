import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,mkdtempSync,writeFileSync,copyFileSync,constants} from 'node:fs';
import {applySliceIntent,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {migrateSliceState} from '../../dist/domain/slice/migration.js';
const root='tests/fixtures/concealment-servant-v01690';
let s=migrateSliceState(JSON.parse(readFileSync(`${root}/snapshot-practiced.json`,'utf8')));
assertValidSliceState(s);assert.equal(s.status,'ACTIVE');assert.equal(s.progression.sequence,2);
const original=structuredClone(s), index={}, records=[];
mkdirSync('output/play',{recursive:true});const out=mkdtempSync('output/play/concealment-servant-inherited-spirit-01690-');
// Two explicit alternative player choices from the real living practiced save.
// No seed, cursor, resources, AP, mastery or consequence edits; never resume DEAD.
for(const [name,type] of [['original-spirit-release','RELEASE_SPIRIT'],['same-spirit-current-invitation','INVITE_SPIRIT']]){
 const beforeLast=s,lastIntent={type:'SPIRIT_WARLOCK',command:{type}};
 s=applySliceIntent(s,lastIntent);assertValidSliceState(s);
 assert.equal(s.random.seed,original.random.seed);assert.deepEqual(s.progression,original.progression);
 assert.equal(s.spiritWarlock.companion.source,original.spiritWarlock.companion.source);
 assert.equal(s.spiritWarlock.companion.acquiredWeek,original.spiritWarlock.companion.acquiredWeek);
 const filename=`directed-${name}.json`;writeFileSync(`${out}/${filename}`,JSON.stringify({beforeLast,lastIntent,final:s}),{flag:'wx'});
 copyFileSync(`${out}/${filename}`,`${root}/${filename}`,constants.COPYFILE_EXCL);index[name]=filename;records.push({name,intent:lastIntent,randomBefore:beforeLast.random,randomAfter:s.random});
}
assert.equal(s.actionsRemaining,original.actionsRemaining-1);assert.equal(s.spirituality,original.spirituality-3);
assert.equal(s.spiritWarlock.companion.releases,original.spiritWarlock.companion.releases+1);
assert.equal(s.spiritWarlock.companion.invitedWeek,original.week);
assert(['SEALED','RELEASED'].includes(s.spiritWarlock.companion.status));
const summary={passed:true,branch:'EXPLICIT_ALTERNATIVE_LIVING_PRACTICED_SAVE',source:`${root}/snapshot-practiced.json`,commands:records,status:s.spiritWarlock.companion.status,spirituality:s.spirituality,actionsRemaining:s.actionsRemaining,week:s.week,originalSource:s.spiritWarlock.companion.source};
for(const [file,value]of [['directed.index.json',index],['directed-summary.json',summary]]){writeFileSync(`${out}/${file}`,JSON.stringify(value),{flag:'wx'});copyFileSync(`${out}/${file}`,`${root}/${file}`,constants.COPYFILE_EXCL);}
console.log(JSON.stringify({...summary,outputDir:out}));
