import type { PublicError, PublicErrorCode, Revision } from "../shared/contracts.js";

const PUBLIC_ERROR_MESSAGES: Record<PublicErrorCode, string> = {
  CONTRACT_VERSION_MISMATCH: "客户端合同版本已过期，请重新加载。",
  SCHEMA_INVALID: "请求格式无效。",
  REVISION_CONFLICT: "周目状态已更新，请重新读取。",
  RUN_NOT_FOUND: "周目不存在。",
  DUPLICATE_INTENT_CONFLICT: "该意图标识已用于不同请求。",
  PERSISTENCE_UNAVAILABLE: "存储当前不可用。",
  SENDER_REJECTED: "请求来源不受信任。",
  INTERNAL_ERROR: "操作未完成。",
};

const RETRYABLE_CODES = new Set<PublicErrorCode>([
  "REVISION_CONFLICT",
  "PERSISTENCE_UNAVAILABLE",
]);

export function makePublicError(code: PublicErrorCode, currentRevision?: Revision): PublicError {
  const base = {
    code,
    message: PUBLIC_ERROR_MESSAGES[code],
    retryable: RETRYABLE_CODES.has(code),
  };

  if (currentRevision === undefined) {
    return base;
  }

  return { ...base, currentRevision };
}

export function isPublicError(value: unknown): value is PublicError {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.code === "string" &&
    typeof record.message === "string" &&
    typeof record.retryable === "boolean"
  );
}
