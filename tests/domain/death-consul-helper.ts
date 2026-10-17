import {readFileSync} from 'node:fs';
import {readObjectEntry} from '../helpers/read-object-entry.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState,SliceIntent} from '../../src/domain/slice/types.js';
export const deathConsulRoot='tests/fixtures/death-consul-v01730';
export const deathConsulFixturePath=`${deathConsulRoot}/natural.json`;
export const ferrymanFixturePath='tests/fixtures/ferryman-v01490/natural.json';
export const deathLegacyKeys=['corpsecollector','gravedigger','spiritmedium','spiritGuide','gatekeeper','undying','longChapter']as const;
export function deathConsulSnapshot(key='final'):SliceState{return migrateSliceState(key==='final'?readObjectEntry(deathConsulFixturePath,key):JSON.parse(readFileSync(`${deathConsulRoot}/snapshot-${key}.json`,'utf8')));}
export function deathConsulBoundaryNames():string[]{return Object.keys(JSON.parse(readFileSync(`${deathConsulRoot}/boundaries.index.json`,'utf8')));}
export function deathConsulBoundary(name:string):{beforeLast:SliceState;lastIntent:SliceIntent;final:SliceState}{const index=JSON.parse(readFileSync(`${deathConsulRoot}/boundaries.index.json`,'utf8'));const raw=JSON.parse(readFileSync(`${deathConsulRoot}/${index[name]}`,'utf8'));return{beforeLast:migrateSliceState(raw.beforeLast),lastIntent:raw.lastIntent,final:migrateSliceState(raw.final)};}
