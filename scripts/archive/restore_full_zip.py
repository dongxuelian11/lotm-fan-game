#!/usr/bin/env python3
"""Verify and optionally concatenate an ordered full-source ZIP backup.
Python standard library only. Ordinary binary concatenation in the listed order
produces the same ZIP; these parts are not a proprietary archive format.
"""
import argparse
import hashlib
import json
from pathlib import Path


def restore(manifest, output=None):
    manifest = Path(manifest)
    meta = json.loads(manifest.read_text(encoding='utf-8'))
    if meta.get('format') != 'ordered-zip-bytes-v1' or not meta.get('parts'):
        raise ValueError('Unsupported or empty part manifest')
    names = [p['name'] for p in meta['parts']]
    if len(set(names)) != len(names) or any(Path(n).name != n or '\\' in n for n in names):
        raise ValueError('Part names must be unique plain filenames')
    total = 0
    whole = hashlib.sha256()
    target = None
    try:
        if output is not None:
            target = Path(output).open('xb')
        for part in meta['parts']:
            p = manifest.parent / part['name']
            if p.stat().st_size != part['bytes']:
                raise ValueError(f'Wrong part size: {p.name}')
            digest = hashlib.sha256()
            with p.open('rb') as source:
                for block in iter(lambda: source.read(1024 * 1024), b''):
                    digest.update(block)
                    whole.update(block)
                    total += len(block)
                    if target is not None:
                        target.write(block)
            if digest.hexdigest() != part['sha256']:
                raise ValueError(f'Wrong part hash: {p.name}')
        if total != meta['bytes'] or whole.hexdigest() != meta['sha256']:
            raise ValueError('Combined size or SHA256 mismatch')
    finally:
        if target is not None:
            target.close()
    return {'verified': True, 'bytes': total, 'sha256': whole.hexdigest(),
            'output': str(output) if output is not None else None}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', help='The .zip.parts.json file beside all .partNNN files')
    parser.add_argument('--output', help='New ZIP filename; omit to verify without writing')
    args = parser.parse_args()
    print(json.dumps(restore(args.manifest, args.output), ensure_ascii=False))
