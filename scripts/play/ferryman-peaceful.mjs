import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createSliceRun,applySliceIntent,assertValidSliceState} from '../../dist/domain/slice/index.js';
const natural=JSON.parse(readFileSync('tests/fixtures/ferryman-v01490/natural.json','utf8'));
const fork=natural.commands.findIndex(c=>c.type==='FERRYMAN'&&c.command.type==='ENCOUNTER_FIGHT');
assert(fork>natural.prefixCount);assert.equal(natural.final.status,'DEAD');
// Replay the unchanged public prefix from new creation. The dead terminal save is never resumed.
const commands=structuredClone(natural.commands.slice(0,fork));
let s=createSliceRun(natural.final.runId,natural.creation,natural.seed);
for(const c of commands){s=applySliceIntent(s,c);assertValidSliceState(s);}
const departureStart=structuredClone(s);assert.equal(s.status,'ACTIVE');assert.equal(s.combat,null);assert.equal(s.ferryman.encounter.status,'READY');
const boundaries=JSON.parse(readFileSync('tests/fixtures/ferryman-v01490/boundaries.json','utf8'));
let beforeLast,lastIntent;
function go(intent,key){beforeLast=structuredClone(s);lastIntent=structuredClone(intent);s=applySliceIntent(s,intent);assertValidSliceState(s);commands.push(intent);const b={beforeLast,lastIntent,final:structuredClone(s)};boundaries[key]=b;writeFileSync(`output/play/ferryman-${key}-save-boundary.json`,JSON.stringify(b));}
go({type:'FERRYMAN',command:{type:'LEAVE_ENCOUNTER'}},'peaceful-leave');
assert.equal(s.ferryman.encounter.status,'RESOLVED');assert.equal(s.ferryman.encounter.attemptWeek,null);
if(s.actionsRemaining===0){if(s.cash<24)go({type:'FERRYMAN',command:{type:'ERA_WORK'}},'peaceful-emergency-work');go({type:'FERRYMAN',command:{type:'ERA_NEXT_WEEK'}},'peaceful-next-week');}
go({type:'FERRYMAN',command:{type:'ERA_WORK'}},'peaceful-ordinary-life');
assert.equal(s.status,'ACTIVE');assert.equal(s.combat,null);assert.deepEqual(s.combatHistory,departureStart.combatHistory);
for(const k of ['corpsecollector','gravedigger','spiritmedium','spiritGuide','gatekeeper','undying','longChapter'])assert.deepEqual(s[k],departureStart[k]);
const result={creation:natural.creation,seed:natural.seed,commands,prefixCount:natural.prefixCount,sharedPublicPrefix:fork,branch:'BEFORE_OPTIONAL_FIGHT',departureStart,beforeLast,lastIntent,final:s};
writeFileSync('tests/fixtures/ferryman-v01490/peaceful.json',JSON.stringify(result));writeFileSync('tests/fixtures/ferryman-v01490/boundaries.json',JSON.stringify(boundaries));writeFileSync('output/play/ferryman-peaceful.json',JSON.stringify(result));
console.log(JSON.stringify({passed:true,branch:result.branch,sharedPublicPrefix:fork,commands:commands.length,week:s.week,status:s.status,H:s.health,M:s.mind,S:s.spirituality,cash:s.cash,AP:s.actionsRemaining,encounter:s.ferryman.encounter,deathBranchPreserved:natural.final.status}));
