/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CombatRoulette, countNeedleAngle, outcomeNeedleAngle } from '../../src/renderer/CombatRoulette';
import type { SlicePublicCombatRound } from '../../src/domain/slice/types';
// jsdom lacks AnimationEvent; React selects the supported WebKit-prefixed event.
const saved: SlicePublicCombatRound = { round: 2, stance: 'ATTACK', first: 'PLAYER', playerCount: 2, enemyCount: 1,
  playerCountRoll: 34, enemyCountRoll: 15, moves: [], playerAdvantage: 198.72000000000003, enemyAdvantage: 122,
  winChance: 61.963082314792966, winner: 'PLAYER', consequence: '原回合后果', consequenceWeights: null, retreat: 'NONE' };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('public saved roulette geometry', () => {
  it.each([[1,0],[25,86.4],[100,356.4],[0,null],[101,null],[1.5,null],[NaN,null],[undefined,null]])('uses the actual d100 position %s', (roll, angle) => {
    if (angle === null) expect(countNeedleAngle(roll)).toBeNull(); else expect(countNeedleAngle(roll)).toBeCloseTo(angle!);
  });
  it('uses exact probability shares and saved winner, not a second draw', () => {
    expect(outcomeNeedleAngle(saved)).toBeCloseTo(saved.winChance * 1.8);
    expect(outcomeNeedleAngle({...saved, winner:'ENEMY'})).toBeCloseTo(saved.winChance * 3.6 + (100-saved.winChance)*1.8);
    expect(outcomeNeedleAngle({...saved, winChance:100})).toBe(180);
    expect(outcomeNeedleAngle({...saved, winChance:0, winner:'ENEMY'})).toBe(180);
    for (const round of [null, {...saved, retreat:'SUCCESS' as const}, {...saved,winner:null}, {...saved,winChance:0}, {...saved,winChance:100,winner:'ENEMY' as const}, {...saved,winChance:NaN}, {...saved,winChance:-1}]) expect(outcomeNeedleAngle(round)).toBeNull();
  });
});
describe('saved roulette presentation', () => {
  it('keeps saved-result status identical after a fast display is unmounted and reopened', () => {
    const first = render(<CombatRoulette round={saved} fast/>);
    const original = first.container.textContent;
    expect(screen.getByText('结果已保存，动画仅作演示')).toBeTruthy();
    first.unmount();
    const reopened = render(<CombatRoulette round={saved}/>);
    expect(reopened.container.querySelector('.is-moving')).toBeNull();
    expect(reopened.container.textContent).toBe(original);
  });
  it('starts loaded history still, replays and skips without mutating input', () => {
    const before=JSON.stringify(saved); const {container}=render(<CombatRoulette round={saved} history/>);
    expect(container.querySelector('.is-moving')).toBeNull();
    expect(screen.getByText('结果已保存，动画仅作演示')).toBeTruthy();
    expect(screen.getByText('原骰 34 / 100')).toBeTruthy();
    expect(screen.getByText('你的胜率约 62%')).toBeTruthy();
    expect(screen.queryByText(/本回合胜率约/)).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'重播演示'}));
    expect(container.querySelectorAll('.is-moving')).toHaveLength(3);
    expect(screen.getByText('结果已保存，动画仅作演示')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'跳过动画'}));
    expect(container.querySelector('.is-moving')).toBeNull();
    expect(screen.getByText('结果已保存，动画仅作演示')).toBeTruthy();
    expect(JSON.stringify(saved)).toBe(before);
  });
  it('animates only a new result transition, finishes without timers, and resets planning', () => {
    const {container,rerender}=render(<CombatRoulette round={null} playerWeights={[{id:'one',label:'1次',weight:100}]}/>);
    expect(screen.getByText(/当前你的次数分布/)).toBeTruthy();
    expect(container.querySelector('.roulette-needle')).toBeNull();
    rerender(<CombatRoulette round={saved}/>);
    expect(container.querySelectorAll('.is-moving')).toHaveLength(3);
    expect(screen.getByText('结果已保存，动画仅作演示')).toBeTruthy();
    fireEvent(container.querySelectorAll('.is-moving')[2]!, new Event('webkitAnimationEnd', { bubbles: true }));
    expect(container.querySelector('.is-moving')).toBeNull();
    expect(screen.getByText('结果已保存，动画仅作演示')).toBeTruthy();
    rerender(<CombatRoulette round={{...saved}}/>);
    expect(container.querySelector('.is-moving')).toBeNull();
    expect(screen.getByText('结果已保存，动画仅作演示')).toBeTruthy();
    rerender(<CombatRoulette round={null}/>);
    expect(screen.getAllByText('待结算')).toHaveLength(3);
  });
  it('never spins a successful retreat outcome or invents missing winner', () => {
    const {container,rerender}=render(<CombatRoulette round={{...saved,retreat:'SUCCESS',winner:'ENEMY'}} history/>);
    fireEvent.click(screen.getByRole('button',{name:'重播演示'}));
    expect(container.querySelectorAll('.is-moving')).toHaveLength(2);
    expect(container.querySelector('.roulette-outcome .roulette-needle')).toBeNull();
    expect(screen.getByText('未进入胜负盘')).toBeTruthy();
    fireEvent(container.querySelectorAll('.is-moving')[1]!, new Event('webkitAnimationEnd', { bubbles: true }));
    expect(container.querySelector('.is-moving')).toBeNull();
    expect(screen.getByText('结果已保存，动画仅作演示')).toBeTruthy();
    rerender(<CombatRoulette round={{...saved,winner:null}} history/>);
    expect(container.querySelector('.roulette-outcome .roulette-share-player')).toBeNull();
    expect(screen.getByText('未决出胜负')).toBeTruthy();
    expect(screen.queryByText('平局')).toBeNull();
    expect(screen.queryByText('未进入胜负盘')).toBeNull();
  });
  it('stops on fast mode and does not restart when fast is turned off', () => {
    const {container,rerender}=render(<CombatRoulette round={saved}/>);
    fireEvent.click(screen.getByRole('button',{name:'重播演示'}));
    rerender(<CombatRoulette round={saved} fast/>);
    expect(container.querySelector('.is-moving')).toBeNull();
    expect(screen.getByText('结果已保存，动画仅作演示')).toBeTruthy();
    expect(screen.getByRole('button',{name:'重播演示'}).hasAttribute('disabled')).toBe(true);
    rerender(<CombatRoulette round={saved}/>);
    expect(container.querySelector('.is-moving')).toBeNull();
    expect(screen.getByText('结果已保存，动画仅作演示')).toBeTruthy();
  });
  it('honors reduced motion changes and cleans its listener', () => {
    let listener=()=>{}; const remove=vi.fn(); const media={matches:false,addEventListener:vi.fn((_name:string,fn:()=>void)=>{listener=fn;}),removeEventListener:remove};
    vi.stubGlobal('matchMedia',vi.fn(()=>media));
    const {container,unmount}=render(<CombatRoulette round={saved}/>);
    fireEvent.click(screen.getByRole('button',{name:'重播演示'}));
    act(()=>{media.matches=true;listener();});
    expect(container.querySelector('.is-moving')).toBeNull();
    expect(screen.getByText('结果已保存，动画仅作演示')).toBeTruthy();
    expect(screen.getByRole('button',{name:'跳过动画'}).hasAttribute('disabled')).toBe(true);
    unmount(); expect(remove).toHaveBeenCalled();
  });
  it('does not project current weights into a saved round', () => {
    render(<CombatRoulette round={saved} history playerWeights={[{id:'unknown',label:'不应重建',weight:88}]}/>);
    expect(screen.queryByText(/不应重建/)).toBeNull();
    expect(screen.getByText(/不还原原胜负骰/)).toBeTruthy();
  });
});
