/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ElderPanel } from '../../src/renderer/ElderPanel.js';
import { projectElder } from '../../src/domain/elder/index.js';
import { originalTemplarFinal, promoted } from '../domain/elder-directed-helper.js';
import type { ElderProjection } from '../../src/domain/elder/types.js';
afterEach(cleanup);
const source=()=>projectElder(originalTemplarFinal());
function show(value:ElderProjection=source(),extra:Partial<Parameters<typeof ElderPanel>[0]>={}){const onCommand=vi.fn();return {...render(<ElderPanel value={value} busy={false} onCommand={onCommand} {...extra}/>),onCommand};}
function openFirst(){fireEvent.click(within(screen.getByRole('region',{name:'当前主要操作'})).getByRole('button'));return screen.getByRole('dialog',{name:'秽语长老操作确认'});}
describe('Elder finite operation panel',()=>{
 it('displays actual original health and still-unconsumed independent bottles',()=>{show();expect(within(screen.getByRole('region',{name:'秽语长老当前资源'})).getByText(/健康40\/100/)).toBeTruthy();expect(screen.getByRole('region',{name:'独立原药瓶'})).toBeTruthy();expect(screen.queryByText(/候选|原文未核|本作G/)).toBeNull();});
 it('cancel never submits a command',()=>{const x=show();const d=openFirst();fireEvent.click(within(d).getByRole('button',{name:'取消，返回查看'}));expect(x.onCommand).not.toHaveBeenCalled();expect(screen.queryByRole('dialog')).toBeNull();});
 it('double confirmation cannot duplicate a pending public intent',()=>{const x=show();const d=openFirst();const b=within(d).getByRole('button',{name:'确认执行这一次操作'});fireEvent.click(b);fireEvent.click(b);expect(x.onCommand).toHaveBeenCalledTimes(1);expect(x.onCommand).toHaveBeenCalledWith({type:'LEARN_GUIDANCE'});});
 it('external busy blocks operations and ordinary page close',()=>{const onClose=vi.fn();show(source(),{busy:true,onClose});for(const b of screen.getAllByRole('button'))expect((b as HTMLButtonElement).disabled).toBe(true);expect(onClose).not.toHaveBeenCalled();});
 it('save error closes confirmation and leaves retry to the owning page',()=>{const value=source(),onCommand=vi.fn();const x=render(<ElderPanel value={value} busy={false} onCommand={onCommand}/>);openFirst();x.rerender(<ElderPanel value={value} busy={false} error="写入失败" onCommand={onCommand}/>);expect(screen.queryByRole('dialog')).toBeNull();expect(screen.getByRole('alert').textContent).toContain('写入失败');expect(onCommand).not.toHaveBeenCalled();});
 it('changed saved facts invalidate an old unsubmitted confirmation',()=>{const value=source(),onCommand=vi.fn();const x=render(<ElderPanel value={value} busy={false} onCommand={onCommand}/>);openFirst();const changed=structuredClone(value);changed.nextStep+=' 当前状态已更新。';x.rerender(<ElderPanel value={changed} busy={false} onCommand={onCommand}/>);expect(screen.queryByRole('dialog')).toBeNull();expect(onCommand).not.toHaveBeenCalled();});
 it('page close submits no movement, resource return or healing',()=>{const onClose=vi.fn(),x=show(source(),{onClose});fireEvent.click(screen.getByRole('button',{name:'返回普通生活'}));expect(onClose).toHaveBeenCalledTimes(1);expect(x.onCommand).not.toHaveBeenCalled();});
 it('promoted original spirit resources are visible and no free full refill is shown',()=>{const v=projectElder(promoted());show(v);expect(screen.getByText(/灵性18，完整度60/)).toBeTruthy();expect(screen.getByText(/灵性27，完整度100/)).toBeTruthy();expect(v.abilities).toHaveLength(15);expect(v.abilities.slice(-2).every(a=>a.mastery===0)).toBe(true);});
});
