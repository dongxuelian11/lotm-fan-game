import {splitLifeGiverBoundaries, verifyLifeGiverBoundaries} from './life-giver-boundary-files.mjs';

// Pure storage conversion and verification. Never imports the game domain,
// reruns a natural/directed branch, deletes the source, or removes old parts.
// Run from the repository root; no compilation is required.
// node --max-old-space-size=512 scripts/play/life-giver-split-boundaries.mjs split [source.json] [fixture-directory]
// node --max-old-space-size=512 scripts/play/life-giver-split-boundaries.mjs verify [source.json] [fixture-directory]
const [mode, source, root = 'tests/fixtures/life-giver-v01680'] = process.argv.slice(2);
if (!source) throw new Error('Supply the retained full output boundaries.json path; delivered fixtures use the index and complete parts.');
if (mode !== 'split' && mode !== 'verify') throw new Error('Expected split or verify; the source is always retained.');
const result = mode === 'split'
  ? await splitLifeGiverBoundaries(source, root)
  : await verifyLifeGiverBoundaries(source, root);
console.log(JSON.stringify({mode, source, sourceRetained: true, ...result}, null, 2));
