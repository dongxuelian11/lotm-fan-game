import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readObjectEntry } from '../helpers/read-object-entry.js';
describe('bounded fixture entry streaming',()=>{
 it('reads UTF8, escapes, containers and primitive entries across chunks',()=>{
  const dir=mkdtempSync(join(tmpdir(),'lotm-fixture-reader-')),file=join(dir,'entries.json');
  const data={prefix:'文'.repeat(70000), nested:{text:'引号"与斜线\\和😀'.repeat(8000), values:[1,null,{a:'} , "'}]}, string:'正文', no:null, yes:true, number:17, empty:[]};
  try{writeFileSync(file,JSON.stringify(data));for(const key of Object.keys(data))expect(readObjectEntry(file,key)).toEqual(data[key as keyof typeof data]);expect(()=>readObjectEntry(file,'missing')).toThrow('Missing');}finally{rmSync(dir,{recursive:true});}
 });
});
