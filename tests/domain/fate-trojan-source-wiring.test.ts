import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Narrow source-wiring regressions. They do not count as a natural route,
// rendered UI, browser, Electron or Windows verification.
const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
function projectionBranch(encounter: 'FATE_TROJAN' | 'DECEIT_MENTOR', property: 'fateTrojan' | 'deceitMentor'): string {
  const projection = source('src/domain/slice/index.ts');
  const begin = projection.indexOf(`if(combat&&s.combat?.encounterId==='${encounter}_DISPUTE')`);
  expect(begin).toBeGreaterThan(-1);
  const end = projection.indexOf(`Object.assign(combat,{${property}:`, begin);
  expect(end).toBeGreaterThan(begin);
  return projection.slice(begin, end);
}

describe('Error pathway public combat wiring', () => {
  it('uses the new opponent implementation for both Fate Trojan public wheels', () => {
    const branch = projectionBranch('FATE_TROJAN', 'fateTrojan');
    expect(branch).toMatch(/combat\.enemyName\s*=\s*projectFateTrojanCombat\(s\)\.enemyName/);
    expect(branch).toMatch(/combat\.enemyCountWheel\s*=\s*FATE_TROJAN_ENEMY_COUNT_WHEEL\.map\(/);
    expect(branch).toMatch(/combat\.enemyAbilityWheel\s*=\s*FATE_TROJAN_ENEMY_ABILITY_WHEEL\.map\(/);
    expect(branch).not.toContain('DECEIT_MENTOR_ENEMY_');
  });

  it('keeps the legacy Deceit Mentor opponent mapped to its own wheels', () => {
    const branch = projectionBranch('DECEIT_MENTOR', 'deceitMentor');
    expect(branch).toMatch(/combat\.enemyName\s*=\s*projectDeceitMentorCombat\(s\)\.enemyName/);
    expect(branch).toMatch(/combat\.enemyCountWheel\s*=\s*DECEIT_MENTOR_ENEMY_COUNT_WHEEL\.map\(/);
    expect(branch).toMatch(/combat\.enemyAbilityWheel\s*=\s*DECEIT_MENTOR_ENEMY_ABILITY_WHEEL\.map\(/);
    expect(branch).not.toContain('FATE_TROJAN_ENEMY_');
  });

  it('authors the exact new 35/25/20/15/5 enemy wheel independently of player stance weighting', () => {
    const combat = source('src/domain/fate-trojan/combat.ts');
    const declared = combat.match(/export\s+const\s+FATE_TROJAN_ENEMY_ABILITY_WHEEL[^=]*=\s*\[([\s\S]*?)\];/);
    expect(declared).not.toBeNull();
    const entries = [...declared![1]!.matchAll(/\{\s*id:\s*'([^']+)'[\s\S]*?weight:\s*(\d+)\s*\}/g)]
      .map(match => ({ id: match[1], weight: Number(match[2]) }));
    expect(entries).toEqual([
      { id: 'FORCE_STRIKE', weight: 35 }, { id: 'GUARD', weight: 25 }, { id: 'BODY_STRIKE', weight: 20 },
      { id: 'DISCERN', weight: 15 }, { id: 'ACCIDENT', weight: 5 },
    ]);
    expect(entries.reduce((total, entry) => total + entry.weight, 0)).toBe(100);
    const draw = combat.match(/export function drawFateTrojanEnemyAbility[\s\S]*?\n\}/);
    expect(draw).not.toBeNull(); expect(draw![0]).toContain('random.nextInt(1, 100)');
    expect(draw![0]).toContain('FATE_TROJAN_ENEMY_ABILITY_WHEEL'); expect(draw![0]).not.toContain('tickets(');
  });

  it('writes BODY on new rounds and keeps legacy Deceit Mentor outcomes out of the mental fallback', () => {
    expect(source('src/domain/slice/fate-trojan-combat.ts')).toMatch(/consequenceDomain:\s*'BODY'/);
    const app = source('src/renderer/SliceApp.tsx');
    expect(app).toMatch(/round\.consequenceDomain\s*===\s*"MENTAL"/);
    const fallback = app.match(/round\.consequenceDomain\s*===\s*undefined\s*&&\s*!\(([^)]+)\)\s*&&\s*round\.consequenceRoll\s*!==\s*undefined/);
    expect(fallback).not.toBeNull();
    expect(fallback![1]).toContain('round.fateTrojanOutcome');
    expect(fallback![1]).toContain('round.deceitMentorOutcome');
    expect(app).toMatch(/败者后果盘：轻伤\s*\{round\.consequenceWeights\.light\}%\s*·\s*重伤/);
    expect(app).toMatch(/\{round\.consequenceWeights\.heavy\}%\s*·\s*死亡/);
  });
});
