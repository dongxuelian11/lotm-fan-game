import {expect,it} from 'vitest';
import {projectSliceState} from '../../src/domain/slice/index.js';
import {authenticJusticiarPredecessor,assertJusticiarSourceUnmodified,justiciarHash,justiciarPublicLeaks} from '../helpers/justiciar-scenario.js';
it('keeps actual706 private roots and all allowed public resources while inherited history omits stream internals',()=>{
 const state=authenticJusticiarPredecessor(),hash=justiciarHash(state),random=structuredClone(state.random),view=projectSliceState(state);
 expect(justiciarPublicLeaks(view)).toEqual([]);expect(JSON.stringify(view)).not.toContain(state.random.seed);
 expect(view).toMatchObject({health:93,mind:85,spirituality:120,cash:190,actionsRemaining:2,pollution:20});
 expect(view.progression.mastery).toEqual(state.progression.mastery);expect(view.injuries).toHaveLength(0);
 expect(justiciarHash(state)).toBe(hash);expect(state.random).toEqual(random);assertJusticiarSourceUnmodified();
},60_000);
