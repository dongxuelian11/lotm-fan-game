/* @vitest-environment jsdom */
/** Real871 death capture only; no domain replay or controlled outcome here. */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import type { SliceBridge } from '../../src/shared/slice-contracts.js';
import { readChainedNaturalSnapshot, readChainedNaturalSummary } from '../helpers/chained-natural-capture.js';

afterEach(() => { cleanup(); delete window.sliceGame; vi.resetAllMocks(); vi.restoreAllMocks(); });

it('opens actual871 death as a read-only sealed record without resuming or claiming S0 promotion', async () => {
  const value = readChainedNaturalSnapshot('terminal').public, summary = readChainedNaturalSummary();
  expect(summary.stage).toBe('NATURAL_DEATH');
  expect(value).toMatchObject({ revision:872, status:'DEAD', week:191, health:0, mind:0,
    spirituality:88, cash:320, actionsRemaining:1, progression:{pathwayId:'chained',sequence:1},
    lastCheck:{chance:70,roll:98,tier:'GREAT_FAILURE'}, chained:{promoted:false}, ending:{kind:'DEATH'} });
  expect([value.revision,value.week,value.health,value.mind,value.spirituality])
    .toEqual([summary.revision,summary.actual.week,summary.actual.health,summary.actual.mind,summary.actual.spirituality]);
  const getBootstrap = vi.fn<SliceBridge['getBootstrap']>().mockImplementation(async () => ({ok:true,value:{
    mode:'desktop',activeState:structuredClone(value),runs:[{runId:value.runId,name:value.character.name,
      portraitId:value.character.portraitId,week:value.week,date:value.date,status:value.status,
      revision:value.revision,updatedAt:'2026-10-19T04:00:00.000Z'}],
  }}));
  const loadRun = vi.fn<SliceBridge['loadRun']>().mockImplementation(async runId => {
    expect(runId).toBe(value.runId); return {ok:true,value:structuredClone(value)};
  });
  const submitIntent = vi.fn<SliceBridge['submitIntent']>();
  window.sliceGame = {getBootstrap,loadRun,submitIntent};
  vi.spyOn(window,'scrollTo').mockImplementation(() => {});
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button',{name:/查看封存/}));
  await userEvent.click(screen.getByRole('button',{name:name => name.includes(value.character.name)}));
  expect(await screen.findByRole('heading',{name:value.ending!.title})).toBeTruthy();
  expect(screen.getByText(value.ending!.summary)).toBeTruthy();
  expect(screen.getByText('只读封存卷宗')).toBeTruthy();
  expect(screen.queryByRole('button',{name:'继续生活'})).toBeNull();
  expect(screen.queryByRole('region',{name:value.chained.title})).toBeNull();
  expect(screen.queryByRole('dialog',{name:'战斗回合结果'})).toBeNull();
  expect(loadRun).toHaveBeenCalledTimes(1); expect(submitIntent).not.toHaveBeenCalled();
},30_000);
