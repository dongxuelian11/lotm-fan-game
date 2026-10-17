import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState} from '../../dist/domain/slice/index.js';
import {DeterministicActionRandomStream} from '../../dist/resolution/deterministic-random.js';
import {computeCheckChance} from '../../dist/resolution/normal-check.js';
const boundaries=JSON.parse(readFileSync('tests/fixtures/black-knight-v01320/boundaries.json','utf8'));
const source=boundaries['shade-capture-1'].beforeLast;
let s=structuredClone(source),selectedSeed=null;
// Explicit test-only RNG fork, not a natural replay or a continuation of the isolated ending.
const chance=computeCheckChance({baseAbility:s.character.coreStats.knowledge,difficulty:18,modifiers:[]});
for(let n=0;n<100;n++){const seed=`black-knight-directed-success-${n}`;if(new DeterministicActionRandomStream(seed,s.random.cursor).nextInt(1,100)<=chance){selectedSeed=seed;break;}}
assert(selectedSeed);s.random.seed=selectedSeed;assertValidSliceState(s);
const initial=structuredClone(s),commands=[],records={};
for(const [name,type] of [['capture','CAPTURE_SHADE'],['return','RETURN_SHADE_ROUTE'],['handoff','HANDOFF_SHADE']]){
 const beforeLast=structuredClone(s),lastIntent={type:'BLACK_KNIGHT',command:{type}};s=applySliceIntent(s,lastIntent);assertValidSliceState(s);commands.push(lastIntent);records[name]={beforeLast,lastIntent,final:structuredClone(s)};
 writeFileSync(`output/play/black-knight-directed-${name}-save-boundary.json`,JSON.stringify(records[name]));
}
assert.equal(s.blackKnight.life.shade.status,'TAKEN_AWAY');assert.equal(s.blackKnight.life.shade.creatureId,'BK4-SHADE-1');assert.equal(s.blackKnight.life.shade.caskId,'BK4-CASK-1');assert.equal(s.blackKnight.life.shade.playerDistanceMetres,4);assert.deepEqual(s.shepherd.grazing,source.shepherd.grazing);
const capture={basis:'Explicit test-only RNG fork of original natural capture-before snapshot. Only random.seed is changed; no resources, souls, people, positions or inventory are patched. Not natural success and not revival/continuation of isolated ending.',originalSeed:source.random.seed,selectedSeed,source,initial,commands,records,final:s};
writeFileSync('tests/fixtures/black-knight-v01320/directed-capture.json',JSON.stringify(capture));
writeFileSync('output/play/black-knight-directed-capture.json',JSON.stringify(capture));
console.log(JSON.stringify({passed:true,basis:capture.basis,selectedSeed,shade:s.blackKnight.life.shade}));
