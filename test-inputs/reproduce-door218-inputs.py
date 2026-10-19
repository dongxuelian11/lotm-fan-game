#!/usr/bin/env python3
"""Deterministic Door218 public-input packaging. PREPARED, NOT EXECUTED.

Run from the repository root after explicit authorization:
  python3 output/rebuild-0218/package-new218-inputs.py
  python3 output/rebuild-0218/package-new218-inputs.py --chain-dir DIR

Default input: tests/fixtures/door-v02180, exact117 members/132903940 bytes.
--chain-dir reconstructs those same bytes in temporary storage from the pinned
first824 manifest/captureParts and terminal928 under20MB manifest/nine parts.
It never reads runtimeParts or imports/runs producer/game/SQLite code. The old
six oversize delta archives and old terminal manifest are NOT prerequisites.

Required retained source inputs:
  * This recipe; test-inputs/restore-test-inputs.mjs; test-inputs/manifest.json;
    test-inputs/door-v02180-capture-files.json, all pinned below.
  * FIRST and FINAL manifests plus first824 captureParts and final parts in
    DIR (or ../checkpoints for default mode). Exact Python3.12.14/zlib1.3.2.
  * The six unchanged published archives in LEGACY_PARTS, in test-inputs.
    Three StarKey196 archives contain all148 old regression files, including
    original196 natural.json. Original177 parts11/13/20 supply the three other
    exact regression sources. No predecessor archive is invented or repacked.
  * Node18+ for the unchanged independent streaming archive validator only.

The exact logical legacy closure is151 files/590096397 bytes. Its six original
containers have278 members, so the required-input manifest retains ALL278
container members plus117 Door members (395 total). A manifest containing only
151 legacy entries cannot validate those original archives. All members are
stream-verified; existing identical fixtures are allowed, different ones block.
No fixture restore/replay or runtime/native audit runs here.

Outputs: ten new <20,000,000-byte public .tar.gz files, four metadata/proof files
in test-inputs, and output/rebuild-0218/test-inputs-manifest218.candidate.json.
All output targets must be absent; never remove them merely to rerun. The global
manifest is never replaced. A reviewed final0.218.0 global manifest is accepted
in --chain-dir mode only if removing exactly these Door entries/parts recovers
the pinned pre218 manifest and reproduced archive entries match exactly.
"""
import argparse
import gzip
import hashlib
import io
import json
import os
import pathlib
import re
import stat
import subprocess
import sys
import tarfile
import tempfile
import zlib

CAP = "output/rebuild-0218/natural-v1"
FIX = "tests/fixtures/door-v02180"
SOURCE196 = "tests/fixtures/star-key-v01960/natural.json"
SOURCE196_SHA = "d9f23dd736ccf0a9fe4eb48e7ffbd79f86a87c6f6ad58dcd913d234c3251cc6d"
RUNTIME_SHA = "fc2308010ba258a1f8364d43cf23868baafd4bac14ed1af873934577236d4385"
FIRST = "lotm_door218_natural824_fc2308010ba2_manifest.json"
FINAL = "lotm_door218_natural825-928_f591c17b91c7_delta_under20mb_manifest.json"
FIRST_FORMAT = "DOOR218_ORIGINAL823_PLUS_FIRST824_EXACT_RECOVERY_V1"
DELTA_FORMAT = "DOOR218_IMMEDIATE_PREDECESSOR_INCREMENT_V1"
CAPTURE_MANIFEST = "test-inputs/door-v02180-capture-files.json"
RESTORER = "test-inputs/restore-test-inputs.mjs"
PINS = {
    "test-inputs/manifest.json": "788b2244dd2c49cd32ed6f80305d35020e7dea21c2e010f4a675419f7054ceab",
    CAPTURE_MANIFEST: "20cbef150abd01ad544a9fb911f178087872e0d4a2fd08a47fdeddb9834c8402",
    RESTORER: "a3f5bbd21004c8a15b3735a0b08b393aa67cbaff863231e90190cd93c60c1f19",
    FIRST: "5bdb271412b65e494ca9e3e3ee5612c09633f88a1815da1ca4041ef69150511f",
    FINAL: "887a04d262ce5fce0843f0982fe5ebe9e36d25ad42533f299f10b84e6b104e32",
}
LEGACY_PARTS = [
    {"name": "lotm_rebuild_0.177.0_test_fixtures_11_2026-10-14.tar.gz", "bytes": 16843082,
     "sha256": "50b8f5577c90170bfaa4224db8863e7d339491b0f85463311b1d6764026f1f3b"},
    {"name": "lotm_rebuild_0.177.0_test_fixtures_13_2026-10-14.tar.gz", "bytes": 16854069,
     "sha256": "eb13cc7b0ca051fefb131471e76474b8cba9d1a35a0376146309f4de53db5b0c"},
    {"name": "lotm_rebuild_0.177.0_test_fixtures_20_2026-10-14.tar.gz", "bytes": 16846732,
     "sha256": "ce3a38e4fa3d339e99871a55a40d3f39ec3b472969adabe57fa55427d95ef57d"},
    {"name": "lotm_release_0.196.0_star_key_test_inputs_1_2026-10-15.tar.gz", "bytes": 17593078,
     "sha256": "89ea783afa58a25e535a74212826d00b3b99e8ea6f48ffa9e0a2201824246473"},
    {"name": "lotm_release_0.196.0_star_key_test_inputs_2_2026-10-15.tar.gz", "bytes": 17793685,
     "sha256": "0a4e9045186700759ff0166aa861757c0d405ec53f11446832090763a57c5856"},
    {"name": "lotm_release_0.196.0_star_key_test_inputs_3_2026-10-15.tar.gz", "bytes": 14765801,
     "sha256": "3056e0da824ac2d6956c1ad95b30b9b10c2a8458f8714bbc7a223b8d12174cae"},
]
EXTRA_SOURCES = {
    "tests/fixtures/planeswalker-v01740/natural.json": "06e0bec9d3a72a41c27c96dbedafdddb023732f74a559471848f53163d144a78",
    "tests/fixtures/planeswalker-v01740/original-enemy-approach.json": "ef0fe46be50b3b8ad09b8ef8551b7fa7fe76542626ccf769a50e31f9babe73f9",
    "tests/fixtures/wanderer-v01500/continued.json": "aa074a2c14ca18d3199a667bbec61b47bab05b6796de83649949299c9f03ffa9",
}
DERIVED = {"boundaries.index.json", "checkpoint.json.gz", "commands.ndjson.gz",
           "natural.json.gz", "summary.json", "recovery-manifest.json"}
IMMUTABLE = {"archived-original196-natural.json.gz", "input-freeze.json", "migration-initial.json.gz",
             "producer.mjs", "producer-tests.mjs", "runtime-freeze.json"}
LIMIT, PART_LIMIT = 15_000_000, 20_000_000
sha = lambda data: hashlib.sha256(data).hexdigest()
json_bytes = lambda value: (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode()
evidence = lambda data: {"bytes": len(data), "sha256": sha(data)}


def need(ok, message):
    if not ok:
        raise RuntimeError(message)


def safe(path):
    path = pathlib.Path(os.path.abspath(path))
    for item in [path, *path.parents]:
        need(not item.is_symlink(), f"Symlink refused: {item}")
    return path


def fingerprint(info):
    return tuple(getattr(info, key) for key in ("st_dev", "st_ino", "st_size", "st_mtime_ns", "st_ctime_ns"))


def read(path):
    path = safe(path)
    before = path.stat()
    need(stat.S_ISREG(before.st_mode), f"Not a regular file: {path}")
    data = path.read_bytes()
    need(fingerprint(before) == fingerprint(path.stat()), f"Read drift: {path}")
    return data


def pin(path):
    return evidence(read(path))


def load(path, digest):
    data = read(path)
    need(sha(data) == digest, f"Pinned metadata changed: {path}")
    return json.loads(data)


def save(path, value):
    with safe(path).open("xb") as stream:
        stream.write(json_bytes(value))


def relative(name):
    need(isinstance(name, str) and name and not re.search(r"[\\\x00-\x1f\x7f:]", name) and
         all(piece not in ("", ".", "..") for piece in name.split("/")), f"Unsafe relative path: {name!r}")
    return name


def local(name):
    need("/" not in relative(name), f"Expected basename: {name}")
    return name


def rows(items):
    result = {}
    for row in items:
        name = relative(row["path"])
        need(name not in result and type(row["bytes"]) is int and row["bytes"] >= 0 and
             re.fullmatch(r"[a-f0-9]{64}", row["sha256"]), "Duplicate/invalid inventory row")
        result[name] = {key: row[key] for key in ("bytes", "sha256")}
    return result


def capture_inventory(manifest):
    result = rows(manifest["completeCaptureInventory"])
    for name in result:
        need(name.startswith(CAP + "/"), "Unexpected capture root")
        local(name.removeprefix(CAP + "/"))
    return result


def chain_metadata(directory):
    chain, seen = [], set()
    descriptor = {"name": FINAL, "sha256": PINS[FINAL]}
    while True:
        name = local(descriptor["name"])
        need(name not in seen, "Predecessor cycle")
        seen.add(name)
        data = read(directory / name)
        need(sha(data) == descriptor["sha256"] and
             ("bytes" not in descriptor or len(data) == descriptor["bytes"]), "Predecessor descriptor mismatch")
        manifest = json.loads(data)
        need(manifest["format"] in (FIRST_FORMAT, DELTA_FORMAT) and manifest["runtimeSha256"] == RUNTIME_SHA and
             manifest["originalPrefix"] == 823 and manifest["source"] ==
             {"path": SOURCE196, "bytes": 9160811, "sha256": SOURCE196_SHA} and
             manifest["evidenceOnly"] is False and manifest["pending"] is None and
             manifest["independentRestoreProof"]["nativeZeroActionRestore"] == "PASS", "Unverified/wrong capture chain")
        chain.append((name, data, manifest))
        if manifest["format"] == FIRST_FORMAT:
            need(name == FIRST and sha(data) == PINS[FIRST] and manifest["finalCount"] == 824, "Wrong first824 boundary")
            break
        descriptor = manifest["previousManifest"]
    chain.reverse()
    first = chain[0][2]
    previous = first
    for _, _, current in chain[1:]:
        for field in ("frozenCommit", "runtimeSha256", "nodeVersion", "source", "originalPrefix"):
            need(current[field] == first[field], f"Chain identity drift: {field}")
        need(current["firstManifest"] == {"name": FIRST, **evidence(chain[0][1])} and
             current["previousBoundary"] == previous["finalCount"] and current["finalCount"] > previous["finalCount"] and
             current["newCounts"] == list(range(previous["finalCount"] + 1, current["finalCount"] + 1)), "Chain gap")
        previous = current
    need(previous["finalCount"] == 928 and previous["finalRevision"] == 1236 and
         previous["terminal"]["stage"] == "NATURAL_FINITE_DOOR_REPORTED", "Not terminal928")
    return chain


def restore_capture_chain(directory, chain, destination):
    previous = {}
    for index, (_, _, manifest) in enumerate(chain):
        final = capture_inventory(manifest)
        replacements = {}
        if index == 0:
            parts = manifest["captureParts"]  # runtimeParts are intentionally never inspected.
            changed = final
        else:
            parts = manifest["parts"]
            additions = rows(manifest["addedMembers"])
            need(not set(additions) & set(previous), "Increment relabels old data as new")
            explicit = set(manifest["explicitMetadataReplacementNames"])
            for row in manifest["metadataReplacements"]:
                name = relative(row["path"])
                short = name.removeprefix(CAP + "/")
                local(short)
                need(name.startswith(CAP + "/") and short not in IMMUTABLE and not short.startswith("action-") and
                     (short in DERIVED or short in explicit) and name not in replacements and
                     previous.get(name) == row["previous"] and final.get(name) == row["replacement"],
                     "Invalid explicit versioned metadata replacement")
                replacements[name] = row["replacement"]
                need(pin(destination / short) == row["previous"], "Previous metadata bytes changed")
            changed = {**additions, **replacements}
            need({**previous, **changed} == final, "Increment deletes/changes undeclared old evidence")
        seen = set()
        for part in parts:
            archive_path = directory / local(part["name"])
            need(pin(archive_path) == {key: part[key] for key in ("bytes", "sha256")}, "Chain archive changed")
            declared = rows(part["members"])
            local_seen = set()
            with tarfile.open(archive_path, "r:gz") as archive:
                for member in archive:
                    name = relative(member.name)
                    need(name.startswith(CAP + "/"), "Unknown chain root")
                    short = local(name.removeprefix(CAP + "/"))
                    need(member.isfile() and not member.linkname and not member.sparse and not member.pax_headers and
                         name in declared and name not in seen, f"Unsafe/duplicate chain member: {name}")
                    data = archive.extractfile(member).read()
                    need(evidence(data) == declared[name] == changed.get(name), "Chain member pin mismatch")
                    with (destination / short).open("wb" if name in replacements else "xb") as stream:
                        stream.write(data)
                    seen.add(name)
                    local_seen.add(name)
            need(local_seen == set(declared), "Incomplete chain part")
        need(seen == set(changed), "Missing/extra delta member")
        need({CAP + "/" + path.name: pin(path) for path in destination.iterdir()} == final, "Restored boundary inventory differs")
        previous = final


def legacy_closure(out, global_manifest):
    entries = {row["path"]: row for row in global_manifest["fileEntries"]}
    registered_parts = {part["name"]: part for part in global_manifest["parts"]}
    logical = {name: row for name, row in entries.items()
               if name.startswith("tests/fixtures/star-key-v01960/") or name in EXTRA_SOURCES}
    need(len(logical) == 151 and sum(row["bytes"] for row in logical.values()) == 590096397,
         "Wrong exact logical regression closure")
    for name, digest in {SOURCE196: SOURCE196_SHA, **EXTRA_SOURCES}.items():
        need(logical[name]["sha256"] == digest, f"Wrong original input: {name}")
    closure, membership = {}, {}
    for part in LEGACY_PARTS:
        need(registered_parts.get(part["name"]) == part, "Original published archive registration changed")
        archive_path = safe(out / part["name"])
        need(pin(archive_path) == {key: part[key] for key in ("bytes", "sha256")}, "Missing/changed original public archive")
        names = []
        with tarfile.open(archive_path, "r:gz") as archive:
            for member in archive:
                name = relative(member.name)
                need(name.startswith("诡秘/tests/fixtures/"), "Wrong public archive root")
                name = name.removeprefix("诡秘/")
                need(member.isfile() and not member.linkname and not member.sparse and
                     set(member.pax_headers) <= {"path", "size", "mtime"} and name in entries and name not in closure and
                     member.size == entries[name]["bytes"], f"Unsafe/unknown/duplicate legacy member: {name}")
                digest = hashlib.sha256()
                count = 0
                with archive.extractfile(member) as stream:
                    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                        count += len(chunk)
                        digest.update(chunk)
                need({"bytes": count, "sha256": digest.hexdigest()} ==
                     {key: entries[name][key] for key in ("bytes", "sha256")}, "Legacy member content mismatch")
                closure[name] = entries[name]
                names.append(name)
        membership[part["name"]] = names
    need(len(closure) == 278 and set(logical) <= set(closure), "Incomplete original container dependency closure")
    return [closure[name] for name in sorted(closure)], [logical[name] for name in sorted(logical)], membership


def pack(staged, name, group, fixture):
    with (staged / name).open("xb") as raw:
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0, compresslevel=6) as zipped:
            with tarfile.open(fileobj=zipped, mode="w|", format=tarfile.PAX_FORMAT,
                              encoding="utf-8", errors="strict") as archive:
                for entry in group:
                    data = read(fixture / local(entry["path"].removeprefix(FIX + "/")))
                    need(evidence(data) == {key: entry[key] for key in ("bytes", "sha256")}, "Capture input changed")
                    info = tarfile.TarInfo("诡秘/" + entry["path"])
                    info.size, info.mode, info.mtime = len(data), 0o644, 0
                    info.uid = info.gid = 0
                    info.uname = info.gname = ""
                    archive.addfile(info, io.BytesIO(data))
    result = {"name": name, **pin(staged / name), "members": [entry["path"] for entry in group]}
    need(result["bytes"] < PART_LIMIT, "Public archive exceeds decimal20MB ceiling")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--chain-dir", type=pathlib.Path)
    args = parser.parse_args()
    root = safe(pathlib.Path.cwd())
    need(safe(pathlib.Path(__file__)).parent == root / "output/rebuild-0218", "Run from repository root")
    out = safe(root / "test-inputs")
    need(sys.version_info[:3] == (3, 12, 14) and zlib.ZLIB_VERSION == zlib.ZLIB_RUNTIME_VERSION == "1.3.2",
         "Exact-byte reproduction requires Python3.12.14 and zlib1.3.2")
    need(pin(root / RESTORER)["sha256"] == PINS[RESTORER], "Independent restore validator changed")
    capture = load(root / CAPTURE_MANIFEST, PINS[CAPTURE_MANIFEST])
    need(set(capture) == {"format", "files"} and capture["format"] == "DOOR218_CAPTURE_FILES_V1" and
         all(set(row) == {"file", "bytes", "sha256"} for row in capture["files"]), "Wrong verifier input format")
    expected = rows([{"path": local(row["file"]), "bytes": row["bytes"], "sha256": row["sha256"]}
                     for row in capture["files"]])
    need(list(expected) == sorted(expected) and len(expected) == 117 and
         sum(row["bytes"] for row in expected.values()) == 132903940, "Wrong terminal928 inventory")
    need({name for name in expected if name.startswith("action-")} ==
         {f"action-{count}.json.gz" for count in range(824, 929)}, "Missing/extra action capture")
    directory = safe(args.chain_dir or root.parent / "checkpoints")
    chain = chain_metadata(directory)
    need(capture_inventory(chain[-1][2]) == {CAP + "/" + name: value for name, value in expected.items()},
         "Capture manifest/Library chain disagreement")
    entries = [{"path": FIX + "/" + name, **expected[name]} for name in expected]
    groups, group, size = [], [], 0
    for entry in entries:
        charge = entry["bytes"] + 2048
        need(charge < LIMIT, "Individual member exceeds deterministic group limit")
        if group and size + charge > LIMIT:
            groups.append(group)
            group, size = [], 0
        group.append(entry)
        size += charge
    if group:
        groups.append(group)
    need(len(groups) == 10, "Unexpected public partition count")
    names = [f"lotm_release_0.218.0_door_test_inputs_{index}_2026-10-18.tar.gz" for index in range(1, 11)]
    global_bytes = read(root / "test-inputs/manifest.json")
    global_manifest = json.loads(global_bytes)
    registered = [row for row in global_manifest["fileEntries"] if row["path"].startswith(FIX + "/")]
    if sha(global_bytes) != PINS["test-inputs/manifest.json"]:
        previous = {**global_manifest, "version": "0.217.0",
                    "parts": [part for part in global_manifest["parts"] if part["name"] not in names],
                    "fileEntries": [row for row in global_manifest["fileEntries"] if not row["path"].startswith(FIX + "/")]}
        need(args.chain_dir is not None and global_manifest.get("version") == "0.218.0" and
             registered == entries and sha(json_bytes(previous)) == PINS["test-inputs/manifest.json"],
             "Global manifest is neither pinned pre218 nor an exact218 extension")
    else:
        need(not registered, "Pre218 manifest contains Door218 entries")
    metadata = ["door218.manifest.json", "door218-required-inputs.manifest.json",
                "door218-reproduction.json", "door218-package-proof.json"]
    candidate = root / "output/rebuild-0218/test-inputs-manifest218.candidate.json"
    for path in [candidate, *[out / name for name in names + metadata]]:
        need(not os.path.lexists(safe(path)), f"Output already exists: {path}")
    # Validate all six original containers BEFORE spending time repacking captures.
    legacy, logical, membership = legacy_closure(out, global_manifest)
    with tempfile.TemporaryDirectory(prefix=".door218-public-", dir=out) as temporary:
        staged = pathlib.Path(temporary)
        fixture = safe(root / FIX)
        if args.chain_dir is not None:
            fixture = staged / "restored-capture"
            fixture.mkdir()
            restore_capture_chain(directory, chain, fixture)
        need({path.name for path in fixture.iterdir()} == set(expected), "Missing/extra fixture member")
        need({name: pin(fixture / name) for name in expected} == expected, "Input fixture inventory changed")
        need(evidence(gzip.decompress(read(fixture / "archived-original196-natural.json.gz"))) ==
             {"bytes": 9160811, "sha256": SOURCE196_SHA}, "Archived original196 source bytes differ")
        parts = [pack(staged, name, group, fixture) for name, group in zip(names, groups)]
        if registered:
            need([part for part in global_manifest["parts"] if part["name"] in names] == parts,
                 "Reproduced public archive hashes differ from final218 registration")
        subset = {"format": "lotm-test-inputs-v1", "version": "0.218.0", "parts": parts, "fileEntries": entries}
        required = {**subset, "parts": [*LEGACY_PARTS, *parts],
                    "fileEntries": sorted([*legacy, *entries], key=lambda row: row["path"])}
        save(staged / metadata[0], subset)
        save(staged / metadata[1], required)
        for part in LEGACY_PARTS:
            os.link(safe(out / part["name"]), staged / part["name"], follow_symlinks=False)
        command = ["node", RESTORER, "--manifest", str(staged / metadata[1]), "--dry-run", "--repo", str(root)]
        result = subprocess.run(command, cwd=root, capture_output=True, text=True)
        need(result.returncode == 0, "Independent streaming public-archive validation failed:\n" + result.stdout + result.stderr)
        reproduction = {"format": "DOOR218_PUBLIC_INPUT_REPRODUCTION_V1", "recipeSha256": sha(read(pathlib.Path(__file__))),
            "python": "3.12.14", "zlib": "1.3.2", "gzip": {"filename": "", "mtime": 0, "level": 6},
            "tar": {"format": "PAX_FORMAT", "mode": "w|", "recordSize": 10240, "encoding": "utf-8", "errors": "strict",
                    "prefix": "诡秘/", "modeOctal": "0644", "uid": 0, "gid": 0, "uname": "", "gname": "", "mtime": 0},
            "grouping": {"sort": "lexicographic full relative path", "limit": LIMIT, "charge": "member bytes + 2048"},
            "strictArchiveBytesBelow": PART_LIMIT, "inputMetadataSha256": PINS,
            "requiredCommittedRecipeInputs": ["the exact recipe identified by recipeSha256", RESTORER,
                                              "test-inputs/manifest.json", CAPTURE_MANIFEST],
            "chainDirectoryInputs": [*[name for name, _, _ in chain],
                *[part["name"] for _, _, manifest in chain for part in
                  (manifest["captureParts"] if manifest["format"] == FIRST_FORMAT else manifest["parts"])]],
            "runtimeArchivesRequired": False, "supersededOversizeDeltaArchivesRequired": False,
            "captureToFixture": {"from": CAP + "/", "to": FIX + "/", "byteTransform": "NONE"},
            "separateOriginalPublicArchives": LEGACY_PARTS, "originalArchiveMembership": membership,
            "logicalLegacyDependencies": logical, "legacyContainerFiles": len(legacy),
            "logicalRequiredFiles": len(logical) + len(entries), "fullContainerRequiredFiles": len(required["fileEntries"]),
            "outputParts": parts, "captureFileEntries": entries,
            "requiredRestoreCommand": "node test-inputs/restore-test-inputs.mjs --manifest test-inputs/door218-required-inputs.manifest.json",
            "note": "First824 captureParts + final under20MB delta reproduce Door117 files without runtime or replay. Six unchanged published legacy containers are separately required; their full278 members include the exact151 logical legacy inputs."}
        save(staged / metadata[2], reproduction)
        save(staged / metadata[3], {"format": "DOOR218_PUBLIC_INPUT_STREAM_PROOF_V1", "exit": result.returncode,
            "allRequiredArchiveAndMemberHashesVerified": True, "requiredFiles": len(required["fileEntries"]),
            "logicalRequiredFiles": len(logical) + len(entries), "newFiles": len(entries), "newBytes": 132903940,
            "fixtureWrites": 0, "runtimeImported": False, "gameplayExecuted": False, "sqliteOpened": False,
            "representativeExtraction": "NOT_RUN; full independent parser streamed every member",
            "stdout": result.stdout, "stderr": result.stderr, "parts": parts})
        need(read(root / "test-inputs/manifest.json") == global_bytes, "Global manifest changed during packaging")
        need(pin(root / RESTORER)["sha256"] == PINS[RESTORER] and
             pin(root / CAPTURE_MANIFEST)["sha256"] == PINS[CAPTURE_MANIFEST], "Recipe metadata changed")
        need({name: pin(fixture / name) for name in expected} == expected, "Capture changed before publication")
        for name, data, _ in chain:
            need(read(directory / name) == data, "Chain manifest changed before publication")
        updated = global_manifest if registered else {**global_manifest, "version": "0.218.0",
            "parts": [*global_manifest["parts"], *parts],
            "fileEntries": sorted([*global_manifest["fileEntries"], *entries], key=lambda row: row["path"])}
        for name in names + metadata:
            os.link(staged / name, out / name, follow_symlinks=False)
            print(json.dumps({"path": "test-inputs/" + name, **pin(out / name)}, ensure_ascii=False), flush=True)
        save(candidate, updated)
        print(json.dumps({"globalManifestCandidate": str(candidate), **pin(candidate)}), flush=True)


if __name__ == "__main__":
    main()
