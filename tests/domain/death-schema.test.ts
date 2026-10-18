import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { createDeathState } from '../../src/domain/death/index.js';
import { validateSlicePayload } from '../../src/domain/slice/validation.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { DEATH_SOURCE_FILE, DEATH_SOURCE_SHA, deathScenarioHash } from '../helpers/death-scenario.js';
let source:SliceState;
beforeAll(()=>{expect(createHash('sha256').update(readFileSync(DEATH_SOURCE_FILE)).digest('hex')).toBe(DEATH_SOURCE_SHA);source=readObjectEntry<SliceState>(DEATH_SOURCE_FILE,'final');});
describe('Death schema214 exact additive admission',()=>{
  it('migrates original192 with all old fields exact and a precise empty current root',()=>{
    const before=deathScenarioHash(source),current=migrateSliceState(source);
    expect(deathScenarioHash(source)).toBe(before);expect([current.schemaVersion,current.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION,CURRENT_CONTENT_VERSION]);expect(current.death).toEqual(createDeathState());
    for(const[key,value]of Object.entries(source))if(!['schemaVersion','contentVersion'].includes(key))expect(deathScenarioHash(current[key as keyof SliceState]),key).toBe(deathScenarioHash(value));assertValidSliceState(current);
  },120_000);
  it('rejects a legacy injected root,missing current root and unimplemented future format',()=>{
    expect(()=>migrateSliceState({...source,death:createDeathState()})).toThrow();
    const current=migrateSliceState(source),{death:_root,...missing}=current;
    expect(()=>migrateSliceState(missing)).toThrow();expect(()=>migrateSliceState({...current,schemaVersion:CURRENT_SCHEMA_VERSION+1})).toThrow();
    const forged=structuredClone(current);forged.death.guidanceKnown=true;expect(()=>assertValidSliceState(forged)).toThrow();
  },120_000);
  it('accepts only exact typed requests,never host state,check,resources,or injected permission',()=>{
    for(const command of[{type:'LEARN_GUIDANCE'},{type:'WORK'},{type:'RETURN_ON_FOOT'},{type:'TRAVEL',to:'DE0-RECEPTION'},{type:'CONSUME',compoundId:'death-compound-1',confirmed:true}])expect(validateSlicePayload({type:'DEATH',command})).toBe(true);
    for(const command of[{type:'CONSUME',compoundId:'death-compound-1',confirmed:false},{type:'WORK',cash:100},{type:'TRAVEL',to:'NOT-A-PLACE'},{type:'SERVICE',command:{type:'ASK_PERMISSION',serviceId:'residue-sealing',consent:'ALLOW'}},{type:'EPILOGUE',command:{type:'PARTIAL_SPIRIT_PASSAGE',roll:1}}])expect(validateSlicePayload({type:'DEATH',command})).toBe(false);
  });
});
