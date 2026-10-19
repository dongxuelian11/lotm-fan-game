#!/usr/bin/env python3
"""Death217 public-input recipe. PREPARED ONLY; run after serial audits finish.

From repository root: python3 output/rebuild-0217/package-new217-inputs.py
Optional --chain-dir DIR reconstructs the identical 115 capture files in a
temporary directory from original1039 + ten final delta parts, without running
the producer. The pinned two chain manifests must also be in DIR. Runtime parts
are unnecessary for repacking bytes. Pale195's five existing public parts and
the separate exact original173 natural source remain required dependencies.

Required committed recipe inputs (include these in the source recovery patch):
  - This recipe, test-inputs/restore-test-inputs.mjs and test-inputs/manifest.json.
  - test-inputs/death-v02170-capture-files.json, pinned in PINS.
  - test-inputs/pale195-rebuild217.manifest.json, pinned in PINS to SHA-256
    93554b87a7b792ad217abc0fed923a185bc4d10444c7573ad7c462df22957e31.
    This small five-part/238-member subset MUST be committed; its presence in an
    earlier working directory or output archive is not a restoration contract.

Complete --chain-dir prerequisites:
  - DIR contains the pinned BASE and DELTA manifests named below, the exact base
    capture tar named by BASE.capture, and all ten tar parts named by DELTA.parts.
    The two runtime tars are not read by this byte-repacking recipe.
  - The committed inputs above exist. The global manifest is either the pinned
    pre217 version or the final0.217.0 version whose Death entries/part SHAs match.
  - All five original195 public tars named by pale195-rebuild217.manifest.json
    exist unchanged in test-inputs. This recipe needs all five even in chain mode.
  - tests/fixtures/death-consul-v01730/natural.json exists as the separate exact
    6,509,067-byte original173 source with SOURCE173_SHA below. The1039+delta
    chain does not supply it; restore it from its separately retained source.
  - Python3.12.14/zlib1.3.2 and Node18+ are available. Run from repository root;
    test-inputs and output/rebuild-0217 already exist, without symlink redirects.
  - All eleven new tar targets, four metadata/proof targets, and the global
    manifest candidate are absent. Existing targets are blockers; never delete
    them merely to rerun. In chain mode, no pre-existing Death217 fixture is needed.

Writes new public tars/manifests and a proof under test-inputs; writes an updated
global-manifest CANDIDATE under output/rebuild-0217 for parent review. Does not
replace the global manifest, edit product/CI files, build, run gameplay or SQLite.
Same tar SHA requires the pinned Python/zlib toolchain and exact input bytes.
"""
import argparse
import gzip
import hashlib
import io
import json
import os
import pathlib
import stat
import subprocess
import sys
import tarfile
import tempfile
import zlib

ROOT = pathlib.Path.cwd()
OUT = ROOT / "test-inputs"
CAP = "output/rebuild-0217/natural-v1"
FIX = "tests/fixtures/death-v02170"
SOURCE173 = "tests/fixtures/death-consul-v01730/natural.json"
SOURCE173_SHA = "283fa4554282597027a6e65f2a31c561750769fb3f93343e570abebac11fdee9"
BASE = "lotm_death217_natural1039_runtime_manifest_20261018.json"
DELTA = "lotm_death217_natural1040-1141_delta_manifest_20261018.json"
PINS = {
    "test-inputs/manifest.json": "081a3603d9e77e04a2b2a82b3bb0aa36239be76000b2a703294e52902b34e65d",
    "test-inputs/pale195-rebuild217.manifest.json": "93554b87a7b792ad217abc0fed923a185bc4d10444c7573ad7c462df22957e31",
    "test-inputs/death-v02170-capture-files.json": "4e2232144263b7ae2272dd9518e3369de82db6c28b32c967bf3a1de12e860289",
    BASE: "6a23a1a09f07ab2e926a73426fa6c18b045bd4fd92569ae0d6fcb9e83216858a",
    DELTA: "71e7179e69c115901682916124e0529a61bdc9cfa84c2d191b9c611cc5bc9ec1",
}
DERIVED = {"boundaries.index.json", "checkpoint.json.gz", "commands.ndjson.gz",
           "natural.json.gz", "summary.json", "recovery-manifest.json"}
LIMIT = 15_000_000
sha = lambda data: hashlib.sha256(data).hexdigest()


def need(ok, message):
    if not ok:
        raise RuntimeError(message)


def safe(path):
    for p in [path, *path.parents]:
        need(not p.is_symlink(), f"Symlink refused: {p}")
    return path


def read(path):
    safe(path)
    before = path.stat()
    need(stat.S_ISREG(before.st_mode), f"Not a regular file: {path}")
    data = path.read_bytes()
    after = path.stat()
    keys = ("st_dev", "st_ino", "st_size", "st_mtime_ns", "st_ctime_ns")
    need(all(getattr(before, k) == getattr(after, k) for k in keys), f"Read drift: {path}")
    return data


def pin(path):
    data = read(path)
    return {"bytes": len(data), "sha256": sha(data)}


def load(path, digest):
    data = read(path)
    need(sha(data) == digest, f"Pinned metadata changed: {path}")
    return json.loads(data)


def save(path, value):
    safe(path)
    with path.open("xb") as stream:
        stream.write((json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode())


def restore_chain(chain, destination, base, delta, expected):
    seen = set()
    for index, part in enumerate([base["capture"], *delta["parts"]]):
        path = chain / part["name"]
        need(pin(path) == {"bytes": part["bytes"], "sha256": part["sha256"]}, "Chain part changed")
        local = set()
        with tarfile.open(path, "r:gz") as archive:
            for member in archive:
                name = member.name.removeprefix(CAP + "/")
                need(member.name == CAP + "/" + name and name in expected and "/" not in name and
                     member.isfile() and not member.linkname and not member.sparse and not member.pax_headers,
                     f"Unknown/unsafe chain member: {member.name}")
                need(name not in local and (name not in seen or index > 0 and name in DERIVED), "Unexpected duplicate overlay")
                local.add(name)
                data = archive.extractfile(member).read()
                if index > 0 or name not in DERIVED:
                    need({"bytes": len(data), "sha256": sha(data)} == expected[name], "Chain member drift")
                if index > 0:
                    declared = {x["path"]: x for x in part["members"]}
                    need(member.name in declared and declared[member.name]["sha256"] == sha(data) and
                         declared[member.name]["bytes"] == len(data), "Undeclared delta member")
                target = destination / name
                with target.open("wb" if name in seen else "xb") as stream:
                    stream.write(data)
                seen.add(name)
        count = part["members"] if index == 0 else len(part["members"])
        need(len(local) == count, "Incomplete chain part")
    need(seen == set(expected), "Incomplete original1039 + delta chain")


def pack(staged, name, group, sources):
    with (staged / name).open("xb") as raw:
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0, compresslevel=6) as zipped:
            with tarfile.open(fileobj=zipped, mode="w|", format=tarfile.PAX_FORMAT,
                              encoding="utf-8", errors="strict") as archive:
                for entry in group:
                    data = read(sources[entry["path"]])
                    need({"bytes": len(data), "sha256": sha(data)} ==
                         {k: entry[k] for k in ("bytes", "sha256")}, "Fixture drift")
                    info = tarfile.TarInfo("诡秘/" + entry["path"])
                    info.size, info.mode, info.mtime = len(data), 0o644, 0
                    info.uid = info.gid = 0
                    info.uname = info.gname = ""
                    archive.addfile(info, io.BytesIO(data))
    evidence = pin(staged / name)
    need(evidence["bytes"] < 32 * 1024 * 1024, f"Part exceeds 32 MiB: {name}")
    return {"name": name, **evidence, "members": [x["path"] for x in group]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--chain-dir", type=pathlib.Path)
    args = parser.parse_args()
    need(sys.version_info[:3] == (3, 12, 14) and zlib.ZLIB_VERSION == zlib.ZLIB_RUNTIME_VERSION == "1.3.2",
         "Exact-byte recipe requires Python 3.12.14 and zlib 1.3.2")
    global_bytes = read(ROOT / "test-inputs/manifest.json")
    global_manifest = json.loads(global_bytes)
    need(sha(global_bytes) == PINS["test-inputs/manifest.json"] or
         args.chain_dir is not None and global_manifest.get("version") == "0.217.0",
         "Use the pinned pre217 global manifest, or --chain-dir with the final217 manifest")
    pale = load(ROOT / "test-inputs/pale195-rebuild217.manifest.json", PINS["test-inputs/pale195-rebuild217.manifest.json"])
    capture = load(ROOT / "test-inputs/death-v02170-capture-files.json", PINS["test-inputs/death-v02170-capture-files.json"])
    chain = args.chain_dir or ROOT.parent / "checkpoints"
    base, delta = load(chain / BASE, PINS[BASE]), load(chain / DELTA, PINS[DELTA])
    expected = {x["file"]: {k: x[k] for k in ("bytes", "sha256")} for x in capture["files"]}
    need(len(expected) == len(capture["files"]) == 115 and sum(x["bytes"] for x in expected.values()) == 133515074,
         "Wrong final217 inventory")
    need(expected == {pathlib.PurePosixPath(x["path"]).name: {k: x[k] for k in ("bytes", "sha256")}
                      for x in delta["completeFinalCaptureInventory"]}, "Inventory/Library chain mismatch")
    source173 = next(x for x in global_manifest["fileEntries"] if x["path"] == SOURCE173)
    need(source173["sha256"] == SOURCE173_SHA and source173["bytes"] == 6509067, "Wrong original173 source")
    need(len(pale["parts"]) == 5 and len(pale["fileEntries"]) == 238, "Wrong Pale195 restoration closure")
    existing = {x["path"]: x for x in global_manifest["fileEntries"]}
    need(all(existing.get(x["path"]) == x for x in pale["fileEntries"]), "Global/Pale195 member disagreement")
    registered = [x for x in global_manifest["fileEntries"] if x["path"].startswith(FIX + "/")]
    need(not registered or args.chain_dir is not None and
         {x["path"].removeprefix(FIX + "/"): {k: x[k] for k in ("bytes", "sha256")} for x in registered} == expected,
         "Existing Death217 registration differs; refuse duplicate update")
    candidate = ROOT / "output/rebuild-0217/test-inputs-manifest217.candidate.json"
    need(not os.path.lexists(candidate), f"Candidate already exists: {candidate}")
    with tempfile.TemporaryDirectory(prefix=".death217-public-", dir=safe(OUT)) as tmp:
        staged = pathlib.Path(tmp)
        fixture = ROOT / FIX
        if args.chain_dir:
            fixture = staged / "restored-capture"
            fixture.mkdir()
            restore_chain(chain, fixture, base, delta, expected)
        need({p.name for p in safe(fixture).iterdir()} == set(expected), "Unknown/missing fixture member")
        entries = [{"path": FIX + "/" + name, **expected[name]} for name in sorted(expected)]
        sources = {x["path"]: fixture / pathlib.PurePosixPath(x["path"]).name for x in entries}
        sources[SOURCE173] = ROOT / SOURCE173
        groups, group, size = [], [], 0
        for entry in entries:
            n = entry["bytes"] + 2048  # Same conservative rule as the216 packer.
            need(n < LIMIT, "Single member exceeds deterministic group budget")
            if group and size + n > LIMIT:
                groups.append(group)
                group, size = [], 0
            group.append(entry)
            size += n
        if group:
            groups.append(group)
        names = [f"lotm_release_0.217.0_death_test_inputs_{i}_2026-10-18.tar.gz" for i in range(1, len(groups) + 1)]
        source_name = "lotm_release_0.217.0_death_source173_test_inputs_2026-10-18.tar.gz"
        metadata_names = ["death217.manifest.json", "death217-required-inputs.manifest.json",
                          "death217-reproduction.json", "death217-package-proof.json"]
        for name in [*names, source_name, *metadata_names]:
            need(not os.path.lexists(OUT / name), f"Target already exists: {name}")
        parts = [pack(staged, name, group, sources) for name, group in zip(names, groups)]
        if registered:
            need([p for p in global_manifest["parts"] if p["name"] in names] == parts,
                 "Reconstructed public parts differ from the final217 manifest")
        source_part = pack(staged, source_name, [source173], sources)
        subset = {"format": "lotm-test-inputs-v1", "version": "0.217.0", "parts": parts, "fileEntries": entries}
        required = {**subset, "parts": [*pale["parts"], source_part, *parts],
                    "fileEntries": sorted([*pale["fileEntries"], source173, *entries], key=lambda x: x["path"])}
        save(staged / metadata_names[0], subset)
        save(staged / metadata_names[1], required)
        # Unchanged five public Pale195 parts are linked only into the temporary
        # verification directory; every compressed and decompressed byte is checked.
        for part in pale["parts"]:
            path = safe(OUT / part["name"])
            need(pin(path) == {k: part[k] for k in ("bytes", "sha256")}, "Pale195 public part drift")
            os.link(path, staged / part["name"], follow_symlinks=False)
        command = ["node", "test-inputs/restore-test-inputs.mjs", "--manifest",
                   str(staged / metadata_names[1]), "--dry-run", "--repo", str(ROOT)]
        result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
        need(result.returncode == 0, "Independent streaming restore validation failed:\n" + result.stdout + result.stderr)
        reproduction = {"format": "DEATH217_PUBLIC_INPUT_REPRODUCTION_V1", "recipeSha256": sha(read(pathlib.Path(__file__))),
            "python": "3.12.14", "zlib": "1.3.2", "gzip": {"filename": "", "mtime": 0, "level": 6},
            "tar": {"format": "PAX_FORMAT", "mode": "w|", "recordSize": 10240, "encoding": "utf-8", "errors": "strict",
                    "prefix": "诡秘/", "modeOctal": "0644", "uid": 0, "gid": 0, "uname": "", "gname": "", "mtime": 0},
            "grouping": {"sort": "lexicographic full relative path", "limit": LIMIT, "charge": "member bytes + 2048"},
            "inputMetadataSha256": PINS, "baseCapture": base["capture"], "deltaParts": delta["parts"],
            "requiredCommittedRecipeInputs": ["the exact recipe identified by recipeSha256",
                "test-inputs/restore-test-inputs.mjs", "test-inputs/manifest.json",
                "test-inputs/death-v02170-capture-files.json", "test-inputs/pale195-rebuild217.manifest.json"],
            "chainDirectoryInputs": [BASE, DELTA, base["capture"]["name"], *[p["name"] for p in delta["parts"]]],
            "captureToFixture": {"from": CAP + "/", "to": FIX + "/", "byteTransform": "NONE"},
            "original195PublicParts": pale["parts"], "separateOriginal173Source": source173,
            "outputParts": [*parts, source_part], "captureFileEntries": entries,
            "requiredRestoreCommand": "node test-inputs/restore-test-inputs.mjs --manifest test-inputs/death217-required-inputs.manifest.json",
            "closure": "115 Death217 files + 238 exact Pale195 files + original173 natural.json; 354 files total",
            "note": "The original1039 capture + ten delta parts reproduce Death217 tars alone. Exact original173 and five original195 public parts are separate dependencies; never rerun gameplay to recreate them."}
        save(staged / metadata_names[2], reproduction)
        save(staged / metadata_names[3], {"format": "DEATH217_PUBLIC_INPUT_STREAM_PROOF_V1", "exit": result.returncode,
             "allRequiredArchiveAndMemberHashesVerified": True, "requiredFiles": 354, "newFiles": 115,
             "newBytes": 133515074, "fixtureWrites": 0, "representativeExtraction": "NOT_RUN; full independent parser streamed every member",
             "stdout": result.stdout, "stderr": result.stderr, "parts": [*parts, source_part]})
        need(read(ROOT / "test-inputs/manifest.json") == global_bytes, "Global manifest changed during packaging")
        # Deliberately exclude the standalone173 tar from the global manifest:
        # its member already exists in the older global archive chain.
        updated = global_manifest if registered else {
            **global_manifest, "version": "0.217.0", "parts": [*global_manifest["parts"], *parts],
            "fileEntries": sorted([*global_manifest["fileEntries"], *entries], key=lambda x: x["path"])}
        for name in [*names, source_name, *metadata_names]:
            os.link(staged / name, OUT / name, follow_symlinks=False)
            print(json.dumps({"path": "test-inputs/" + name, **pin(OUT / name)}, ensure_ascii=False), flush=True)
        save(candidate, updated)
        print(json.dumps({"globalManifestCandidate": str(candidate), **pin(candidate)}), flush=True)


if __name__ == "__main__":
    main()
