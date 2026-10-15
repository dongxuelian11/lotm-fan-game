import assert from 'node:assert/strict';
import {openSync,readSync,closeSync,mkdirSync,writeFileSync} from 'node:fs';
import {StringDecoder} from 'node:string_decoder';
import {lifeGiverBoundaryFile} from './life-giver-boundary-files.mjs';
import {applySliceIntent,projectSliceState,assertValidSliceState} from '../../dist/domain/slice/index.js';
// Directed alternate public choice from an actual living natural boundary.
// No seed/cursor/resources/guest state edits. The original natural branch stays intact.
const root='tests/fixtures/life-giver-v01680';
const origin=readObjectEntry(lifeGiverBoundaryFile(root,'interrupted-link-shelter-outcome'),'interrupted-link-shelter-outcome');
let s=origin.final;const start=s, pairs={},commands=[];
const capture=(key,command)=>{const beforeLast=s,lastIntent={type:'LIFE_GIVER',command};s=applySliceIntent(s,lastIntent);assertValidSliceState(s);assert.equal(s.random.seed,start.random.seed);commands.push(lastIntent);pairs[key]={beforeLast,lastIntent,final:s,public:projectSliceState(s)};console.log(JSON.stringify({key,revision:s.revision,H:s.health,S:s.spirituality,guestStamina:s.summoningMaster.life.partner.stamina}));};
assert.equal(s.lifeGiver.life.cases['interrupted-link'].attempts.at(-1).shelterStatus,'ACTIVE');
const before={health:s.health,stamina:s.summoningMaster.life.partner.stamina,spirituality:s.spirituality,cursor:s.random.cursor};
capture('actual-shared-load',{type:'GUEST_CARRY',caseId:'interrupted-link'});
assert.equal(s.health,before.health-5);assert.equal(s.summoningMaster.life.partner.stamina,before.stamina-3);assert.equal(s.spirituality,before.spirituality);assert.equal(s.random.cursor,before.cursor);
assert.equal(s.progression.mastery['moon.s2.shared-shelter'],8);assert.equal(s.lifeGiver.life.cases['interrupted-link'].attempts.at(-1).shelterApplied,true);
for(const type of ['RETURN_TOKEN','RETURN_GUEST','RETURN_PLAYER','RETURN_BEADS','INSPECT','CLOSE'])capture(type.toLowerCase(),{type,caseId:'interrupted-link'});
assert.equal(s.lifeGiver.life.playerLocation,'YARD');assert.equal(s.summoningMaster.life.partner.location,'HOME');assert.equal(s.lifeGiver.life.token.location,'OWNER');assert(s.lifeGiver.life.beads.every(b=>b.location==='RETURN_TRAY'));
writeFileSync(`${root}/directed.json`,JSON.stringify(pairs));writeFileSync(`${root}/directed-summary.json`,JSON.stringify({kind:'DIRECTED_ALTERNATE_PUBLIC_CHOICE',source:'interrupted-link-shelter-outcome',commands,seedUnchanged:true,cursorUnchanged:s.random.cursor===start.random.cursor,healthBefore:before.health,healthAfter:s.health,staminaBefore:before.stamina,staminaAfter:s.summoningMaster.life.partner.stamina,keys:Object.keys(pairs)},null,2));
console.log(JSON.stringify({passed:true,kind:'DIRECTED_ALTERNATE_PUBLIC_CHOICE',boundaries:Object.keys(pairs).length,health:s.health,mastery:s.progression.mastery['moon.s2.shared-shelter']}));

function readObjectEntry(path, wanted) {
  const fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(64 * 1024), decoder = new StringDecoder('utf8');
  let phase = 'START';
  let key = '', selected = false, quoted = false, escaped = false, depth = 0;
  let kind = 'PRIMITIVE';
  const pieces = [];
  try {
    for (;;) {
      const n = readSync(fd, buffer, 0, buffer.length, null);
      const text = n ? decoder.write(buffer.subarray(0, n)) : decoder.end();
      let captureStart = selected && phase === 'VALUE' ? 0 : -1;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (phase === 'START') { if (/\s/.test(c)) continue; if (c !== '{') throw new Error('Expected a top-level JSON object'); phase = 'KEY'; continue; }
        if (phase === 'KEY' || phase === 'AFTER') {
          if (/\s/.test(c) || c === ',') continue;
          if (c === '}') throw new Error(`Missing JSON object entry: ${wanted}`);
          if (c !== '"') throw new Error('Expected a JSON property name');
          key = '"'; escaped = false; phase = 'KEY_STRING'; continue;
        }
        if (phase === 'KEY_STRING') {
          key += c;
          if (escaped) escaped = false;
          else if (c === '\\') escaped = true;
          else if (c === '"') { selected = JSON.parse(key) === wanted; phase = 'COLON'; }
          continue;
        }
        if (phase === 'COLON') { if (/\s/.test(c)) continue; if (c !== ':') throw new Error('Expected JSON colon'); phase = 'VALUE_START'; continue; }
        if (phase === 'VALUE_START') {
          if (/\s/.test(c)) continue;
          if (selected) captureStart = i;
          depth = 0; quoted = false; escaped = false;
          kind = c === '{' || c === '[' ? 'CONTAINER' : c === '"' ? 'STRING' : 'PRIMITIVE'; phase = 'VALUE';
        }
        if (phase === 'VALUE') {
          let done = false, end = i + 1;
          if (quoted) {
            if (escaped) escaped = false;
            else if (c === '\\') escaped = true;
            else if (c === '"') { quoted = false; if (kind === 'STRING' && depth === 0) done = true; }
          } else if (c === '"') quoted = true;
          else if (c === '{' || c === '[') depth++;
          else if (c === '}' || c === ']') { if (depth > 0) { depth--; if (depth === 0) done = true; } else { done = true; end = i; } }
          else if (kind === 'PRIMITIVE' && (c === ',' || /\s/.test(c))) { done = true; end = i; }
          if (done) {
            if (selected) { pieces.push(text.slice(captureStart, end)); return JSON.parse(pieces.join('')); }
            phase = 'AFTER'; selected = false; captureStart = -1;
          }
        }
      }
      if (captureStart >= 0) pieces.push(text.slice(captureStart));
      if (!n) break;
    }
  } finally { closeSync(fd); }
  throw new Error(`Missing JSON object entry: ${wanted}`);
}
