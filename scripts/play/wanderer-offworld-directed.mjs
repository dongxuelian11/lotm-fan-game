import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState} from '../../dist/domain/slice/index.js';
const root='tests/fixtures/wanderer-v01500';
const continued=JSON.parse(readFileSync(`${root}/continued.json`));
const boundaries=JSON.parse(readFileSync(`${root}/boundaries.json`));
const source=structuredClone(boundaries['offworld-depart'].beforeLast);
const originalRandom=structuredClone(source.random);
// Explicit targeted success fixture; NEVER alter the real continued failure or its terminal death.
let s=structuredClone(source);s.random={seed:'secrets-sorcerer-directed-24',cursor:0};assertValidSliceState(s);
const initial=structuredClone(s),commands=[],provenance={kind:'DIRECTED_OFFWORLD_SUCCESS_FROM_ACTUAL_PREDEPARTURE',source:`${root}/boundaries.json#offworld-depart.beforeLast`,originalRandom,directedRandom:structuredClone(s.random),change:'Only the RNG stream is reset at the real prepared departure boundary to exercise successful physical outbound/return. This is targeted verification, not the continued branch outcome.'};
let beforeLast,lastIntent;
function go(command,key){beforeLast=structuredClone(s);lastIntent={type:'WANDERER',command};s=applySliceIntent(s,lastIntent);assertValidSliceState(s);commands.push(lastIntent);if(key){const b={beforeLast,lastIntent,final:structuredClone(s)};boundaries[key]=b;writeFileSync(`output/play/wanderer-${key}-save-boundary.json`,JSON.stringify(b));}}
const caseId='offworld-visit';
go({type:'DEPART',caseId,confirm:true},'directed-offworld-depart');assert.equal(s.wanderer.life.playerLocation,'REMOTE');
go({type:'CHECK_RETURN_MARKER',caseId},'directed-return-marker');
go({type:'VIEW_HORIZON',caseId,confirm:true},'directed-horizon');
go({type:'TAKE_PACKET',caseId},'directed-packet');
go({type:'RETURN_LOCAL',caseId},'directed-physical-return');
go({type:'RETURN_PLAYER',caseId});go({type:'RETURN_SUIT',caseId},'directed-suit-return');
go({type:'INSPECT',caseId});go({type:'CLOSE',caseId},'directed-close');
assert.equal(s.wanderer.life.playerLocation,'START');assert.equal(s.wanderer.life.packet.location,'PLAYER');
assert.equal(s.wanderer.life.suit.protectionSeconds,70);assert.equal(s.wanderer.life.energy.remaining,0);
assert.equal(s.spirituality,source.spirituality-16);assert.equal(s.mind,source.mind-6);assert.equal(s.seer.pollution,source.seer.pollution+3);
for(const k of ['apprentice','trickmaster','astrologer','recorder','traveler','secretsSorcerer'])assert.deepEqual(s[k],source[k]);
assert.equal(continued.final.status,'DEAD');
const data={provenance,initial,commands,beforeLast,lastIntent,final:s};
writeFileSync(`${root}/offworld-directed.json`,JSON.stringify(data));writeFileSync(`${root}/boundaries.json`,JSON.stringify(boundaries));
console.log(JSON.stringify({passed:true,provenance,commands:commands.length,week:s.week,status:s.status,H:s.health,M:s.mind,S:s.spirituality,pollution:s.seer.pollution,life:s.wanderer.life,actualContinuedDeathPreserved:continued.final.status}));
