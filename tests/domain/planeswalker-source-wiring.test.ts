import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Narrow static regression checks only. Runtime projection and actual battle
// assertions belong in the recorded campaign integration suite once available.
const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
describe('Door pathway public combat wiring', () => {
  it('maps the Wanderer enemy wheels from its actual opponent implementation', () => {
    const projection = source('src/domain/slice/index.ts');
    const branch = projection.match(/if\s*\(combat\s*&&\s*s\.combat\?\.encounterId\s*===\s*['"]WANDERER_DISPUTE['"]\)\s*\{([\s\S]*?)Object\.assign\(combat,\{wanderer:projectWandererCombat\(s\)\}\);/);
    expect(branch).not.toBeNull();
    expect(branch![1]).toMatch(/combat\.enemyCountWheel\s*=\s*WANDERER_ENEMY_COUNT_WHEEL\.map\(/);
    expect(branch![1]).toMatch(/combat\.enemyAbilityWheel\s*=\s*WANDERER_ENEMY_ABILITY_WHEEL\.map\(/);
  });

  it('routes both real Door-pathway injury outcomes to the physical consequence panel', () => {
    const app = source('src/renderer/SliceApp.tsx');
    const mentalGuard = app.match(/!\(([^)]+)\)\s*&&\s*round\.consequenceRoll\s*!==\s*undefined\s*&&\s*round\.pendingConsequence\s*===\s*undefined/);
    expect(mentalGuard).not.toBeNull();
    expect(mentalGuard![1]).toContain('round.planeswalkerOutcome');
    expect(mentalGuard![1]).toContain('round.wandererOutcome');
    expect(app).toMatch(/败者后果盘：轻伤\s*\{round\.consequenceWeights\.light\}%\s*·\s*重伤/);
    expect(app).toMatch(/\{round\.consequenceWeights\.heavy\}%\s*·\s*死亡/);
  });
});
