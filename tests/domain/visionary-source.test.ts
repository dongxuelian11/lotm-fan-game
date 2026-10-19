import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { sha256Hex } from '../../src/domain/checksum.js';
import { createVisionarySource, validateVisionarySource, visionarySourceBlock, VISIONARY_FROZEN_SOURCE_KEYS } from '../../src/domain/visionary/source.js';
import {  applyVisionaryCommand, validateVisionaryState } from '../../src/domain/visionary/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
const file='tests/fixtures/writer-v01880/snapshot-practiced.json';
const original=():SliceState=>migrateSliceState(JSON.parse(readFileSync(file,'utf8')));
const context:SeerContext={note(){},roll(){throw Error('No external RNG');},check(){throw Error('No external check');}};
describe('Visionary exact living Writer source',()=>{
  it('retains the real living 659-command practiced source and all nine frozen roots',()=>{
    expect(sha256Hex(readFileSync(file,'utf8'))).toBe('49e6d09f367fab24667093f32a1a887aef5b000a2fe505a56cb3190276e3a0bc');
    const s=original(),before=structuredClone(s);expect(visionarySourceBlock(s)).toBeNull();
    expect([s.revision,s.week,s.cash,s.random.cursor]).toEqual([660,144,400,480]);
    applyVisionaryCommand(s,{type:'LEARN_GUIDANCE'},context);s.revision++;
    expect([s.cash,s.actionsRemaining]).toEqual([300,2]);expect(s.visionary.source!.budget.cash).toBe(400);
    for(const key of VISIONARY_FROZEN_SOURCE_KEYS)expect(s[key]).toEqual(before[key]);
    expect(s.writer.life.practice.book).toEqual(before.writer.life.practice.book);
    expect(s.random).toEqual(before.random);expect(s.progression).toEqual(before.progression);expect(validateVisionaryState(s)).toBe(true);
  });
  it('rejects self-authored source budgets and changes to old persons or original bottles',()=>{
    const s=original(),source=createVisionarySource(s);expect(validateVisionarySource(s,source)).toBe(true);
    const forged=structuredClone(source);forged.budget.cash++;expect(validateVisionarySource(s,forged)).toBe(false);
    source.random.cursor--;expect(validateVisionarySource(s,source)).toBe(false);
    const shifted=original();shifted.writer.bottles[1]!.status='PLAYER';expect(visionarySourceBlock(shifted)).not.toBeNull();
    const dead=original();dead.status='DEAD';dead.health=0;expect(visionarySourceBlock(dead)).not.toBeNull();
  });
});
