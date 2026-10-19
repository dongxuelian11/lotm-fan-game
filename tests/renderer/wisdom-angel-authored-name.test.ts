import { describe, expect, it } from 'vitest';
import { projectSliceState } from '../../src/domain/slice/index.js';
import { projectWisdomAngelCombat,
  WISDOM_ANGEL_COUNT_WHEEL, WISDOM_ANGEL_ENEMY_COUNT_WHEEL, WISDOM_ANGEL_ENEMY_ABILITY_WHEEL,
} from '../../src/domain/wisdom-angel/combat.js';
import { projectPlayerText } from '../../src/shared/player-text.js';
import { wisdomAngelSnapshot } from '../domain/wisdom-angel-helper.js';

describe('the fixed Wisdom Angel opponent display name', () => {
  it('publishes Victor’s actual name and age without changing resources, identities or captured bytes', () => {
    const state = wisdomAngelSnapshot('combatStart');
    const before = structuredClone(state), bytes = JSON.stringify(state);
    const detail = projectWisdomAngelCombat(state), battle = projectSliceState(state).combat;
    expect(detail.enemyName).toBe('维克托（49岁）');
    expect(battle?.enemyName).toBe('维克托（49岁）');
    expect(battle?.wisdomAngel?.enemyName).toBe('维克托（49岁）');
    expect(detail.targetId).toBe('WA2-VICTOR');
    expect(detail).toMatchObject({ playerHealth: state.health, playerMind: state.mind,
      playerSpirituality: state.spirituality, maxSpirituality: 120,
      enemyHealth: state.wisdomAngel.encounter.enemyHealth, enemyMind: state.wisdomAngel.encounter.enemyMind,
      enemySpirituality: state.wisdomAngel.encounter.enemySpirituality, distanceMetres: 2, pursuit: false });
    expect(detail.powerUses).toEqual(state.wisdomAngel.encounter.powerUses);
    expect(detail.abilityUses).toEqual(state.wisdomAngel.encounter.abilityUses);
    expect(detail.observations).toEqual(state.wisdomAngel.encounter.observations);
    expect(detail.room).toEqual(state.wisdomAngel.encounter.room);
    expect(detail.crafts).toEqual(state.mysticismMagister.crafts);
    expect(detail).not.toHaveProperty('source');
    expect(battle?.wisdomAngel).not.toHaveProperty('source');
    expect(detail.countWheel).toEqual(WISDOM_ANGEL_COUNT_WHEEL);
    expect(detail.enemyCountWheel).toEqual(WISDOM_ANGEL_ENEMY_COUNT_WHEEL);
    expect(detail.enemyAbilityWheel).toEqual(WISDOM_ANGEL_ENEMY_ABILITY_WHEEL);
    expect(detail.enemyAbilityWheel.map(({ id, weight }) => [id, weight])).toEqual([
      ['FLASH', 35], ['WARD', 25], ['BODY_STRIKE', 20], ['FEINT', 15], ['ACCIDENT', 5],
    ]);
    expect(state).toEqual(before);
    expect(JSON.stringify(state)).toBe(bytes);
    expect(state.random).toEqual(before.random);
    expect(state.combatHistory).toEqual(before.combatHistory);
  });

  it.each(['候选智慧天使G', 'G·原创记录员', '维克托（49岁，原创有限G2非凡者）'])
    ('keeps custom names and enemyName outside generic prose conversion: %s', name => {
      const original = { enemyName: name, name, character: { name }, command: { target: name }, random: { seed: name, cursor: 17 } };
      const bytes = JSON.stringify(original), shown = projectPlayerText(original, name);
      expect(shown).toEqual(original);
      expect(shown.enemyName).toBe(name);
      expect(shown.name).toBe(name);
      expect(shown.character).toBe(original.character);
      expect(shown.command).toBe(original.command);
      expect(shown.random).toBe(original.random);
      expect(JSON.stringify(original)).toBe(bytes);
    });
});
