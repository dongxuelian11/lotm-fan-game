import { openHermitRuntimeSession } from "../domain/hermit/owned-session.js";
import { openDemonessRuntimeSession } from "../domain/demoness/owned-session.js";
import { openTwilightGiantRuntimeSession } from "../domain/twilight-giant/owned-session.js";
import { openErrorAscentRuntimeSession } from "../domain/error-ascent/owned-session.js";
import { openDoorRuntimeSession } from "../domain/door/owned-session.js";
import { openDeathRuntimeSession } from "../domain/death/owned-session.js";
import { openSunRuntimeSession } from "../domain/sun/owned-session.js";
import { openTyrantRuntimeSession } from "../domain/tyrant/owned-session.js";
import { openWhiteTowerRuntimeSession } from "../domain/white-tower/owned-session.js";
import { openDarknessRuntimeSession } from "../domain/darkness/owned-session.js";
import { openMoonRuntimeSession } from "../domain/moon/owned-session.js";
import { openPerfecterRuntimeSession } from "../domain/perfecter/owned-session.js";
import {
  openFoolRuntimeSession,
  type FoolRuntimeDraft,
  type FoolRuntimeSession,
} from "../domain/fool/owned-session.js";
import { openVisionaryRuntimeSession } from "../domain/visionary/owned-session.js";
import { openRedPriestRuntimeSession } from "../domain/red-priest/owned-session.js";
import type { SliceIntent, SliceProjection, SliceState } from "../domain/slice/types.js";
import { projectSliceState } from "../domain/slice/index.js";
import type { StoredSlice } from "./slice-application.js";

export function assertSliceSaveTimestamp(value: unknown): asserts value is string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
    throw Error("Invalid save timestamp");
}

export interface OwnedRepositoryHead {
  readonly runId: string;
  readonly revision: number;
  readonly status: SliceState["status"];
}
/** Metadata is public; authority is runtime membership in one repository's private map. */
export interface OwnedRepositoryDraft extends OwnedRepositoryHead {
  readonly __repositoryDraft: unique symbol;
}
// Preserve the original Fool API and its transaction-test fault injection points.
export type FoolRepositoryHead = OwnedRepositoryHead;
export type FoolRepositoryDraft = OwnedRepositoryDraft;
type HermitRuntimeSession = ReturnType<typeof openHermitRuntimeSession>;
type DemonessRuntimeSession = ReturnType<typeof openDemonessRuntimeSession>;
type TwilightGiantRuntimeSession = ReturnType<typeof openTwilightGiantRuntimeSession>;
type ErrorAscentRuntimeSession = ReturnType<typeof openErrorAscentRuntimeSession>;
type DoorRuntimeSession = ReturnType<typeof openDoorRuntimeSession>;
type HermitRuntimeDraft = ReturnType<HermitRuntimeSession["prepare"]>;
type DemonessRuntimeDraft = ReturnType<DemonessRuntimeSession["prepare"]>;
type TwilightGiantRuntimeDraft = ReturnType<TwilightGiantRuntimeSession["prepare"]>;
type ErrorAscentRuntimeDraft = ReturnType<ErrorAscentRuntimeSession["prepare"]>;
type DoorRuntimeDraft = ReturnType<DoorRuntimeSession["prepare"]>;
type DeathRuntimeSession = ReturnType<typeof openDeathRuntimeSession>;
type SunRuntimeSession = ReturnType<typeof openSunRuntimeSession>;
type TyrantRuntimeSession = ReturnType<typeof openTyrantRuntimeSession>;
type DeathRuntimeDraft = ReturnType<DeathRuntimeSession["prepare"]>;
type SunRuntimeDraft = ReturnType<SunRuntimeSession["prepare"]>;
type TyrantRuntimeDraft = ReturnType<TyrantRuntimeSession["prepare"]>;
type WhiteTowerRuntimeSession = ReturnType<typeof openWhiteTowerRuntimeSession>;
type DarknessRuntimeSession = ReturnType<typeof openDarknessRuntimeSession>;
type WhiteTowerRuntimeDraft = ReturnType<WhiteTowerRuntimeSession["prepare"]>;
type DarknessRuntimeDraft = ReturnType<DarknessRuntimeSession["prepare"]>;
type MoonRuntimeSession = ReturnType<typeof openMoonRuntimeSession>;
type MoonRuntimeDraft = ReturnType<MoonRuntimeSession["prepare"]>;
type PerfecterRuntimeSession = ReturnType<typeof openPerfecterRuntimeSession>;
type PerfecterRuntimeDraft = ReturnType<PerfecterRuntimeSession["prepare"]>;
type VisionaryRuntimeSession = ReturnType<typeof openVisionaryRuntimeSession>;
type VisionaryRuntimeDraft = ReturnType<VisionaryRuntimeSession["prepare"]>;
type RedPriestRuntimeSession = ReturnType<typeof openRedPriestRuntimeSession>;
type RedPriestRuntimeDraft = ReturnType<RedPriestRuntimeSession["prepare"]>;
interface FoolHead {
  readonly kind: "FOOL";
  readonly raw: string;
  readonly session: FoolRuntimeSession;
}
interface RedPriestHead {
  readonly kind: "RED_PRIEST";
  readonly raw: string;
  readonly session: RedPriestRuntimeSession;
}
interface VisionaryHead { readonly kind: "VISIONARY"; readonly raw: string; readonly session: VisionaryRuntimeSession }
interface PerfecterHead { readonly kind: "PERFECTER"; readonly raw: string; readonly session: PerfecterRuntimeSession }
interface MoonHead { readonly kind: "MOON"; readonly raw: string; readonly session: MoonRuntimeSession }
interface HermitHead { readonly kind: "HERMIT"; readonly raw: string; readonly session: HermitRuntimeSession }
interface DemonessHead { readonly kind: "DEMONESS"; readonly raw: string; readonly session: DemonessRuntimeSession }
interface TwilightGiantHead { readonly kind: "TWILIGHT_GIANT"; readonly raw: string; readonly session: TwilightGiantRuntimeSession }
interface ErrorAscentHead { readonly kind: "ERROR_ASCENT"; readonly raw: string; readonly session: ErrorAscentRuntimeSession }
interface DoorHead { readonly kind: "DOOR"; readonly raw: string; readonly session: DoorRuntimeSession }
interface DeathHead { readonly kind: "DEATH"; readonly raw: string; readonly session: DeathRuntimeSession }
interface SunHead { readonly kind: "SUN"; readonly raw: string; readonly session: SunRuntimeSession }
interface TyrantHead { readonly kind: "TYRANT"; readonly raw: string; readonly session: TyrantRuntimeSession }
interface WhiteTowerHead { readonly kind: "WHITE_TOWER"; readonly raw: string; readonly session: WhiteTowerRuntimeSession }
interface DarknessHead { readonly kind: "DARKNESS"; readonly raw: string; readonly session: DarknessRuntimeSession }
type Head = FoolHead | RedPriestHead | VisionaryHead | PerfecterHead | MoonHead | DarknessHead | WhiteTowerHead | TyrantHead | SunHead | DeathHead | DoorHead | ErrorAscentHead | TwilightGiantHead | DemonessHead | HermitHead;
type Draft = { readonly epoch: object; readonly runId: string } & (
  | { readonly kind: "FOOL"; readonly head: FoolHead; readonly domain: FoolRuntimeDraft }
  | { readonly kind: "RED_PRIEST"; readonly head: RedPriestHead; readonly domain: RedPriestRuntimeDraft }
  | { readonly kind: "VISIONARY"; readonly head: VisionaryHead; readonly domain: VisionaryRuntimeDraft }
  | { readonly kind: "PERFECTER"; readonly head: PerfecterHead; readonly domain: PerfecterRuntimeDraft }
  | { readonly kind: "MOON"; readonly head: MoonHead; readonly domain: MoonRuntimeDraft }
  | { readonly kind: "HERMIT"; readonly head: HermitHead; readonly domain: HermitRuntimeDraft }
  | { readonly kind: "DEMONESS"; readonly head: DemonessHead; readonly domain: DemonessRuntimeDraft }
  | { readonly kind: "TWILIGHT_GIANT"; readonly head: TwilightGiantHead; readonly domain: TwilightGiantRuntimeDraft }
  | { readonly kind: "ERROR_ASCENT"; readonly head: ErrorAscentHead; readonly domain: ErrorAscentRuntimeDraft }
  | { readonly kind: "DOOR"; readonly head: DoorHead; readonly domain: DoorRuntimeDraft }
  | { readonly kind: "DEATH"; readonly head: DeathHead; readonly domain: DeathRuntimeDraft }
  | { readonly kind: "SUN"; readonly head: SunHead; readonly domain: SunRuntimeDraft }
  | { readonly kind: "TYRANT"; readonly head: TyrantHead; readonly domain: TyrantRuntimeDraft }
  | { readonly kind: "WHITE_TOWER"; readonly head: WhiteTowerHead; readonly domain: WhiteTowerRuntimeDraft }
  | { readonly kind: "DARKNESS"; readonly head: DarknessHead; readonly domain: DarknessRuntimeDraft }
);
interface Transaction {
  readonly epoch: object;
  readonly heads: Map<string, Head>;
  readonly drafts: Set<Draft>;
  readonly writes: Map<string, { raw: string; draft: Draft | null }>;
}

/** Fixed current-format dispatch only. A marker selects a strict factory; it is
 * never authority. All factories must validate the entire detached current
 * slice and all predecessor history before returning a private session. */
function openCurrentHead(raw: string, state: SliceState): Head | null {
  if (state.schemaVersion !== 219 || state.contentVersion !== "hermit-v219")
    throw Error("Runtime head requires the current save format");
  const fool = state.fool?.guidanceKnown === true && state.fool.source !== null;
  const redPriest = state.redPriest?.guidanceKnown === true && state.redPriest.source !== null;
  const visionary = state.visionary?.guidanceKnown === true && state.visionary.source !== null;
  const perfecter = state.perfecter?.guidanceKnown === true && state.perfecter.source !== null;
  const moon = state.moon?.guidanceKnown === true && state.moon.source !== null;
  const hermit = state.hermit?.guidanceKnown === true && state.hermit.source !== null;
  const demoness = state.demoness?.guidanceKnown === true && state.demoness.source !== null;
  const twilightGiant = state.twilightGiant?.guidanceKnown === true && state.twilightGiant.source !== null;
  const errorAscent = state.errorAscent?.guidanceKnown === true && state.errorAscent.source !== null;
  const door = state.door?.guidanceKnown === true && state.door.source !== null;
  const death = state.death?.guidanceKnown === true && state.death.source !== null;
  const sun = state.sun?.guidanceKnown === true && state.sun.source !== null;
  const tyrant = state.tyrant?.guidanceKnown === true && state.tyrant.source !== null;
  const whiteTower = state.whiteTower?.guidanceKnown === true && state.whiteTower.source !== null;
  const darkness = state.darkness?.guidanceKnown === true && state.darkness.source !== null;
  if ([fool, redPriest, visionary, perfecter, moon, darkness, whiteTower, tyrant, sun, death, door, errorAscent, twilightGiant, demoness, hermit].filter(Boolean).length > 1) throw Error("Multiple current chapter sessions");
  if (hermit) return { kind: "HERMIT", raw, session: openHermitRuntimeSession(state) };
  if (demoness) return { kind: "DEMONESS", raw, session: openDemonessRuntimeSession(state) };
  if (twilightGiant) return { kind: "TWILIGHT_GIANT", raw, session: openTwilightGiantRuntimeSession(state) };
  if (errorAscent) return { kind: "ERROR_ASCENT", raw, session: openErrorAscentRuntimeSession(state) };
  if (door) return { kind: "DOOR", raw, session: openDoorRuntimeSession(state) };
  if (death) return { kind: "DEATH", raw, session: openDeathRuntimeSession(state) };
  if (sun) return { kind: "SUN", raw, session: openSunRuntimeSession(state) };
  if (tyrant) return { kind: "TYRANT", raw, session: openTyrantRuntimeSession(state) };
  if (whiteTower) return { kind: "WHITE_TOWER", raw, session: openWhiteTowerRuntimeSession(state) };
  if (darkness) return { kind: "DARKNESS", raw, session: openDarknessRuntimeSession(state) };
  if (moon) return { kind: "MOON", raw, session: openMoonRuntimeSession(state) };
  if (perfecter) return { kind: "PERFECTER", raw, session: openPerfecterRuntimeSession(state) };
  if (visionary) return { kind: "VISIONARY", raw, session: openVisionaryRuntimeSession(state) };
  if (fool) return { kind: "FOOL", raw, session: openFoolRuntimeSession(state) };
  if (redPriest) return { kind: "RED_PRIEST", raw, session: openRedPriestRuntimeSession(state) };
  return null;
}

/** Kept in a repository #private field. Never hands a domain session or state out. */
export class SliceOwnedRuntime {
  #heads = new Map<string, Head>();
  #drafts = new WeakMap<object, Draft>();
  #transaction: Transaction | null = null;

  begin(): void {
    if (this.#transaction) throw Error("Nested runtime transaction");
    this.#transaction = {
      epoch: {}, heads: new Map(this.#heads), drafts: new Set(), writes: new Map(),
    };
  }

  #read(runId: string, raw: string | null, decode: (raw: string) => StoredSlice): Head | null {
    const heads = this.#transaction?.heads ?? this.#heads;
    // Never turn a transaction-local raw write into a committed authority.
    if (this.#transaction?.writes.has(runId)) return this.#heads.get(runId) ?? null;
    if (raw === null) { heads.delete(runId); this.#heads.delete(runId); return null; }
    const existing = heads.get(runId);
    if (existing?.raw === raw) return existing;
    // An external replacement revokes authority even when hydration fails and
    // this transaction rolls back. Restoring old bytes must strictly reopen.
    if (this.#heads.get(runId)?.raw !== raw) this.#heads.delete(runId);
    heads.delete(runId);
    const stored = decode(raw);
    if (stored.state.runId !== runId) throw Error("Snapshot identity mismatch");
    const head = openCurrentHead(raw, stored.state);
    if (head) heads.set(runId, head);
    return head;
  }

  inspect(runId: string, raw: string | null, decode: (raw: string) => StoredSlice): OwnedRepositoryHead | null {
    return this.#read(runId, raw, decode)?.session.inspect() ?? null;
  }

  project(runId: string, raw: string | null, decode: (raw: string) => StoredSlice): SliceProjection | null {
    return this.#read(runId, raw, decode)?.session.project() ?? null;
  }

  /** Explicit load always starts from these exact persisted bytes. Current 219
   * inputs cross the selected chapter's complete strict factory. Original 205
   * Fool fixtures must instead pass full migration before opening a current
   * session; their original bytes remain the cache identity until a real write.
   * No legacy snapshot is relabelled or treated as an already validated head. */
  load(runId: string, raw: string | null, readEnvelope: (raw: string) => StoredSlice,
    hydrateState: (input: unknown) => SliceState, sealed: boolean): { state: SliceProjection; updatedAt: string } | null {
    const transaction = this.#transaction;
    if (!transaction || transaction.writes.has(runId)) throw Error("Load requires an unwritten repository transaction");
    if (raw === null || this.#heads.get(runId)?.raw !== raw) this.#heads.delete(runId);
    transaction.heads.delete(runId);
    if (raw === null) return null;
    const stored = readEnvelope(raw), input = stored.state;
    const assertIdentity = (identity: OwnedRepositoryHead): void => {
      if (identity.runId !== runId) throw Error("Snapshot identity mismatch");
      if (sealed && identity.status !== "DEAD") throw Error("Sealed run cannot be reopened alive");
    };
    const publishLoaded = (head: Head): { state: SliceProjection; updatedAt: string } => {
      assertIdentity(head.session.inspect());
      const projection = head.session.project();
      // Failed validation, sealed checks or projection never retain a partial head.
      transaction.heads.set(runId, head);
      return { state: projection, updatedAt: stored.updatedAt };
    };
    if (input?.schemaVersion === 219 && input.contentVersion === "hermit-v219") {
      const head = openCurrentHead(raw, input);
      if (head) return publishLoaded(head);
    }
    // Includes the original 205 Fool import and the 187-capture predecessor
    // fixture's older save format. hydrateState owns the strict migration gate.
    const state = hydrateState(input);
    assertIdentity(state);
    const head = openCurrentHead(raw, state);
    return head ? publishLoaded(head) : { state: projectSliceState(state), updatedAt: stored.updatedAt };
  }

  prepare(runId: string, raw: string | null, decode: (raw: string) => StoredSlice, intent: SliceIntent, expectedRevision: number): OwnedRepositoryDraft {
    const transaction = this.#transaction;
    if (!transaction) throw Error("Prepare outside transaction");
    if (transaction.writes.has(runId)) throw Error("Run already written in this transaction");
    const head = this.#read(runId, raw, decode);
    if (!head) throw Error("No current owned chapter session");
    // Keep the independent domain brands correlated with their real owner.
    // The domain session itself checks the intent's chapter and exact revision.
    const draft: Draft = head.kind === "FOOL"
      ? { kind: "FOOL", epoch: transaction.epoch, head, domain: head.session.prepare(intent, expectedRevision), runId }
      : head.kind === "HERMIT" ? { kind: "HERMIT", epoch: transaction.epoch, head, domain: head.session.prepare(intent, expectedRevision), runId }
      : head.kind === "DEMONESS" ? { kind: "DEMONESS", epoch: transaction.epoch, head, domain: head.session.prepare(intent, expectedRevision), runId }
      : head.kind === "TWILIGHT_GIANT" ? { kind: "TWILIGHT_GIANT", epoch: transaction.epoch, head, domain: head.session.prepare(intent, expectedRevision), runId }
      : head.kind === "ERROR_ASCENT" ? { kind: "ERROR_ASCENT", epoch: transaction.epoch, head, domain: head.session.prepare(intent, expectedRevision), runId }
      : head.kind === "DOOR" ? { kind: "DOOR", epoch: transaction.epoch, head, domain: head.session.prepare(intent, expectedRevision), runId }
      : head.kind === "DEATH" ? { kind: "DEATH", epoch: transaction.epoch, head, domain: head.session.prepare(intent, expectedRevision), runId }
      : head.kind === "SUN" ? { kind: "SUN", epoch: transaction.epoch, head, domain: head.session.prepare(intent, expectedRevision), runId }
      : head.kind === "TYRANT" ? { kind: "TYRANT", epoch: transaction.epoch, head, domain: head.session.prepare(intent, expectedRevision), runId }
      : head.kind === "WHITE_TOWER" ? { kind: "WHITE_TOWER", epoch: transaction.epoch, head, domain: head.session.prepare(intent, expectedRevision), runId }
      : head.kind === "DARKNESS" ? { kind: "DARKNESS", epoch: transaction.epoch, head, domain: head.session.prepare(intent, expectedRevision), runId }
      : head.kind === "MOON" ? { kind: "MOON", epoch: transaction.epoch, head, domain: head.session.prepare(intent, expectedRevision), runId }
      : head.kind === "PERFECTER" ? { kind: "PERFECTER", epoch: transaction.epoch, head, domain: head.session.prepare(intent, expectedRevision), runId }
      : head.kind === "VISIONARY" ? { kind: "VISIONARY", epoch: transaction.epoch, head, domain: head.session.prepare(intent, expectedRevision), runId }
      : { kind: "RED_PRIEST", epoch: transaction.epoch, head, domain: head.session.prepare(intent, expectedRevision), runId };
    const identity = draft.kind === "FOOL"
      ? draft.head.session.inspectDraft(draft.domain)
      : draft.kind === "HERMIT" ? draft.head.session.inspectDraft(draft.domain)
      : draft.kind === "DEMONESS" ? draft.head.session.inspectDraft(draft.domain)
      : draft.kind === "TWILIGHT_GIANT" ? draft.head.session.inspectDraft(draft.domain)
      : draft.kind === "ERROR_ASCENT" ? draft.head.session.inspectDraft(draft.domain)
      : draft.kind === "DOOR" ? draft.head.session.inspectDraft(draft.domain)
      : draft.kind === "DEATH" ? draft.head.session.inspectDraft(draft.domain)
      : draft.kind === "SUN" ? draft.head.session.inspectDraft(draft.domain)
      : draft.kind === "TYRANT" ? draft.head.session.inspectDraft(draft.domain)
      : draft.kind === "WHITE_TOWER" ? draft.head.session.inspectDraft(draft.domain)
      : draft.kind === "DARKNESS" ? draft.head.session.inspectDraft(draft.domain)
      : draft.kind === "MOON" ? draft.head.session.inspectDraft(draft.domain)
      : draft.kind === "PERFECTER" ? draft.head.session.inspectDraft(draft.domain)
      : draft.kind === "VISIONARY" ? draft.head.session.inspectDraft(draft.domain)
      : draft.head.session.inspectDraft(draft.domain);
    const handle = Object.freeze({ ...identity }) as OwnedRepositoryDraft;
    this.#drafts.set(handle, draft);
    transaction.drafts.add(draft);
    return handle;
  }

  #require(handle: OwnedRepositoryDraft): Draft {
    const draft = this.#drafts.get(handle), transaction = this.#transaction;
    if (!draft || !transaction || draft.epoch !== transaction.epoch ||
      transaction.heads.get(draft.runId) !== draft.head || transaction.writes.has(draft.runId))
      throw Error("Foreign, stale or already persisted runtime draft");
    return draft;
  }

  projectDraft(handle: OwnedRepositoryDraft): SliceProjection {
    const draft = this.#require(handle);
    return draft.kind === "FOOL"
      ? draft.head.session.projectDraft(draft.domain)
      : draft.kind === "HERMIT" ? draft.head.session.projectDraft(draft.domain)
      : draft.kind === "DEMONESS" ? draft.head.session.projectDraft(draft.domain)
      : draft.kind === "TWILIGHT_GIANT" ? draft.head.session.projectDraft(draft.domain)
      : draft.kind === "ERROR_ASCENT" ? draft.head.session.projectDraft(draft.domain)
      : draft.kind === "DOOR" ? draft.head.session.projectDraft(draft.domain)
      : draft.kind === "DEATH" ? draft.head.session.projectDraft(draft.domain)
      : draft.kind === "SUN" ? draft.head.session.projectDraft(draft.domain)
      : draft.kind === "TYRANT" ? draft.head.session.projectDraft(draft.domain)
      : draft.kind === "WHITE_TOWER" ? draft.head.session.projectDraft(draft.domain)
      : draft.kind === "DARKNESS" ? draft.head.session.projectDraft(draft.domain)
      : draft.kind === "MOON" ? draft.head.session.projectDraft(draft.domain)
      : draft.kind === "PERFECTER" ? draft.head.session.projectDraft(draft.domain)
      : draft.kind === "VISIONARY" ? draft.head.session.projectDraft(draft.domain)
      : draft.head.session.projectDraft(draft.domain);
  }

  snapshotDraft(handle: OwnedRepositoryDraft, raw: string | null): SliceState {
    const draft = this.#require(handle);
    if (raw !== draft.head.raw) {
      this.#transaction!.heads.delete(draft.runId);
      throw Error("Persisted snapshot changed during runtime transaction");
    }
    return draft.kind === "FOOL"
      ? draft.head.session.snapshotDraft(draft.domain)
      : draft.kind === "HERMIT" ? draft.head.session.snapshotDraft(draft.domain)
      : draft.kind === "DEMONESS" ? draft.head.session.snapshotDraft(draft.domain)
      : draft.kind === "TWILIGHT_GIANT" ? draft.head.session.snapshotDraft(draft.domain)
      : draft.kind === "ERROR_ASCENT" ? draft.head.session.snapshotDraft(draft.domain)
      : draft.kind === "DOOR" ? draft.head.session.snapshotDraft(draft.domain)
      : draft.kind === "DEATH" ? draft.head.session.snapshotDraft(draft.domain)
      : draft.kind === "SUN" ? draft.head.session.snapshotDraft(draft.domain)
      : draft.kind === "TYRANT" ? draft.head.session.snapshotDraft(draft.domain)
      : draft.kind === "WHITE_TOWER" ? draft.head.session.snapshotDraft(draft.domain)
      : draft.kind === "DARKNESS" ? draft.head.session.snapshotDraft(draft.domain)
      : draft.kind === "MOON" ? draft.head.session.snapshotDraft(draft.domain)
      : draft.kind === "PERFECTER" ? draft.head.session.snapshotDraft(draft.domain)
      : draft.kind === "VISIONARY" ? draft.head.session.snapshotDraft(draft.domain)
      : draft.head.session.snapshotDraft(draft.domain);
  }

  stageDraft(handle: OwnedRepositoryDraft, raw: string): void {
    const draft = this.#require(handle);
    this.#transaction!.writes.set(draft.runId, { raw, draft });
  }

  stageRaw(runId: string, raw: string): void {
    if (!this.#transaction) throw Error("Write outside transaction");
    this.#transaction.writes.set(runId, { raw, draft: null });
  }

  /** Call only after the backend's durable COMMIT, never inside its operation callback. */
  committed(): void {
    const transaction = this.#transaction;
    if (!transaction) return;
    for (const [runId, write] of transaction.writes) {
      transaction.heads.delete(runId);
      const draft = write.draft;
      if (draft) {
        try {
          if (draft.kind === "FOOL") draft.head.session.commit(draft.domain);
          else if (draft.kind === "HERMIT") draft.head.session.commit(draft.domain);
          else if (draft.kind === "DEMONESS") draft.head.session.commit(draft.domain);
          else if (draft.kind === "TWILIGHT_GIANT") draft.head.session.commit(draft.domain);
          else if (draft.kind === "ERROR_ASCENT") draft.head.session.commit(draft.domain);
          else if (draft.kind === "DOOR") draft.head.session.commit(draft.domain);
          else if (draft.kind === "DEATH") draft.head.session.commit(draft.domain);
          else if (draft.kind === "SUN") draft.head.session.commit(draft.domain);
          else if (draft.kind === "TYRANT") draft.head.session.commit(draft.domain);
          else if (draft.kind === "WHITE_TOWER") draft.head.session.commit(draft.domain);
          else if (draft.kind === "DARKNESS") draft.head.session.commit(draft.domain);
          else if (draft.kind === "MOON") draft.head.session.commit(draft.domain);
          else if (draft.kind === "PERFECTER") draft.head.session.commit(draft.domain);
          else if (draft.kind === "VISIONARY") draft.head.session.commit(draft.domain);
          else draft.head.session.commit(draft.domain);
          transaction.heads.set(runId, { ...draft.head, raw: write.raw });
        } catch {
          // Persistence already succeeded. Re-enter strict hydration rather than
          // misreport a rollback if a programming error prevents publication.
        }
      }
    }
    this.#heads = transaction.heads;
    this.#transaction = null;
    this.#drafts = new WeakMap();
  }

  rolledBack(): void {
    const transaction = this.#transaction;
    this.#transaction = null;
    this.#drafts = new WeakMap();
    if (transaction) for (const draft of transaction.drafts) {
      try {
        if (draft.kind === "FOOL") draft.head.session.discard(draft.domain);
        else if (draft.kind === "HERMIT") draft.head.session.discard(draft.domain);
        else if (draft.kind === "DEMONESS") draft.head.session.discard(draft.domain);
        else if (draft.kind === "TWILIGHT_GIANT") draft.head.session.discard(draft.domain);
        else if (draft.kind === "ERROR_ASCENT") draft.head.session.discard(draft.domain);
        else if (draft.kind === "DOOR") draft.head.session.discard(draft.domain);
        else if (draft.kind === "DEATH") draft.head.session.discard(draft.domain);
        else if (draft.kind === "SUN") draft.head.session.discard(draft.domain);
        else if (draft.kind === "TYRANT") draft.head.session.discard(draft.domain);
        else if (draft.kind === "WHITE_TOWER") draft.head.session.discard(draft.domain);
        else if (draft.kind === "DARKNESS") draft.head.session.discard(draft.domain);
        else if (draft.kind === "MOON") draft.head.session.discard(draft.domain);
        else if (draft.kind === "PERFECTER") draft.head.session.discard(draft.domain);
        else if (draft.kind === "VISIONARY") draft.head.session.discard(draft.domain);
        else draft.head.session.discard(draft.domain);
      } catch { /* already discarded */ }
    }
  }

  invalidate(): void {
    this.rolledBack();
    this.#heads.clear();
  }
}
