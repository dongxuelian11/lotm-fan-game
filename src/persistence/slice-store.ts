import {migrateSliceState} from '../domain/slice/migration.js';
import { DatabaseSync } from "node:sqlite";
import { randomUUID, createHash } from "node:crypto";
import {
  closeSync,
  copyFileSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { stableStringify } from "../domain/canonical.js";
import { assertValidSliceState } from "../domain/slice/index.js";
import type { SliceState, SliceIntent, SliceProjection } from "../domain/slice/types.js";
import { SliceOwnedRuntime, assertSliceSaveTimestamp, type FoolRepositoryDraft, type FoolRepositoryHead, type OwnedRepositoryDraft, type OwnedRepositoryHead } from "../application/slice-owned-runtime.js";
import {
  SliceApplication,
  SlicePersistenceError,
  SliceCommitUncertainError,
  summarizeSlice,
  type SliceRepository,
  type RepositorySliceBootstrap,
  type StoredSlice,
  type StoredSliceReceipt,
} from "../application/slice-application.js";

const DATABASE_VERSION = 2;
const checksum = (text: string): string =>
  createHash("sha256").update(text).digest("hex");
export class NewerSliceSaveError extends Error {}
function encode(value: StoredSlice): string {
  const payload = stableStringify(value);
  return JSON.stringify({ format: 1, checksum: checksum(payload), payload });
}
/** Parses transport metadata only. Never returns a validated state capability. */
function readEnvelope(raw: unknown): StoredSlice {
  if (typeof raw !== "string") throw new Error("Missing snapshot");
  const envelope = JSON.parse(raw) as {
    format?: number;
    checksum?: string;
    payload?: string;
  };
  if ((envelope.format ?? 0) > 1)
    throw new NewerSliceSaveError("This snapshot needs a newer application.");
  if (
    envelope.format !== 1 ||
    typeof envelope.payload !== "string" ||
    checksum(envelope.payload) !== envelope.checksum
  )
    throw new Error("Snapshot checksum mismatch");
  const value = JSON.parse(envelope.payload) as StoredSlice;
  if (value.state?.schemaVersion > 208)
    throw new NewerSliceSaveError("This state needs a newer application.");
  if (!["ordinary-slice-v1","seer-slice-v2","club-life-v3","clown-life-v4","hunter-life-v5","provoker-life-v6","audience-life-v7","mindreader-life-v8","town-life-v9","savant-life-v10","archaeologist-life-v11","apothecary-life-v12","tamer-life-v13","magician-life-v14","pyromaniac-life-v15","psychologist-life-v16","appraiser-life-v17","vampire-life-v18","sleepless-life-v19","midnight-life-v20","nightmare-life-v21","reader-life-v22","reasoner-life-v23","detective-life-v24","sailor-life-v25","rager-life-v26","navigator-life-v27","bard-life-v28","lightprayer-life-v29","sunpriest-life-v30","corpsecollector-life-v31","gravedigger-life-v32","spiritmedium-life-v33","apprentice-life-v34","trickmaster-life-v35","astrologer-life-v36","marauder-life-v37","marauder-tool-v38","swindler-life-v39","cryptologist-life-v40","warrior-life-v41","gladiator-life-v42","weaponmaster-life-v43","assassin-life-v44","instigator-life-v45","witch-life-v46","pryer-life-v47","combat-scholar-life-v48","wizard-life-v49","secret-supplicant-life-v50","listener-life-v51","shadow-ascetic-life-v52","criminal-life-v53","unwinged-life-v54","serial-killer-life-v55","prisoner-life-v56","madman-life-v57","werewolf-life-v58","monster-life-v59","machine-life-v60","lucky-life-v61","lawyer-life-v62","barbarian-life-v63","briber-life-v64","arbiter-life-v65","sheriff-life-v66","interrogator-life-v67","cultivator-life-v68","physician-life-v69","harvestpriest-life-v70","faceless-life-v71","conspirator-life-v72","hypnotist-life-v73","artisan-life-v74","potion-professor-life-v75","soother-life-v76","polymath-life-v77","wind-blessed-life-v78","notary-life-v79","spirit-guide-life-v80","recorder-life-v81","fire-thief-life-v82","dawn-paladin-life-v83","pleasure-life-v84","scroll-professor-life-v85","rose-bishop-life-v86","demon-life-v87","zombie-life-v88","calamity-priest-life-v89","corruption-baron-life-v90","judge-life-v91","biologist-life-v92","marionettist-life-v93","reaper-life-v94","dreamwalker-life-v95","astronomer-life-v96","crimson-scholar-life-v97","spirit-warlock-life-v98","mysticism-magister-life-v99","ocean-singer-life-v100","priest-of-light-life-v101","gatekeeper-life-v102","traveler-life-v103","dream-stealer-life-v104","guardian-life-v105","pain-life-v106","star-mystic-life-v107","shepherd-life-v108","desire-apostle-life-v109","wraith-life-v110","winner-life-v111","mentor-disorder-life-v112","punishment-knight-life-v113","druid-life-v114","bizarro-sorcerer-life-v115","iron-blood-knight-life-v116","manipulator-life-v117","alchemist-life-v118","witch-king-life-v119","nightwatcher-life-v120","prophet-life-v121","cataclysm-priest-life-v122","unshadowed-life-v123","undying-life-v124","secrets-sorcerer-v125","parasite-v126","demon-hunter-v127","despair-v128","mystic-v129","black-knight-v130","devil-v131","puppet-v132","misfortune-mage-v133","fallen-earl-v134","imperative-mage-v135","ancient-alchemist-v136","long-chapter-v137","ancient-scholar-v138","war-bishop-v139","dream-weaver-v140","arcane-scholar-v141","summoning-master-v142","fear-bishop-v143","insight-scholar-v144","sea-king-v145","justice-mentor-v146","ferryman-v147","wanderer-v148","deceit-mentor-v149","silver-knight-v150","unaging-demoness-v151","prophecy-master-v152","three-headed-templar-v153","blatherer-v154","silent-disciple-v155","chaos-walker-v156","frenzy-mage-v157","chaos-hunter-v158","coffin-bearer-v159","miracle-worker-v160","calamity-demoness-v174","sage-v175","elder-v176","blood-duke-v177","ancient-evil-v178","fate-prophet-v179","apocalypse-demoness-v196","perfecter-v208","visionary-v207","red-priest-v206","fool-v205","nature-walker-v204","hand-of-order-v203","prince-of-abolition-v202","mercury-snake-v201","abomination-v200","unclean-monarch-v199","dark-angel-v198","knowledge-emperor-v197","divine-hand-v195","time-worm-v194","star-key-v193","pale-emperor-v192","pure-white-angel-v191","thunder-god-v190","all-knowing-eye-v189","misfortune-knight-v188","beauty-goddess-v187","civilization-enlightener-v186","writer-v185","conqueror-v184","attendant-mysteries-v183","barren-matriarch-v182","balancer-v181","entropy-duke-v180","glory-v173","fate-trojan-v172","planeswalker-v171","death-consul-v170","light-seeker-v169","catastrophe-v168","wisdom-angel-v167","concealment-servant-v166","life-giver-v165","knowledge-mentor-v164","discerner-v163","weather-warlock-v162","miracle-worker-v161"].includes(value.state?.contentVersion))
    throw new NewerSliceSaveError(
      "Unsupported content version; source retained.",
    );
  if (
    typeof value.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(value.updatedAt))
  )
    throw new Error("Invalid save timestamp");
  return value;
}
function decode(raw: unknown): StoredSlice {
  const value = readEnvelope(raw);
  value.state = migrateSliceState(value.state);
  return value;
}
function flush(path: string): void {
  // Windows FlushFileBuffers requires a writable handle. r+ preserves all bytes.
  // https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers
  const fd = openSync(path, "r+");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
export interface SliceStoreOptions {
  beforeWrite?: () => void;
  identity?: () => string;
  now?: () => string;
}
/** Single authority: snapshots and idempotent receipts commit in the same SQLite transaction. */
export class SqliteSliceRepository implements SliceRepository {
  private db: DatabaseSync;
  private inTransaction = false;
  #runtime = new SliceOwnedRuntime();
  #needsReconciliation = false;
  recoveryNotice?: string;
  constructor(
    readonly path: string,
    private readonly options: SliceStoreOptions = {},
  ) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = this.openWithRecovery();
    try {
      this.initialize();
      this.verifySnapshots(true);
    } catch (error) {
      this.db.close();
      throw error;
    }
  }
  private openWithRecovery(): DatabaseSync {
    let opened: DatabaseSync | undefined;
    try {
      opened = new DatabaseSync(this.path);
      this.inspectDatabase(opened);
      return opened;
    } catch (error) {
      opened?.close();
      if (error instanceof NewerSliceSaveError) throw error;
      const backup = `${this.path}.bak`;
      if (!existsSync(backup)) throw error;
      let candidate: DatabaseSync | undefined;
      try {
        candidate = new DatabaseSync(backup, { readOnly: true });
        this.inspectDatabase(candidate);
        const version = Number(
          (
            candidate.prepare("PRAGMA user_version").get() as {
              user_version: number;
            }
          ).user_version,
        );
        if (version !== DATABASE_VERSION)
          throw new Error("Backup must have current schema");
        const sealed = this.readSealedRuns();
        for (const row of candidate
          .prepare("SELECT id, current_json, terminal FROM slice_runs")
          .all()) {
          const value = decode(row.current_json);
          if (
            value.state.runId !== row.id ||
            ((row.terminal === 1 || sealed.has(String(row.id))) &&
              value.state.status !== "DEAD")
          )
            throw new Error("Backup cannot resurrect a sealed run");
        }
        candidate.close();
        candidate = undefined;
        copyFileSync(backup, `${this.path}.recovery.tmp`);
        flush(`${this.path}.recovery.tmp`);
        renameSync(
          this.path,
          `${this.path}.corrupt-${Date.now()}-${randomUUID().slice(0, 8)}`,
        );
        renameSync(`${this.path}.recovery.tmp`, this.path);
        this.recoveryNotice = "主档损坏，已保留损坏文件并恢复最近有效进度。";
        return new DatabaseSync(this.path);
      } finally {
        candidate?.close();
      }
    }
  }
  private inspectDatabase(db: DatabaseSync): void {
    const version = Number(
      (db.prepare("PRAGMA user_version").get() as { user_version: number })
        .user_version,
    );
    if (version > DATABASE_VERSION)
      throw new NewerSliceSaveError(
        "Save database is newer; no files were changed.",
      );
    const result = db.prepare("PRAGMA quick_check").get();
    if (!result || Object.values(result)[0] !== "ok")
      throw new Error("SQLite integrity check failed");
  }
  private initialize(): void {
    const version = Number(
      (this.db.prepare("PRAGMA user_version").get() as { user_version: number })
        .user_version,
    );
    this.db.exec(
      "PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;",
    );
    if (version === 0) {
      this.db.exec(`BEGIN IMMEDIATE;
        CREATE TABLE slice_runs(id TEXT PRIMARY KEY, current_json TEXT NOT NULL, backup_json TEXT, terminal INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
        CREATE TABLE slice_receipts(id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, receipt_json TEXT NOT NULL);
        CREATE TABLE slice_meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
        PRAGMA user_version=2; COMMIT;`);
    } else if (version === 1) {
      for (const row of this.db
        .prepare("SELECT current_json FROM slice_runs")
        .all())
        decode(row.current_json);
      // Explicit development-schema migration: v1 stored current snapshots and receipts,
      // but had no rolling recovery snapshot or terminal marker. The payload is unchanged.
      this.db.exec(`BEGIN IMMEDIATE;
        ALTER TABLE slice_runs ADD COLUMN backup_json TEXT;
        ALTER TABLE slice_runs ADD COLUMN terminal INTEGER NOT NULL DEFAULT 0;
        UPDATE slice_runs SET backup_json=current_json;
        PRAGMA user_version=2; COMMIT;`);
      this.recoveryNotice = "旧版存档结构已迁移，原有角色进度保留。";
    }
  }
  private readSealedRuns(): Set<string> {
    const path = `${this.path}.sealed`;
    if (!existsSync(path)) return new Set();
    const ids = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string"))
      throw new Error("Invalid sealed-run recovery marker");
    return new Set(ids as string[]);
  }
  private sealRun(id: string): void {
    const ids = this.readSealedRuns();
    ids.add(id);
    const path = `${this.path}.sealed`;
    writeFileSync(`${path}.tmp`, JSON.stringify([...ids]));
    flush(`${path}.tmp`);
    renameSync(`${path}.tmp`, path);
  }
  private verifySnapshots(recover: boolean): void {
    const sealed = this.readSealedRuns();
    for (const row of this.db
      .prepare("SELECT id, current_json, backup_json, terminal FROM slice_runs")
      .all()) {
      try {
        const value = decode(row.current_json);
        if (
          value.state.runId !== row.id ||
          ((row.terminal === 1 || sealed.has(String(row.id))) && value.state.status !== "DEAD")
        )
          throw new Error("Inconsistent snapshot identity/lifecycle");
        if (value.state.status === "DEAD" && row.terminal !== 1)
          this.db
            .prepare(
              "UPDATE slice_runs SET terminal=1, backup_json=current_json WHERE id=?",
            )
            .run(String(row.id));
      } catch (error) {
        if (!recover || error instanceof NewerSliceSaveError) throw error;
        let candidate: StoredSlice | undefined;
        // Prefer the last fully committed physical backup: it contains the same revision,
        // including random cursor and receipts, rather than rolling back a valid result.
        const backupPath = `${this.path}.bak`;
        if (existsSync(backupPath)) {
          let backupDb: DatabaseSync | undefined;
          try {
            backupDb = new DatabaseSync(backupPath, { readOnly: true });
            this.inspectDatabase(backupDb);
            const saved = backupDb
              .prepare("SELECT current_json FROM slice_runs WHERE id=?")
              .get(String(row.id));
            if (saved) candidate = decode(saved.current_json);
          } catch (backupError) {
            if (backupError instanceof NewerSliceSaveError) throw backupError;
          } finally {
            backupDb?.close();
          }
        }
        candidate ??= decode(row.backup_json);
        if (
          candidate.state.runId !== row.id ||
          ((row.terminal === 1 || sealed.has(String(row.id))) &&
            candidate.state.status !== "DEAD")
        )
          throw new Error("Recovery cannot resurrect a sealed run");
        // Preserve corrupted bytes separately before touching the current row.
        writeFileSync(
          `${this.path}.corrupt-snapshot-${String(row.id)}-${Date.now()}.json`,
          String(row.current_json),
        );
        this.db.exec("BEGIN IMMEDIATE");
        try {
          this.db
            .prepare(
              "UPDATE slice_runs SET current_json=?, updated_at=? WHERE id=?",
            )
            .run(encode(candidate), candidate.updatedAt, String(row.id));
          for (const receiptRow of this.db
            .prepare("SELECT id, receipt_json FROM slice_receipts")
            .all()) {
            const receipt = JSON.parse(String(receiptRow.receipt_json));
            if (
              receipt.runId === row.id &&
              receipt.newRevision > candidate.state.revision
            )
              this.db
                .prepare("DELETE FROM slice_receipts WHERE id=?")
                .run(String(receiptRow.id));
          }
          this.db.exec("COMMIT");
        } catch (recoveryError) {
          this.db.exec("ROLLBACK");
          throw recoveryError;
        }
        this.recoveryNotice =
          "主档校验失败，已保留损坏记录并恢复最近有效进度。";
      }
    }
  }
  transaction<T>(operation: () => T): T {
    if (this.inTransaction)
      throw new SlicePersistenceError("Nested transactions are not supported");
    this.#reconcileIfNeeded();
    const markerPath = `${this.path}.sealed`;
    const markerBefore = existsSync(markerPath)
      ? readFileSync(markerPath)
      : null;
    this.inTransaction = true;
    let committed = false;
    let commitAttempted = false;
    try {
      this.db.exec("BEGIN IMMEDIATE");
      this.#runtime.begin();
      const result = operation();
      this.options.beforeWrite?.();
      commitAttempted = true;
      this.db.exec("COMMIT");
      committed = true;
      this.#runtime.committed();
      this.backupCommittedDatabase();
      return result;
    } catch (error) {
      const uncertain = !committed && commitAttempted && !this.db.isTransaction;
      if (uncertain) {
        // COMMIT may have reached disk before an exception was observed. Never
        // publish a guessed head or restore a potentially committed death marker.
        this.#runtime.invalidate();
        this.#needsReconciliation = true;
        try { this.#reconcileIfNeeded(); } catch { /* retain the gate; later entry cannot skip verification */ }
        throw new SliceCommitUncertainError("SQLite commit outcome requires reconciliation", { cause: error });
      }
      try {
        this.db.exec("ROLLBACK");
      } catch {
        /* no transaction */
      }
      if (!committed) {
        this.#runtime.rolledBack();
        // The terminal sidecar is crash-protective, not an independent death commit.
        // An explicit rollback must restore its prior bytes together with the database.
        try {
          if (markerBefore === null) rmSync(markerPath, { force: true });
          else {
            writeFileSync(`${markerPath}.rollback.tmp`, markerBefore);
            flush(`${markerPath}.rollback.tmp`);
            renameSync(`${markerPath}.rollback.tmp`, markerPath);
          }
        } catch (markerError) {
          throw new SlicePersistenceError(
            "Failed to restore terminal recovery marker",
            { cause: markerError },
          );
        }
      }
      if (error instanceof SlicePersistenceError) throw error;
      // Preserve rule errors so application can return a useful unavailable reason.
      if (error instanceof Error && error.name === "SliceRuleError")
        throw error;
      throw new SlicePersistenceError("SQLite commit failed", { cause: error });
    } finally {
      this.inTransaction = false;
    }
  }
  #reconcileIfNeeded(): void {
    if (!this.#needsReconciliation) return;
    this.verifySnapshots(false);
    this.#needsReconciliation = false;
  }
  private backupCommittedDatabase(): void {
    try {
      copyFileSync(this.path, `${this.path}.bak.tmp`);
      flush(`${this.path}.bak.tmp`);
      renameSync(`${this.path}.bak.tmp`, `${this.path}.bak`);
    } catch {
      // Main transaction is already durable. Never report a false rollback after COMMIT.
      // A terminal marker prevents old physical backups from resurrecting a dead run.
      this.recoveryNotice =
        "进度已保存；系统恢复备份暂时不可用，请保留当前存档文件。";
      try {
        rmSync(`${this.path}.bak.tmp`, { force: true });
      } catch {
        /* keep main */
      }
    }
  }
  bootstrapView(): RepositorySliceBootstrap {
    return this.#bootstrapReadTransaction();
  }
  #bootstrapReadTransaction(): RepositorySliceBootstrap {
    if (this.inTransaction)
      throw new SlicePersistenceError("Nested transactions are not supported");
    // Bootstrap strictly checks every row below. Do not run write reconciliation,
    // which can repair terminal metadata; leave its pending gate for write entry.
    this.inTransaction = true;
    try {
      this.db.exec("BEGIN");
      this.#runtime.begin();
      const rows = this.db.prepare(
        "SELECT id, current_json, terminal FROM slice_runs ORDER BY updated_at DESC, rowid DESC",
      ).all();
      const selected = this.activeRun(), current = rows.find(row => row.id === selected) ?? rows[0];
      const sealed = this.readSealedRuns();
      let activeState: SliceProjection | null = null;
      const runs = rows.map(row => {
        const runId = String(row.id), raw = String(row.current_json), isSealed = row.terminal === 1 || sealed.has(runId);
        if (row === current) {
          const loaded = this.#runtime.load(runId, raw, readEnvelope, migrateSliceState, isSealed);
          if (!loaded) throw new SlicePersistenceError("Missing selected snapshot");
          activeState = loaded.state;
          return summarizeSlice(loaded);
        }
        // Every unselected slot still crosses the original strict state gate.
        const stored = decode(raw);
        if (stored.state.runId !== runId || isSealed && stored.state.status !== "DEAD")
          throw new SlicePersistenceError("Inconsistent snapshot identity/lifecycle");
        return summarizeSlice(stored);
      });
      this.db.exec("COMMIT");
      this.#runtime.committed();
      return { runs, activeState };
    } catch (error) {
      // A lost COMMIT acknowledgement cannot publish the candidate, even when
      // SQLite already ended this read-only transaction. No disk repair is needed.
      try { if (this.db.isTransaction) this.db.exec("ROLLBACK"); } catch { /* retain no candidate */ }
      this.#runtime.rolledBack();
      if (error instanceof SlicePersistenceError) throw error;
      throw new SlicePersistenceError("SQLite bootstrap read failed", { cause: error });
    } finally {
      this.inTransaction = false;
    }
  }
  list(): StoredSlice[] {
    this.#reconcileIfNeeded();
    return this.db
      .prepare(
        "SELECT current_json FROM slice_runs ORDER BY updated_at DESC, rowid DESC",
      )
      .all()
      .map((row) => decode(row.current_json));
  }
  get(id: string): StoredSlice | null {
    this.#reconcileIfNeeded();
    const row = this.db
      .prepare("SELECT current_json FROM slice_runs WHERE id=?")
      .get(id);
    return row ? decode(row.current_json) : null;
  }
  put(value: StoredSlice): void {
    if (!this.inTransaction)
      throw new SlicePersistenceError("Write outside transaction");
    const detached = structuredClone(value);
    assertSliceSaveTimestamp(detached.updatedAt);
    assertValidSliceState(detached.state);
    const raw = encode(detached);
    this.#writeSnapshot(detached, raw);
    this.#runtime.stageRaw(detached.state.runId, raw);
  }
  #runtimeRaw(id: string): string | null {
    this.#reconcileIfNeeded();
    const row = this.db.prepare("SELECT current_json, terminal FROM slice_runs WHERE id=?").get(id);
    if (!row) return null;
    const raw = String(row.current_json);
    if ((row.terminal === 1 || this.readSealedRuns().has(id)) && decode(raw).state.status !== "DEAD")
      throw new SlicePersistenceError("Sealed run cannot be reopened alive");
    return raw;
  }
  foolHead(runId: string): FoolRepositoryHead | null {
    return this.ownedHead(runId);
  }
  ownedHead(runId: string): OwnedRepositoryHead | null {
    return this.#runtime.inspect(runId, this.#runtimeRaw(runId), decode);
  }
  projectFoolRun(runId: string): SliceProjection | null {
    return this.#runtime.project(runId, this.#runtimeRaw(runId), decode);
  }
  loadRunProjection(runId: string): SliceProjection | null {
    if (!this.inTransaction) throw new SlicePersistenceError("Load outside transaction");
    this.#reconcileIfNeeded();
    const row = this.db.prepare("SELECT current_json, terminal FROM slice_runs WHERE id=?").get(runId);
    const sealed = row?.terminal === 1 || this.readSealedRuns().has(runId);
    return this.#runtime.load(runId, row ? String(row.current_json) : null, readEnvelope, migrateSliceState, sealed)?.state ?? null;
  }
  prepareFool(runId: string, intent: SliceIntent, expectedRevision: number): FoolRepositoryDraft {
    return this.prepareOwned(runId, intent, expectedRevision);
  }
  prepareOwned(runId: string, intent: SliceIntent, expectedRevision: number): OwnedRepositoryDraft {
    return this.#runtime.prepare(runId, this.#runtimeRaw(runId), decode, intent, expectedRevision);
  }
  projectFoolDraft(draft: FoolRepositoryDraft): SliceProjection {
    return this.projectOwnedDraft(draft);
  }
  projectOwnedDraft(draft: OwnedRepositoryDraft): SliceProjection {
    return this.#runtime.projectDraft(draft);
  }
  putFoolDraft(draft: FoolRepositoryDraft, updatedAt: string): void {
    this.putOwnedDraft(draft, updatedAt);
  }
  putOwnedDraft(draft: OwnedRepositoryDraft, updatedAt: string): void {
    if (!this.inTransaction) throw new SlicePersistenceError("Write outside transaction");
    assertSliceSaveTimestamp(updatedAt);
    const state = this.#runtime.snapshotDraft(draft, this.#runtimeRaw(draft.runId));
    const value = { state, updatedAt }, raw = encode(value);
    this.#writeSnapshot(value, raw);
    this.#runtime.stageDraft(draft, raw);
  }
  #writeSnapshot(value: StoredSlice, raw: string): void {
    const
      terminal = value.state.status === "DEAD" ? 1 : 0;
    if (terminal) this.sealRun(value.state.runId);
    this.db
      .prepare(
        `INSERT INTO slice_runs(id,current_json,backup_json,terminal,updated_at) VALUES(?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET backup_json=CASE WHEN excluded.terminal=1 THEN excluded.current_json ELSE slice_runs.current_json END,
      current_json=excluded.current_json,terminal=MAX(slice_runs.terminal,excluded.terminal),updated_at=excluded.updated_at`,
      )
      .run(value.state.runId, raw, raw, terminal, value.updatedAt);
  }
  receipt(id: string): StoredSliceReceipt | null {
    const row = this.db
      .prepare(
        "SELECT fingerprint, receipt_json FROM slice_receipts WHERE id=?",
      )
      .get(id);
    return row
      ? {
          fingerprint: String(row.fingerprint),
          receipt: JSON.parse(String(row.receipt_json)),
        }
      : null;
  }
  putReceipt(id: string, value: StoredSliceReceipt): void {
    if (!this.inTransaction)
      throw new SlicePersistenceError("Write outside transaction");
    this.db
      .prepare(
        "INSERT INTO slice_receipts(id,fingerprint,receipt_json) VALUES(?,?,?)",
      )
      .run(id, value.fingerprint, JSON.stringify(value.receipt));
  }
  activeRun(): string | null {
    const row = this.db
      .prepare("SELECT value FROM slice_meta WHERE key='active'")
      .get();
    return row ? String(row.value) : null;
  }
  selectRun(id: string): void {
    this.db
      .prepare(
        "INSERT INTO slice_meta(key,value) VALUES('active',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .run(id);
  }
  close(): void {
    this.#runtime.invalidate();
    this.db.close();
  }
}
export class SqliteSliceStore extends SliceApplication {
  private readonly store: SqliteSliceRepository;
  constructor(path: string, options: SliceStoreOptions = {}) {
    const repository = new SqliteSliceRepository(path, options);
    super(repository, "desktop", options.identity ?? randomUUID, options.now);
    this.store = repository;
  }
  close(): void {
    this.store.close();
  }
}
