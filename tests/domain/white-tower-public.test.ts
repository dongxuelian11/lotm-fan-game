import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { projectSliceState, assertValidSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
const file='tests/fixtures/all-knowing-eye-v01920/natural.json';
const hash=(v:unknown)=>createHash('sha256').update(stableStringify(v)).digest('hex');
function source(){expect(createHash('sha256').update(readFileSync(file)).digest('hex')).toBe('b838bff34dbf49f3df9968bcfef684a24c184e8320f9b8e6d7a1431bfc75a58f');return migrateSliceState(readObjectEntry<SliceState>(file,'final'));}
function leaks(value:unknown):string[]{
 const found:string[]=[];
 const privateKeys=new Set(['seed','cursor','random','randomSeed','randomCursor','randomCursorBefore','randomCursorAfter','cursorBefore','cursorAfter','randomBefore','randomAfter','randomReceipts','sourceDigest','historyDigest','originalsDigest','originalPracticeDigest','acquisitionDigest','beforeDigest','afterDigest','actorId','futureRoll','nextRoll']);
 const visit=(v:unknown,path:string)=>{if(!v||typeof v!=='object')return;for(const[k,x]of Object.entries(v)){const at=`${path}.${k}`;const guard=k==='actorId'&&x===null&&['$.divineHand.life.site.guard.actorId','$.glory.life.site.guard.actorId'].includes(at);if(privateKeys.has(k)&&!guard||k==='source'&&x!==null&&typeof x==='object')found.push(at);visit(x,at);}};
 visit(value,'$');return found;
}
describe('WhiteTower authentic inherited public boundary before new natural continuation',()=>{
 it('keeps the genuine666 living source, full private history and all21 mastery values unchanged',()=>{const state=source(),before=hash(state);assertValidSliceState(state);const p=projectSliceState(state);expect(state).toMatchObject({revision:667,week:146,status:'ACTIVE',health:70,mind:86,spirituality:120,cash:1390,actionsRemaining:3,random:{seed:'reader-natural-v023',cursor:227},progression:{pathwayId:'white-tower',sequence:1}});expect(Object.keys(state.progression.mastery)).toHaveLength(21);expect(Object.values(state.progression.mastery).filter(x=>x===0)).toHaveLength(6);expect(p.progression.mastery).toEqual(state.progression.mastery);expect(state.injuries).toHaveLength(1);expect(hash(state)).toBe(before);},60_000);
 it('does not expose private rolls or source authority in any inherited public path',()=>{const state=source(),before=hash(state),view=projectSliceState(state);expect(leaks(view),leaks(view).join("\n")).toEqual([]);expect(JSON.stringify(view)).not.toContain(state.random.seed);expect(hash(state)).toBe(before);},60_000);
 it('distinguishes lawful published prices and modifier labels from actual private source objects',()=>{expect(leaks({prices:{preparation:150},check:{modifiers:[{source:'实际原片',value:35}]}})).toEqual([]);expect(leaks({lastRound:{source:{seed:'secret'}},history:[{randomCursorAfter:8}]})).toEqual(['$.lastRound.source','$.lastRound.source.seed','$.history.0.randomCursorAfter']);});
});
