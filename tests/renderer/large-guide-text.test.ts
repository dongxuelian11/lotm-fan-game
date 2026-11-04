import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/renderer/slice-styles.css', 'utf8');
// Source-level typography contract; native layout is checked separately.
const ruleFor = (selector: string) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter(([, selectors]) => (selectors ?? "").trim().split(',').map(s => s.trim()).includes(selector))
  .map(([, , body]) => (body ?? "").trim());

describe('daily next-step guide large-text typography', () => {
  it('uses the existing supporting-prose and interactive-label large-text scales', () => {
    expect(ruleFor('.slice-large-text .slice-next-guide p')).toEqual(['font-size: 21px;']);
    expect(ruleFor('.slice-large-text .slice-guide-links .slice-button')).toEqual(['font-size: 22px;']);
    expect(ruleFor('.slice-large-text .slice-next-guide p')).toEqual(ruleFor('.slice-large-text .slice-definition dt'));
    expect(ruleFor('.slice-large-text .slice-guide-links .slice-button')).toEqual(ruleFor('.slice-large-text .slice-settings label'));
  });
  it('retains normal text, wrapping and minimum button target sizes', () => {
    expect(ruleFor('.slice-next-guide p')[0]).toContain('font-size: 17px');
    expect(ruleFor('.slice-guide-links .slice-button')[0]).toContain('font-size: 17px');
    expect(ruleFor('.slice-guide-links .slice-button')[0]).toContain('min-height: 44px');
    expect(ruleFor('.slice-guide-links')[0]).toContain('flex-wrap: wrap');
  });
});
