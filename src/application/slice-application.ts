import { projectPlayerText } from "../shared/player-text.js";
import { stableStringify } from "../domain/canonical.js";
import {
  applySliceIntent,
  createSliceRun,
  projectSliceState,
  validateSlicePayload,
  assertValidSliceState,
  SliceRuleError,
} from "../domain/slice/index.js";
import type { SliceState, SliceProjection, SliceIntent } from "../domain/slice/types.js";
import type { FoolRepositoryDraft, FoolRepositoryHead, OwnedRepositoryDraft, OwnedRepositoryHead } from "./slice-owned-runtime.js";
import { validateSliceCreation } from "../content/slice-creation.js";
import type {
  SliceBootstrap,
  SliceEnvelope,
  SliceReceipt,
  SliceResult,
  SliceRunSummary,
} from "../shared/slice-contracts.js";

export interface StoredSlice {
  state: SliceState;
  updatedAt: string;
}
export interface StoredSliceReceipt {
  fingerprint: string;
  receipt: SliceReceipt;
}
export type RepositorySliceBootstrap = Pick<SliceBootstrap, "runs" | "activeState">;
export interface SliceRepository {
  transaction<T>(operation: () => T): T;
  bootstrapView(): RepositorySliceBootstrap;
  list(): StoredSlice[];
  get(runId: string): StoredSlice | null;
  put(value: StoredSlice): void;
  ownedHead(runId: string): OwnedRepositoryHead | null;
  prepareOwned(runId: string, intent: SliceIntent, expectedRevision: number): OwnedRepositoryDraft;
  projectOwnedDraft(draft: OwnedRepositoryDraft): SliceProjection;
  putOwnedDraft(draft: OwnedRepositoryDraft, updatedAt: string): void;
  // Original Fool entry points remain for callers and existing fault-injection tests.
  foolHead(runId: string): FoolRepositoryHead | null;
  projectFoolRun(runId: string): SliceProjection | null;
  loadRunProjection(runId: string): SliceProjection | null;
  prepareFool(runId: string, intent: SliceIntent, expectedRevision: number): FoolRepositoryDraft;
  projectFoolDraft(draft: FoolRepositoryDraft): SliceProjection;
  putFoolDraft(draft: FoolRepositoryDraft, updatedAt: string): void;
  receipt(intentId: string): StoredSliceReceipt | null;
  putReceipt(intentId: string, value: StoredSliceReceipt): void;
  activeRun(): string | null;
  selectRun(runId: string): void;
  recoveryNotice?: string;
}
export class SlicePersistenceError extends Error {}
export class SliceCommitUncertainError extends SlicePersistenceError {}
export function failure(
  code: string,
  message: string,
  retryable = false,
): SliceResult<never> {
  return { ok: false, error: { code, message, retryable } };
}
function plain(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}
function keys(value: Record<string, unknown>, expected: string[]): boolean {
  return Object.keys(value).sort().join("|") === expected.sort().join("|");
}
export function validateSliceEnvelope(
  input: unknown,
): SliceResult<SliceEnvelope> {
  try {
    if (
      !plain(input) ||
      !keys(input, ["intentId", "runId", "expectedRevision", "payload"]) ||
      typeof input.intentId !== "string" ||
      !/^[A-Za-z0-9_.:-]{1,128}$/.test(input.intentId) ||
      !Number.isSafeInteger(input.expectedRevision) ||
      (input.expectedRevision as number) < 0 ||
      !plain(input.payload)
    )
      throw new Error();
    if (
      input.runId !== null &&
      (typeof input.runId !== "string" ||
        !/^[A-Za-z0-9_.:-]{1,128}$/.test(input.runId))
    )
      throw new Error();
    if (stableStringify(input).length > 32768) throw new Error();
    if (input.payload.type === "CREATE") {
      if (
        !keys(input.payload, ["type", "selection"]) ||
        input.runId !== null ||
        input.expectedRevision !== 0
      )
        throw new Error();
      const selection = validateSliceCreation(input.payload.selection);
      if (!selection.ok)
        return failure("CREATION_INVALID", "请检查角色创建的选择与资金。");
    } else {
      if (
        input.runId === null ||
        input.expectedRevision === 0 ||
        !validateSlicePayload(input.payload)
      )
        throw new Error();
    }
    return { ok: true, value: input as unknown as SliceEnvelope };
  } catch {
    return failure("INVALID_INTENT", "操作数据无效，请重新选择。");
  }
}
export function summarizeSlice(stored: StoredSlice | { state: SliceProjection; updatedAt: string }): SliceRunSummary {
  const s = stored.state;
  return {
    runId: s.runId,
    name: s.character.name,
    portraitId: s.character.portraitId,
    week: s.week,
    date: structuredClone(s.date),
    status: s.status,
    revision: s.revision,
    updatedAt: stored.updatedAt,
  };
}
export class SliceApplication {
  constructor(
    readonly repository: SliceRepository,
    readonly mode: "browser" | "desktop",
    private readonly identity: () => string,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}
  getBootstrap(): SliceResult<SliceBootstrap> {
    try {
      const view = this.repository.bootstrapView();
      return {
        ok: true,
        value: {
          mode: this.mode,
          ...view,
          ...(this.repository.recoveryNotice
            ? { recoveryNotice: this.repository.recoveryNotice }
            : {}),
        },
      };
    } catch {
      return failure(
        "SAVE_UNAVAILABLE",
        "存档暂时无法读取。原有进度已保留，请关闭后重试。",
        true,
      );
    }
  }
  loadRun(runId: unknown): SliceResult<SliceProjection> {
    try {
      if (typeof runId !== "string" || !/^[A-Za-z0-9_.:-]{1,128}$/.test(runId))
        return failure("INVALID_RUN", "周目编号无效。");
      return this.repository.transaction(() => {
        const projection = this.repository.loadRunProjection(runId);
        if (!projection) return failure("RUN_NOT_FOUND", "没有找到这个周目。");
        this.repository.selectRun(runId);
        return {
          ok: true as const,
          value: projection,
        };
      });
    } catch {
      return failure(
        "SAVE_UNAVAILABLE",
        "存档暂时无法读取，原有进度已保留。",
        true,
      );
    }
  }
  submitIntent(input: unknown): SliceResult<SliceReceipt> {
    const checked = validateSliceEnvelope(input);
    if (!checked.ok) return checked;
    const intent = checked.value;
    try {
      return this.repository.transaction(() => {
        const fingerprint = stableStringify(intent);
        const prior = this.repository.receipt(intent.intentId);
        if (prior)
          return prior.fingerprint === fingerprint
            ? {
                ok: true as const,
                value: { ...structuredClone(prior.receipt), state: projectPlayerText(structuredClone(prior.receipt.state), prior.receipt.state.character.name), replayed: true },
              }
            : failure(
                "DUPLICATE_INTENT_CONFLICT",
                "这个操作编号已用于其他选择。请重新操作。",
              );
        let next: SliceState | undefined;
        let draft: OwnedRepositoryDraft | undefined;
        const ownedChapterIntent = intent.payload.type === "RED_PRIEST" || intent.payload.type === "VISIONARY" || intent.payload.type === "PERFECTER" || intent.payload.type === "MOON" || intent.payload.type === "DARKNESS" || intent.payload.type === "WHITE_TOWER" || intent.payload.type === "TYRANT" || intent.payload.type === "SUN" || intent.payload.type === "DEATH" || intent.payload.type === "DOOR" || intent.payload.type === "ERROR_ASCENT" || intent.payload.type === "TWILIGHT_GIANT" || intent.payload.type === "DEMONESS" || intent.payload.type === "HERMIT" || intent.payload.type === "HANGED_MAN" || intent.payload.type === "ABYSS" || intent.payload.type === "CHAINED" || intent.payload.type === "WHEEL_OF_FORTUNE";
        let previousRevision = 0;
        if (intent.payload.type === "CREATE") {
          next = createSliceRun(
            this.identity(),
            intent.payload.selection,
            this.identity(),
          );
        } else {
          // First guidance remains the original fully validated raw-state path.
          const owned = intent.payload.type === "FOOL" && intent.payload.command.type !== "LEARN_GUIDANCE"
            ? this.repository.foolHead(intent.runId!)
            : (intent.payload.type === "RED_PRIEST" || intent.payload.type === "VISIONARY" || intent.payload.type === "PERFECTER" || intent.payload.type === "MOON" || intent.payload.type === "DARKNESS" || intent.payload.type === "WHITE_TOWER" || intent.payload.type === "TYRANT" || intent.payload.type === "SUN" || intent.payload.type === "DEATH" || intent.payload.type === "DOOR" || intent.payload.type === "ERROR_ASCENT" || intent.payload.type === "TWILIGHT_GIANT" || intent.payload.type === "DEMONESS" || intent.payload.type === "HERMIT" || intent.payload.type === "HANGED_MAN" || intent.payload.type === "ABYSS" || intent.payload.type === "CHAINED" || intent.payload.type === "WHEEL_OF_FORTUNE") && intent.payload.command.type !== "LEARN_GUIDANCE"
              ? this.repository.ownedHead(intent.runId!)
              : null;
          const current = owned ? { state: owned } : this.repository.get(intent.runId!);
          if (!current) return failure("RUN_NOT_FOUND", "没有找到这个周目。");
          if (current.state.revision !== intent.expectedRevision)
            return failure(
              "REVISION_CONFLICT",
              "进度已更新，请重新打开该周目。",
            );
          if (current.state.status === "DEAD")
            return failure("ARCHIVED", "这个周目已经死亡封存，只能查看卷宗。");
          previousRevision = current.state.revision;
          if (owned) draft = ownedChapterIntent
            ? this.repository.prepareOwned(intent.runId!, intent.payload, intent.expectedRevision)
            : this.repository.prepareFool(intent.runId!, intent.payload, intent.expectedRevision);
          else next = applySliceIntent((current as StoredSlice).state, intent.payload);
        }
        if (next) assertValidSliceState(next);
        const head = draft ?? next!;
        if (head.revision !== previousRevision + 1)
          throw new Error("Invalid revision boundary");
        const committedAt = this.now();
        const receipt: SliceReceipt = {
          intentId: intent.intentId,
          runId: head.runId,
          previousRevision,
          newRevision: head.revision,
          committedAt,
          replayed: false,
          state: draft
            ? ownedChapterIntent ? this.repository.projectOwnedDraft(draft) : this.repository.projectFoolDraft(draft)
            : projectSliceState(next!),
        };
        if (draft) {
          if (ownedChapterIntent) this.repository.putOwnedDraft(draft, committedAt);
          else this.repository.putFoolDraft(draft, committedAt);
        }
        else this.repository.put({ state: next!, updatedAt: committedAt });
        this.repository.putReceipt(intent.intentId, { fingerprint, receipt });
        this.repository.selectRun(head.runId);
        return { ok: true as const, value: structuredClone(receipt) };
      });
    } catch (error) {
      if (error instanceof SliceRuleError)
        return failure("ACTION_UNAVAILABLE", error.message);
      if (error instanceof SliceCommitUncertainError)
        return failure("SAVE_UNCERTAIN", "保存结果需要重新读取，请重新打开该周目后重试同一操作。", true);
      if (error instanceof SlicePersistenceError)
        return failure(
          "SAVE_FAILED",
          "保存失败，本次操作没有提交。原有进度已保留，可重试同一操作。",
          true,
        );
      return failure(
        "INTERNAL_ERROR",
        "这次操作未完成，进度没有改变。请重试。",
        true,
      );
    }
  }
}
