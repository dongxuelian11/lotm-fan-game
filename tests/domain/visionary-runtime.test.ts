import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import type { VisionaryCommand } from '../../src/domain/visionary/types.js';
import { applyVisionaryCommand,applyOwnedVisionaryCommand,openVisionaryOwnedHead,
  assertOwnedVisionaryCurrent,ownedVisionaryCommandBlock,projectOwnedVisionary,projectVisionary,validateVisionaryState,validateVisionaryCommand } from '../../src/domain/visionary/index.js';
import { snapshotVisionaryOwnedEngine,type VisionaryOwnedEngine } from '../../src/domain/visionary/engine.js';
const context:SeerContext={note(){},roll(){throw Error('No external RNG');},check(){throw Error('No external check');}};
const original=():SliceState=>migrateSliceState(JSON.parse(readFileSync('tests/fixtures/writer-v01880/snapshot-practiced.json','utf8')));
const guided=():SliceState=>{const s=original();applyVisionaryCommand(s,{type:'LEARN_GUIDANCE'},context);s.revision++;return s;};
const raw=(s:SliceState,c:VisionaryCommand):SliceState=>{const n=structuredClone(s);applyVisionaryCommand(n,c,context);n.revision++;return n;};
describe('Visionary central raw and private owned engine',()=>{
  it('matches strictly replayed and private transitions without exposing mutable owned state',()=>{
    let state=guided(),head=openVisionaryOwnedHead(state);
    const commands:VisionaryCommand[]=[{type:'WORK'},{type:'REST'},{type:'NEXT_WEEK'},{type:'TRAVEL',to:'backlund:professional-handoff'},
      {type:'MATERIAL',command:{type:'MATERIAL_LABOUR',bottleId:'writer-potion-2',taskId:'SEAL_REGISTER'}}];
    for(const c of commands){
      const expected=raw(state,c),draft=structuredClone(state),before=structuredClone(state),old=snapshotVisionaryOwnedEngine(head);
      expect(ownedVisionaryCommandBlock(state,c,head)).toBeNull();
      expect(projectOwnedVisionary(state,head)).toEqual(projectVisionary(state));expect(state).toEqual(before);
      const next=applyOwnedVisionaryCommand(draft,c,context,head);draft.revision++;
      expect(draft).toEqual(expected);expect(snapshotVisionaryOwnedEngine(head)).toEqual(old);
      expect(()=>assertOwnedVisionaryCurrent(draft,head)).toThrow();assertOwnedVisionaryCurrent(draft,next);
      const copy=snapshotVisionaryOwnedEngine(next);copy.frame!.budget.cash=999999;
      expect(snapshotVisionaryOwnedEngine(next).frame!.budget.cash).not.toBe(999999);state=draft;head=next;
    }
    expect(state.random.cursor).toBe(480);expect(validateVisionaryState(state)).toBe(true);
  });
  it('rejects forged opaque handles, command extension flags, receipts and current cash',()=>{
    const s=guided();expect(()=>snapshotVisionaryOwnedEngine({} as VisionaryOwnedEngine)).toThrow();
    expect(validateVisionaryCommand({type:'WORK',skipValidation:true})).toBe(false);
    const next=raw(s,{type:'WORK'}),tampered=structuredClone(next);tampered.visionary.journal[0]!.notes.push('Forged note');expect(validateVisionaryState(tampered)).toBe(false);
    next.cash++;expect(validateVisionaryState(next)).toBe(false);
  });
  it('keeps AP-zero waiting and no-prepayment return open, and posts actual weekly bills',()=>{
    let s=guided();s=raw(s,{type:'WORK'});s=raw(s,{type:'REST'});expect(s.actionsRemaining).toBe(0);
    const before=s.cash;s=raw(s,{type:'NEXT_WEEK'});expect(s.cash).toBe(before-30);expect(s.actionsRemaining).toBe(3);
    s=raw(s,{type:'ERA',command:{type:'ERA_TRAVEL',cityId:'TINGEN'}});const departure=s.week;
    expect(projectVisionary(s).sections.find(section=>section.id==='era')!.lines[0]).toBe(`当前位置：廷根公共联络站；当前第${s.week}周。`);
    s=raw(s,{type:'RETURN_ON_FOOT'});expect(s.week).toBe(departure+2);expect(s.visionary.frame!.location).toBe('backlund:public-relay-headquarters');
    expect(projectVisionary(s).sections.find(section=>section.id==='era')!.lines[0]).toBe(`当前位置：贝克兰德公共联络处；当前第${s.week}周。`);
  });
  it('does not project Audience abilities or promotion for a different pathway with an empty root',()=>{
    const s=original();s.progression.pathwayId='diviner';s.progression.sequence=0;
    const p=projectVisionary(s);expect(p.promoted).toBe(false);expect(p.abilities).toEqual([]);expect(p.actions.every(a=>!a.enabled)).toBe(true);
  });
  it('public previews contain neither source digests nor future random state',()=>{
    const s=guided(),text=JSON.stringify(projectOwnedVisionary(s,openVisionaryOwnedHead(s)));
    expect(text).not.toMatch(/sourceDigest|historyDigest|randomReceipts|"seed"|"cursor"/);
    expect(text).not.toContain(s.random.seed);expect(text).not.toContain(s.visionary.source!.historyDigest);
    expect(projectVisionary(s).abilities).toHaveLength(25);
  });
});
