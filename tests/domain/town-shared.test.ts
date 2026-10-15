import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createSliceRun,applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import {resolveAudienceCombatAbility} from '../../src/domain/audience/combat.js';
import {playerAbilityWheel,resolveSliceCombatRound} from '../../src/domain/slice/combat.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const capture=()=>{
 const raw=JSON.parse(readFileSync(new URL('../fixtures/town-v0100/natural.json',import.meta.url),'utf8')),bytes=JSON.stringify(raw);
 const result={...raw,final:migrateSliceState(raw.final)};expect(JSON.stringify(raw)).toBe(bytes);return result;
};
describe('Town equipment through shared saves',()=>{
 it('replays all original progression and actual shop/first-aid actions',()=>{const c=capture();let s=createSliceRun(c.final.runId,c.creation,c.seed);for(const i of c.commands){s=applySliceIntent(s,i);assertValidSliceState(s);}expect(s).toEqual(c.final);expect(s.town.clubLocation).toBe('HAND');expect(s.town.bandagesUsed).toBe(1);expect(s.caseArchive).toHaveLength(1);});
 it('preserves prior0.9 private data when adding unopened shop stock and later defaults',()=>{
  const capture=JSON.parse(readFileSync(new URL('../fixtures/mindreader-v090/natural.json',import.meta.url),'utf8')),old=capture.final,bytes=JSON.stringify(old);
  expect([old.schemaVersion,old.contentVersion]).toEqual([8,'mindreader-life-v8']);
  const next=migrateSliceState(old),previous:Record<string,unknown>=structuredClone(next) as unknown as Record<string,unknown>;
  const fresh=createSliceRun(old.runId,capture.creation,capture.seed),defaults=fresh as unknown as Record<string,unknown>;
  expect(Object.keys(next).sort()).toEqual(Object.keys(fresh).sort());
  for(const key of Object.keys(previous))if(!Object.hasOwn(old,key)){expect(previous[key],key).toEqual(defaults[key]);delete previous[key];}
  expect([next.schemaVersion,next.contentVersion]).toEqual([176,'elder-v176']);
  previous.schemaVersion=old.schemaVersion;previous.contentVersion=old.contentVersion;
  expect(previous).toEqual(old);expect(next.town.shopKnown).toBe(false);expect(JSON.stringify(old)).toBe(bytes);expect(migrateSliceState(next)).toEqual(next);assertValidSliceState(next);
 });
 it('uses only the actually held original club for ordinary inherited strike strength',()=>{const s:SliceState=capture().final;s.town.clubLocation='BAG';expect(resolveAudienceCombatAbility(s,'STRIKE',1).selfGain).toBe(12);s.town.clubLocation='HAND';expect(resolveAudienceCombatAbility(s,'STRIKE',1).selfGain).toBe(16);expect(resolveAudienceCombatAbility(s,'STRIKE',.5).selfGain).toBe(8);expect(playerAbilityWheel(s,null).find(x=>x.id==='STRIKE')!.label).toContain('原短棍');});
 it('keeps equipped items through an actual shared combat round and refuses midcombat sales',()=>{const old=JSON.parse(readFileSync(new URL('../fixtures/mindreader-v090/natural.json',import.meta.url),'utf8'));const s:SliceState=migrateSliceState(old.combatStart);s.town={shopKnown:true,clubLocation:'HAND',bandagesStock:3,bandagesHeld:0,bandagesUsed:0};const original=structuredClone(s);expect(()=>applySliceIntent(s,{type:'TOWN',command:{type:'SELL_CLUB'}})).toThrow();expect(s).toEqual(original);const a=structuredClone(s),b=structuredClone(s);expect(resolveSliceCombatRound(a,'ATTACK')).toEqual(resolveSliceCombatRound(b,'ATTACK'));expect(a.town).toEqual(s.town);expect(projectSliceState(a).town.items.some(i=>i.id==='town-short-club'&&i.equipped)).toBe(true);});
 it('replays the real owned-club branch through the complete existing encounter',()=>{const c=JSON.parse(readFileSync(new URL('../fixtures/release-legacy-output-v0177/town-equipped-battle-natural.json',import.meta.url),'utf8')),bytes=JSON.stringify(c.final);let s=createSliceRun(c.final.runId,c.creation,c.seed);for(const i of c.commands){s=applySliceIntent(s,i);assertValidSliceState(s);}expect(s).toEqual(migrateSliceState(c.final));expect(JSON.stringify(c.final)).toBe(bytes);expect(s.combatHistory.some(r=>r.moves.some(m=>m.actor==='PLAYER'&&m.label.includes('原短棍')))).toBe(true);expect(s.town.clubLocation).toBe('HAND');});

 it('shows existing owned pathway supplies without moving or duplicating them',()=>{const s:SliceState=capture().final;s.clown.paperSheets=3;s.clown.paperStock=27;s.clown.paperSpent=0;s.hunter.trapHeld=1;s.hunter.trapStock=2;const before=structuredClone(s),p=projectSliceState(s).town;expect(p.items.find(x=>x.id==='clown-carried-paper')!.quantity).toBe(3);expect(p.items.find(x=>x.id==='hunter-carried-trap')!.quantity).toBe(1);expect(s).toEqual(before);});

 it('keeps the continued-life guidance on the real pathway',()=>{const s:SliceState=capture().final;expect(projectSliceState(s).nextStep).toContain('读心者');expect(projectSliceState(s).nextStep).not.toContain('小丑');});

 it('warns about the existing closing investigation window rather than recommending another wait',()=>{const s:SliceState=capture().final;s.arc.stage='C_AVAILABLE';s.arc.startWeek=s.week-2;expect(projectSliceState(s).nextStep).toContain('继续等待可能造成');});

});
