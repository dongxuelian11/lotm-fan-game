// Reuse the checked boundary verifier with this stage's explicit source and output.
import { parseArguments, verifySageBoundaries } from './sage-save.mjs';
try {
  const args = process.argv.slice(2);
  if (!args.includes('--source-directory')) args.push('--source-directory', 'tests/fixtures/beauty-goddess-v01900');
  if (!args.includes('--output-directory')) args.push('--output-directory', 'output/qa-0190/sqlite');
  const options = parseArguments(args);
  if (options.help) console.log('Usage: node --expose-gc scripts/play/beauty-goddess-save.mjs --expected-boundaries N [--source-directory DIR] [--tag NAME]');
  else await verifySageBoundaries(options);
} catch (error) { console.error(error); process.exitCode = 1; }
