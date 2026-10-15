# Complete test fixtures

This directory ships every fixture archive part. `manifest.json` records the exact byte length and SHA-256 of each part and every original fixture file. The archives preserve paths beginning with `诡秘/tests/fixtures/`; the restore script removes that one archive-root component when mapping files back into the repository.

## Requirements

- Node.js 18 or newer; no npm packages or external tar executable are needed.
- A filesystem that supports hard links for atomic, no-overwrite installation. Ordinary Linux and macOS local filesystems support this.
- Enough free space for the selected uncompressed fixtures. A complete restore is approximately 3.7 GB; compressed download size is much smaller. The manifest is the source of truth for exact sizes.

Run commands from the repository root. Keep all archive parts, the manifest, and the restore script together in `test-inputs/`.

## Full restore

```sh
node test-inputs/restore-test-inputs.mjs --repo .
```

This restores all fixtures to `tests/fixtures/`. It verifies every compressed part before writing anything, checks all archive headers and paths, and verifies every file's uncompressed SHA-256. Identical existing files are kept. A differing existing file is never overwritten.

To validate everything without writing fixtures:

```sh
node test-inputs/restore-test-inputs.mjs --repo . --dry-run
```

## Bounded restore for a representative acceptance run

Choose the exact fixture directories required by the acceptance tests from `manifest.json`. Repeat `--only-prefix` for additional directories. Directory matching is component-aware: `campaign` matches `campaign/example.json`, not `campaign-extra/example.json`.

```sh
node test-inputs/restore-test-inputs.mjs --repo . \
  --only-prefix DIRECTORY_FROM_MANIFEST \
  --only-prefix ANOTHER_DIRECTORY_FROM_MANIFEST \
  --max-bytes 268435456
```

Replace the uppercase placeholders with real directories. Prefixes can be relative to `tests/fixtures/` or start with `tests/fixtures/`. `--max-bytes` rejects a selection whose total uncompressed file sizes exceed the bound; it does not silently omit files. The example bound is 256 MiB.

A prefix restore still verifies every archive part and every archived fixture hash. It writes only selected files, streams large payloads without buffering them whole, and does not unpack unselected fixtures. All archive parts remain included in the release. A representative restore is not a claim that the complete fixture-dependent suite has run.

## Restore a separate copy

If fixtures in your checkout have local edits, keep them and restore elsewhere:

```sh
node test-inputs/restore-test-inputs.mjs --repo . \
  --destination /existing/parent/restored-fixtures
```

The destination is the fixture-root directory itself, so a manifest entry `tests/fixtures/group/a.json` becomes `/existing/parent/restored-fixtures/group/a.json`. Its parent must already exist. The default test suite continues to use the checkout's `tests/fixtures/`; a separate destination is for inspection or manual comparison.

## Restore-script checks

```sh
node --test test-inputs/restore-test-inputs.test.mjs
```

These small, self-contained tests generate temporary archives. They cover full and prefix restores, Unicode/PAX filenames, checksums, dry runs, disk-size bounds, differing existing files, traversal, links, unsafe entry types, and missing or duplicate members. They do not run npm or change project test rules.

## Format and safety

The manifest format is `lotm-test-inputs-v1`. Required fields:

```json
{
  "format": "lotm-test-inputs-v1",
  "parts": [{ "name": "fixtures-part-1.tar.gz", "bytes": 123, "sha256": "64 lowercase hex characters" }],
  "fileEntries": [{ "path": "tests/fixtures/group/a.json", "bytes": 456, "sha256": "64 lowercase hex characters" }]
}
```

The restore script intentionally supports the release's regular-file USTAR/PAX subset, including bounded local PAX metadata for Unicode and long paths. It rejects symlinks, hard links, global PAX headers, directories, devices, unknown entry types, unsafe paths, and unsupported PAX metadata. It never applies archive owners, executable permissions, or special-file metadata. Destination symlinks below the selected root boundary are rejected.

Each new file is written to a sibling temporary file, verified, and installed with an atomic no-overwrite hard link. Existing differing files are preserved, including if another process creates one just before installation. Run restoration without other processes editing fixture directories. If restoration fails or is interrupted, previously installed, verified files can remain; rerunning keeps identical files and resumes the missing files. A forcibly killed process may leave a hidden `.fixture-restore-*.tmp` file beside a fixture; inspect and remove such temporary files before retrying if disk space is tight.

Checksums detect missing, damaged, or changed release contents; they do not authenticate an untrusted replacement of both the manifest and its archives. Use the manifest and parts from the intended release together.
