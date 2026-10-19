/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SunPanel } from '../../src/renderer/SunPanel.js';
import type { SunProjection } from '../../src/domain/sun/types.js';
// Public-only presentation fixture; it is not natural or SQLite evidence.
const value=():SunProjection=>({title:'太阳晋升准备',guidanceKnown:true,promoted:false,insideCase:false,
 story:'原采光廊和已投降的西拉斯留在原处。洗衣房的热水和莉娜下楼需要实际完成。',
 nextStep:'先停止原炉，再安装已购两枚垫片。',risk:'失败留下真实伤势和污染，严重失败可能死亡。',
 resources:{health:100,mind:98,spirituality:106,cash:'1250便士',actionsRemaining:3},
 abilities:Array.from({length:22},(_,i)=>({id:`inherited-${i}`,label:`原能力${i}`,mastery:i%4===0?0:8,description:'已保存的原掌握。'})),
 actions:[{id:'work',label:'实际劳动',cost:'1行动；本周工资按真实账结算',enabled:true,reason:null,command:{type:'WORK'},preferredAction:true},
 {id:'stop',label:'普通停炉',cost:'0行动、0便士；实际关闭原阀',enabled:true,reason:null,command:{type:'SERVICE',command:{type:'STOP_SERVICE',serviceId:'washhouse-heat'}}},
 {id:'return',label:'沿普通路返回',cost:'0行动、0便士；真实步行',enabled:true,reason:null,command:{type:'RETURN_ON_FOOT'}},
 {id:'consume',label:'服用本瓶魔药',cost:'1行动、30灵性；消耗本瓶载体和准备',enabled:true,reason:null,command:{type:'CONSUME',compoundId:'sun-compound-1',confirmed:true}}],
 sections:[{id:'body',title:'当前身体',lines:['目前没有伤势。']},{id:'clock',title:'实际日历',lines:['第198周，当前在诊疗街区。']},
 {id:'sun-services',title:'热水修复与居民下楼',lines:['两包原衣物尚未完成服务；莉娜还在楼上。']},
 {id:'materials',title:'三份原特性与唯一性',lines:['本人融合原第1份，另外两份需实际交付。']},
 {id:'promotion-stability',title:'本瓶准备',lines:['本次充分准备成功率74%，真实期限七天。']},
 {id:'source-history',title:'原采光廊历史',lines:['原灯油3、残留0、护垫80，旧投降者仍有未治重伤。']}]});
afterEach(()=>{cleanup();vi.resetAllMocks();});
describe('Sun readable public panel',()=>{
 it('shows current resources and actual ordinary services without hiding them in history',()=>{
  const view=render(<SunPanel value={value()} busy={false} onCommand={vi.fn()} injuries={[]} injuryRisk={0}/>);
  expect(document.activeElement).toBe(screen.getByRole('heading',{name:'太阳晋升准备'}));
  expect(screen.getByRole('region',{name:'热水修复与居民下楼'}).closest('details')).toBeNull();
  expect(view.container.textContent).toContain('健康 100 · 精神 98 · 灵性 106 · 1250便士');
  expect(view.container.textContent).not.toMatch(/fixture|randomCursor|sourceDigest|G\d+|原创/);
 });
 it('keeps all22 inherited mastery values including zeros and original history read only',async()=>{
  const current=value();render(<SunPanel value={current} busy={false} onCommand={vi.fn()}/>);
  await userEvent.click(screen.getByText('已掌握的能力',{selector:'summary'}));
  for(const a of current.abilities)expect(screen.getByRole('heading',{name:`${a.label} · 熟练 ${a.mastery}`})).toBeTruthy();
  await userEvent.click(screen.getByText('过往经历与个人账目',{selector:'summary'}));
  const history=screen.getByRole('region',{name:'原采光廊历史'});expect(history.textContent).toContain('原灯油3、残留0、护垫80');expect(within(history).queryAllByRole('button')).toHaveLength(0);
 });
 it('keeps ordinary stop and walk out visible at no cash or actions',()=>{
  const current=value();current.resources.cash='0便士';current.resources.actionsRemaining=0;
  render(<SunPanel value={current} busy={false} onCommand={vi.fn()}/>);
  const exits=screen.getByRole('region',{name:'暂停与安全返回'});
  for(const name of ['普通停炉','沿普通路返回'])expect((within(exits).getByRole('button',{name}) as HTMLButtonElement).disabled).toBe(false);
 });
 it('requires explicit risk confirmation and sends the same original command once',async()=>{
  const command=vi.fn();render(<SunPanel value={value()} busy={false} onCommand={command}/>);
  await userEvent.click(screen.getByRole('button',{name:'服用本瓶魔药'}));expect(command).not.toHaveBeenCalled();
  const dialog=screen.getByRole('dialog',{name:'太阳服药确认'});expect(dialog.textContent).toContain('74%');expect(dialog.textContent).toContain('严重失败可能死亡');
  fireEvent.click(within(dialog).getByRole('button',{name:'确认服用这一份魔药'}));fireEvent.click(within(dialog).getByRole('button',{name:'确认服用这一份魔药'}));
  expect(command).toHaveBeenCalledTimes(1);expect(command).toHaveBeenCalledWith({type:'SUN',command:{type:'CONSUME',compoundId:'sun-compound-1',confirmed:true}});
 });
 it('invalidates an open review after actual public resources change',async()=>{
  const current=value(),command=vi.fn();const view=render(<SunPanel value={current} busy={false} onCommand={command}/>);
  await userEvent.click(screen.getByRole('button',{name:'服用本瓶魔药'}));
  view.rerender(<SunPanel value={{...current,resources:{...current.resources,cash:'1150便士'}}} busy={false} onCommand={command}/>);
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect(command).not.toHaveBeenCalled();
 });
 it('keeps a failed save locked and releases only after changed committed facts arrive',async()=>{
  const current=value(),command=vi.fn();const view=render(<SunPanel value={current} busy={false} onCommand={command}/>);
  await userEvent.click(screen.getByRole('button',{name:'实际劳动'}));expect(command).toHaveBeenCalledTimes(1);
  view.rerender(<SunPanel value={current} busy={false} error="保存失败" onCommand={command}/>);
  expect(screen.getByRole('alert').textContent).toContain('同一次保存');
  fireEvent.click(screen.getByRole('button',{name:'实际劳动'}));expect(command).toHaveBeenCalledTimes(1);
  view.rerender(<SunPanel value={{...current,resources:{...current.resources,cash:'1430便士',actionsRemaining:2}}} busy={false} onCommand={command}/>);
  await waitFor(()=>expect((screen.getByRole('button',{name:'实际劳动'}) as HTMLButtonElement).disabled).toBe(false));
 });
 it('shows real saved injury severity and locks dead or blocked actors',()=>{
  const current=value();current.resources.health=0;render(<SunPanel value={current} busy={false} onCommand={vi.fn()} injuries={[{id:'real',severity:'HEAVY',acquiredRevision:1,treatedRevision:null}]} injuryRisk={2}/>);
  expect(screen.getByRole('region',{name:'当前伤势'}).textContent).toContain('重伤 · 未处理');
  for(const button of screen.getAllByRole('button'))expect((button as HTMLButtonElement).disabled).toBe(true);
 });
});
