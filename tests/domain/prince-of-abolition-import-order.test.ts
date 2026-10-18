import { afterEach, expect, it, vi } from 'vitest';

const inherited = [
  'black-emperor.s9.rule-analysis', 'black-emperor.s9.persuasive-argument', 'black-emperor.s9.weak-point-insight',
  'black-emperor.s8.enhanced-body', 'black-emperor.s8.mental-resistance', 'black-emperor.s7.bribery-weakening',
  'black-emperor.s6.distortion', 'black-emperor.s5.disorder', 'black-emperor.s4.bestow',
  'black-emperor.s4.magnify', 'black-emperor.s4.exploit', 'black-emperor.s3.ordered-deviation',
];
afterEach(() => vi.resetModules());
it.each(['entropy-first', 'prince-first'] as const)('initializes %s without a runtime validator cycle or reordered inherited identifiers', async order => {
  vi.resetModules();
  if (order === 'entropy-first') await import('../../src/domain/entropy-duke/index.js');
  else await import('../../src/domain/prince-of-abolition/index.js');
  const entropy = await import('../../src/domain/entropy-duke/index.js');
  const prince = await import('../../src/domain/prince-of-abolition/index.js');
  const types = await import('../../src/domain/entropy-duke/types.js');
  expect(entropy.ENTROPY_DUKE_INHERITED_ABILITY_IDS).toBe(types.ENTROPY_DUKE_INHERITED_ABILITY_IDS);
  expect(types.ENTROPY_DUKE_INHERITED_ABILITY_IDS).toEqual(inherited);
  expect(prince.PRINCE_OF_ABOLITION_INHERITED_ABILITY_IDS).toEqual([
    ...inherited, 'black-emperor.s2.action-amplification', 'black-emperor.s2.effect-prolongation',
  ]);
  expect(new Set(prince.PRINCE_OF_ABOLITION_INHERITED_ABILITY_IDS).size).toBe(14);
  expect(entropy.createEntropyDukeState()).toMatchObject({ guidanceKnown: false, promotionWeek: null });
  expect(prince.createPrinceOfAbolitionState()).toMatchObject({ guidanceKnown: false, promotionWeek: null, gifts: [] });
}, 60_000);
