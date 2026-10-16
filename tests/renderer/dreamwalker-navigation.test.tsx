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
const from=(folder:string)=>projectSliceState(migrateSliceState(JSON.parse(readFileSync(`tests/fixtures/${folder}/natural.json`,'utf8')).practiced));
beforeEach(()=>{vi.spyOn(window,'scrollTo').mockImplementation(()=>{});});
afterEach(()=>{cleanup();delete window.sliceGame;vi.restoreAllMocks();});
it('opens actual S6 to S5 Audience advancement through permanent growth while preserving injuries',async()=>{
 const c=JSON.parse(readFileSync('tests/fixtures/dreamwalker-v0970/natural.json','utf8')),captureBefore=structuredClone(c.guidanceStart);
 const raw=migrateSliceState(c.guidanceStart),before=structuredClone(raw),state=projectSliceState(raw),displayBefore=structuredClone(state);
 expect(state.recovery.needsAttention).toBe(true);expect(state.injuries).toEqual(before.injuries);
 await enter(state);expect(screen.queryByRole('button',{name:'查看梦境行者晋升'})).toBeNull();
 await userEvent.click(screen.getByRole('button',{name:'非凡成长'}));
 await userEvent.click(screen.getByRole('button',{name:'梦境行者晋升'}));
 expect(c.guidanceStart).toEqual(captureBefore);expect(raw).toEqual(before);expect(state).toEqual(displayBefore);
 expect(screen.getByRole('region',{name:'梦境行者成长下一步'})).toBeTruthy();expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled();
});
it('loads actual peaceful S5 reports before the optional independent battle and opens inherited Hypnotist history',async()=>{
 await enter(from('dreamwalker-v0970'));await userEvent.click(screen.getByRole('button',{name:/非凡成长/}));
 expect(screen.getByRole('region',{name:'梦境行者成长下一步'})).toBeTruthy();
 await userEvent.click(screen.getByRole('button',{name:'催眠师经历'}));
 expect(screen.getByRole('region',{name:'催眠师时期的经历'})).toBeTruthy();expect(window.sliceGame!.submitIntent).not.toHaveBeenCalled();
});
