/* @vitest-environment jsdom */
import type { SliceBridge } from "../../src/shared/slice-contracts";
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {readFileSync} from 'node:fs';
import {SliceApp} from '../../src/renderer/SliceApp';
import {migrateSliceState} from '../../src/domain/slice/migration';
import {projectSliceState} from '../../src/domain/slice';
import type {SliceProjection} from '../../src/domain/slice/types';
async function enter(state:SliceProjection){
 window.sliceGame={getBootstrap:vi.fn<SliceBridge["getBootstrap"]>(async()=>({ok:true,value:{mode:'browser',activeState:state,runs:[{runId:state.runId,name:state.character.name,portraitId:state.character.portraitId,week:state.week,date:state.date,status:state.status,revision:state.revision,updatedAt:'2026-10-12T00:00:00Z'}]}})),loadRun:vi.fn<SliceBridge["loadRun"]>(async()=>({ok:true,value:state})),submitIntent:vi.fn()};
 render(<SliceApp/>);await userEvent.click(await screen.findByRole('button',{name:/继续游戏/}));await userEvent.click(screen.getByRole('button',{name:new RegExp(state.character.name)}));await screen.findByRole('heading',{name:'人物卷宗'});const reveal=screen.queryByRole('dialog',{name:'战斗回合结果'});if(reveal)await userEvent.click(within(reveal).getByRole('button',{name:'返回生活'}));
}
const from=(folder:string)=>projectSliceState(migrateSliceState(JSON.parse(readFileSync(`tests/fixtures/${folder}/natural.json`,'utf8')).final));
beforeEach(()=>{vi.spyOn(window,'scrollTo').mockImplementation(()=>{});});
afterEach(()=>{cleanup();delete window.sliceGame;vi.restoreAllMocks();});
it('keeps actual injured S7 advancement discoverable while the dashboard prioritizes recovery',async()=>{
 const c=JSON.parse(readFileSync('tests/fixtures/polymath-v0790/shared-stage-natural.json','utf8'));
 const saved=migrateSliceState(c.guidanceStart),savedBefore=structuredClone(saved);
 const state=projectSliceState(saved),before=structuredClone(state);
 // The original guidance boundary still contains its real untreated injury. Do not heal the fixture to recover an old shortcut.
 expect(saved).toMatchObject({health:70,injuryRisk:0,progression:{pathwayId:'white-tower',sequence:7}});
 expect(saved.injuries.filter(injury=>injury.severity==='HEAVY'&&injury.treatedRevision===null)).toHaveLength(1);
 expect(state.recovery).toMatchObject({needsAttention:true,locked:false,nextAction:{kind:'INVESTIGATE',label:'查看普通诊疗点',enabled:true}});
 await enter(state);
 const guide=screen.getByRole('region',{name:'接下来'});
 expect(within(guide).getByRole('heading',{name:'先查看伤势恢复路线'})).toBeTruthy();
 expect((within(guide).getByRole('button',{name:'查看普通诊疗点'}) as HTMLButtonElement).disabled).toBe(false);
 // Recovery priority is guidance, not a lock on reading the actual next-stage acquisition page.
 await userEvent.click(screen.getByRole('button',{name:'非凡成长'}));
 const promotion=within(screen.getByRole('group',{name:'选择成长卷宗'})).getByRole('button',{name:'博学者晋升'}) as HTMLButtonElement;
 expect(promotion.disabled).toBe(false);await userEvent.click(promotion);
 expect(screen.getByRole('region',{name:'博学者成长下一步'})).toBeTruthy();
 const guidance=state.polymath.actions.find(action=>action.command.type==='LEARN_GUIDANCE');
 expect(guidance).toBeTruthy();expect(guidance!.enabled).toBe(true);
 const actualControls=screen.getAllByRole('button',{name:name=>name.startsWith(guidance!.label)}) as HTMLButtonElement[];
 expect(actualControls.every(button=>!button.disabled)).toBe(true);
 expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled();expect(saved).toEqual(savedBefore);expect(state).toEqual(before);
});
it('loads actual S6 reports and opens current growth plus inherited Detective history',async()=>{
 await enter(from('polymath-v0790'));await userEvent.click(screen.getByRole('button',{name:/非凡成长/}));
 expect(screen.getByRole('region',{name:'博学者成长下一步'})).toBeTruthy();
 await userEvent.click(screen.getByRole('button',{name:'守知者经历'}));
 expect(screen.getByRole('region',{name:'守知者时期的经历'})).toBeTruthy();expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled();
});
