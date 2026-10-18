import {it,expect} from 'vitest';
import {startTwilightGiant} from '../../src/domain/twilight-giant/engine.js';
import {twilightGiantSourceBlock} from '../../src/domain/twilight-giant/source.js';
import {authenticTwilightSource} from '../helpers/twilight-giant-scenario.js';
it('admits the real living287-command boundary without changing old originals',()=>{const source=authenticTwilightSource();expect(twilightGiantSourceBlock(source)).toBeNull();const chapter=startTwilightGiant(source);expect(chapter.source!.budget.cash).toBe(845);expect(chapter.frame!.budget.cash).toBe(745);expect(chapter.works!.origin.site).toEqual(source.glory.life.site);});
