import type {
  PublicActionKind,
  PublicCheckModifier,
  PublicCoreStatKey,
  PublicConsequenceChange,
  PublicConsequenceTarget,
  PublicEventKind,
  PublicEventResolutionMode,
  PublicResolutionTier,
} from "../shared/contracts.js";

export const BA2_CONTENT_STATUS = "PLAYTEST_FIXTURE" as const;
export type BA2ContentStatus = typeof BA2_CONTENT_STATUS;

export interface BA2CheckDefinition {
  readonly ability: PublicCoreStatKey;
  readonly difficulty: number;
  readonly modifiers: readonly PublicCheckModifier[];
}

export interface BA2ConsequenceDefinition {
  readonly id: string;
  readonly target: PublicConsequenceTarget;
  readonly change: PublicConsequenceChange;
  readonly numericValue?: number;
  readonly referenceId?: string;
  readonly condition: "ALWAYS" | PublicResolutionTier;
  readonly source: string;
  readonly summary: string;
}

export interface BA2EventChoiceDefinition {
  readonly id: string;
  readonly label: string;
  readonly resolutionMode: PublicEventResolutionMode;
  readonly hardCostPreview: string;
  readonly foreseeableConsequences: readonly string[];
  readonly check?: BA2CheckDefinition;
  readonly consequences: readonly BA2ConsequenceDefinition[];
  readonly nextStageDefinitionId?: string;
}

export interface BA2EventDefinition {
  readonly id: string;
  readonly kind: PublicEventKind;
  readonly title: string;
  readonly body: string;
  readonly sourceLabel: string;
  readonly contentStatus: BA2ContentStatus;
  readonly triggerActions: readonly (PublicActionKind | "WORLD_PULSE")[];
  readonly weight: number;
  readonly cooldownWeeks: number;
  readonly diversityGroup: string;
  readonly pityGroup: string;
  readonly choices: readonly BA2EventChoiceDefinition[];
}

export interface BA2FixtureChain {
  readonly id: string;
  readonly contentStatus: BA2ContentStatus;
  readonly stages: readonly string[];
}

const NO_COST = "无额外支出。";
const ALWAYS = "ALWAYS" as const;

const actionChoice = (
  id: string,
  label: string,
  summary: string,
  consequences: readonly BA2ConsequenceDefinition[],
): BA2EventChoiceDefinition => ({
  id,
  label,
  resolutionMode: "NONE",
  hardCostPreview: NO_COST,
  foreseeableConsequences: [summary],
  consequences,
});

const checkChoice = (
  id: string,
  label: string,
  check: BA2CheckDefinition,
  consequenceSummary: string,
  consequences: readonly BA2ConsequenceDefinition[],
): BA2EventChoiceDefinition => ({
  id,
  label,
  resolutionMode: "CHECK",
  hardCostPreview: NO_COST,
  foreseeableConsequences: [consequenceSummary],
  check,
  consequences,
});

const clueConsequence = (
  id: string,
  referenceId: string,
  summary: string,
  condition: BA2ConsequenceDefinition["condition"] = ALWAYS,
): BA2ConsequenceDefinition => ({
  id,
  target: "CLUE",
  change: "CREATE",
  referenceId,
  condition,
  source: "公开线索",
  summary,
});

const knowledgeConsequence = (
  id: string,
  referenceId: string,
  summary: string,
  condition: BA2ConsequenceDefinition["condition"] = ALWAYS,
): BA2ConsequenceDefinition => ({
  id,
  target: "KNOWLEDGE",
  change: "CREATE",
  referenceId,
  condition,
  source: "公开记录",
  summary,
});

const eventQueueConsequence = (
  id: string,
  referenceId: string,
  summary: string,
): BA2ConsequenceDefinition => ({
  id,
  target: "EVENT",
  change: "QUEUE",
  referenceId,
  condition: ALWAYS,
  source: "后续线索",
  summary,
});

const CHECK_KNOWLEDGE: BA2CheckDefinition = {
  ability: "knowledge",
  difficulty: 10,
  modifiers: [],
};
const CHECK_PERCEPTION: BA2CheckDefinition = {
  ability: "perception",
  difficulty: 15,
  modifiers: [],
};
const CHECK_WILL: BA2CheckDefinition = {
  ability: "will",
  difficulty: 15,
  modifiers: [],
};

export const BA2_EVENT_DEFINITIONS: readonly BA2EventDefinition[] = [
  {
    id: "ba2-event-neighborhood-repair",
    kind: "ACTION_RESULT",
    title: "街坊的临时差事",
    body: "楼下有人临时找人帮忙搬运修缮材料，事情不大，却能听见几句街坊闲谈。",
    sourceLabel: "街坊消息",
    contentStatus: BA2_CONTENT_STATUS,
    triggerActions: ["WORK"],
    weight: 4,
    cooldownWeeks: 1,
    diversityGroup: "neighborhood",
    pityGroup: "ordinary-life",
    choices: [
      actionChoice("ba2-event-neighborhood-repair-accept", "搭把手", "你获得了一条关于附近住户往来的公开线索。", [
        clueConsequence("ba2-neighborhood-repair-clue", "clue-neighborhood-repair", "附近住户最近频繁交换修缮材料。"),
      ]),
      actionChoice("ba2-event-neighborhood-repair-decline", "礼貌回绝", "你记下了这次短暂的街坊往来。", []),
    ],
  },
  {
    id: "ba2-event-missing-ledger",
    kind: "ACTION_RESULT",
    title: "缺了一页的账簿",
    body: "工作间的旧账簿少了一页，留下的笔迹和日期都很普通，但缺口并非偶然撕裂。",
    sourceLabel: "工作间记录",
    contentStatus: BA2_CONTENT_STATUS,
    triggerActions: ["WORK"],
    weight: 3,
    cooldownWeeks: 2,
    diversityGroup: "workplace",
    pityGroup: "ordinary-life",
    choices: [
      checkChoice("ba2-event-missing-ledger-compare", "对照剩余账页", CHECK_KNOWLEDGE, "你能确认账页缺失的大致时间。", [
        clueConsequence("ba2-missing-ledger-clue", "clue-missing-ledger", "账页缺口落在一次交接之前。", "SUCCESS"),
        clueConsequence("ba2-missing-ledger-fallback", "clue-missing-ledger-fallback", "剩余账页显示有人改动过交接顺序。", "FAILURE"),
      ]),
      actionChoice("ba2-event-missing-ledger-leave", "先把账簿放回原处", "你没有打扰工作间的原有秩序。", []),
    ],
  },
  {
    id: "ba2-event-newspaper-insert",
    kind: "ACTION_RESULT",
    title: "旧报纸的夹页",
    body: "一张旧报纸里夹着手写摘录，内容只谈街区近况，却比零散传闻更容易核对。",
    sourceLabel: "公开报刊",
    contentStatus: BA2_CONTENT_STATUS,
    triggerActions: ["LEARN"],
    weight: 5,
    cooldownWeeks: 1,
    diversityGroup: "reading",
    pityGroup: "learning",
    choices: [
      actionChoice("ba2-event-newspaper-insert-copy", "抄下可核对的部分", "你留下了一条可以反复查阅的公开知识记录。", [
        knowledgeConsequence("ba2-newspaper-knowledge", "knowledge-neighborhood-notices", "街区公告通常会先于正式通知出现在公共栏上。"),
      ]),
      actionChoice("ba2-event-newspaper-insert-return", "将夹页放回", "你记住了这份材料的大致出处。", []),
    ],
  },
  {
    id: "ba2-event-unfamiliar-symbols",
    kind: "ACTION_RESULT",
    title: "陌生符号的抄本",
    body: "材料边角有一套反复出现的符号。它们没有神秘力量，只是需要耐心比对的记录习惯。",
    sourceLabel: "私人抄本",
    contentStatus: BA2_CONTENT_STATUS,
    triggerActions: ["LEARN"],
    weight: 2,
    cooldownWeeks: 3,
    diversityGroup: "reading",
    pityGroup: "learning",
    choices: [
      checkChoice("ba2-event-unfamiliar-symbols-compare", "逐项比对", CHECK_KNOWLEDGE, "你能确认其中一组符号在记录中的用法。", [
        knowledgeConsequence("ba2-symbol-knowledge", "knowledge-recording-marks", "同一份记录中的重复符号可能表示时间或交接顺序。", "SUCCESS"),
      ]),
      actionChoice("ba2-event-unfamiliar-symbols-note", "只记下出现位置", "你保存了可供日后查阅的材料出处。", []),
    ],
  },
  {
    id: "ba2-event-harbor-ledger-gap",
    kind: "INVESTIGATION",
    title: "货单上的缺口",
    body: "几份公开货单之间出现了短暂的日期空档。你暂时只能确认缺口存在，无法据此断定更多事情。",
    sourceLabel: "公开货单",
    contentStatus: BA2_CONTENT_STATUS,
    triggerActions: ["INVESTIGATE"],
    weight: 6,
    cooldownWeeks: 1,
    diversityGroup: "records",
    pityGroup: "investigation",
    choices: [
      checkChoice("ba2-event-harbor-ledger-gap-check", "核对日期与编号", CHECK_PERCEPTION, "你能把货单缺口缩小到一个明确的交接时段。", [
        clueConsequence("ba2-harbor-ledger-clue", "clue-harbor-ledger", "货单缺口集中在一次交接时段。", "SUCCESS"),
        clueConsequence("ba2-harbor-ledger-fallback", "clue-harbor-ledger-fallback", "货单编号存在一处需要继续核对的跳号。", "FAILURE"),
      ]),
      actionChoice("ba2-event-harbor-ledger-gap-file", "标记缺口再离开", "你留下了一个可供后续调查的明确位置。", [
        clueConsequence("ba2-harbor-ledger-mark", "clue-harbor-ledger-mark", "公开货单中有一处日期缺口等待核对。"),
      ]),
    ],
  },
  {
    id: "ba2-event-unclaimed-letter",
    kind: "INVESTIGATION",
    title: "无人认领的信件",
    body: "公共投递处留着一封地址不完整的信。信封上的字迹可以辨认，收件人却暂时无法确认。",
    sourceLabel: "公共投递处",
    contentStatus: BA2_CONTENT_STATUS,
    triggerActions: ["INVESTIGATE"],
    weight: 4,
    cooldownWeeks: 2,
    diversityGroup: "records",
    pityGroup: "investigation",
    choices: [
      actionChoice("ba2-event-unclaimed-letter-record", "记录信封特征", "你获得了一条可回头核对的公开线索。", [
        clueConsequence("ba2-unclaimed-letter-clue", "clue-unclaimed-letter", "一封地址不完整的信件曾被留在公共投递处。"),
      ]),
      checkChoice("ba2-event-unclaimed-letter-ask", "向值守者询问", CHECK_WILL, "你试着确认信件被留下的时间。", [
        clueConsequence("ba2-unclaimed-letter-time", "clue-unclaimed-letter-time", "值守记录能确认信件大致被留下的时段。", "SUCCESS"),
      ]),
    ],
  },
  {
    id: "ba2-event-stairway-footsteps",
    kind: "THRESHOLD",
    title: "楼道里的脚步",
    body: "夜里楼道传来短促的脚步声，声音很快消失，只留下邻居关门时的一点动静。",
    sourceLabel: "居住区动静",
    contentStatus: BA2_CONTENT_STATUS,
    triggerActions: ["REST"],
    weight: 3,
    cooldownWeeks: 2,
    diversityGroup: "home",
    pityGroup: "ordinary-life",
    choices: [
      checkChoice("ba2-event-stairway-footsteps-listen", "留意片刻", CHECK_PERCEPTION, "你分辨出脚步来自哪一段楼梯。", [
        clueConsequence("ba2-stairway-clue", "clue-stairway-footsteps", "脚步声来自楼道较低的一段，随后没有继续靠近。", "SUCCESS"),
      ]),
      actionChoice("ba2-event-stairway-footsteps-rest", "继续休息", "你没有让短暂的声响改变今晚的安排。", []),
    ],
  },
  {
    id: "ba2-event-rain-knock",
    kind: "THRESHOLD",
    title: "雨声里的敲门",
    body: "雨声盖住了门外的两下敲门。等你靠近时，走廊已经恢复安静。",
    sourceLabel: "居住区动静",
    contentStatus: BA2_CONTENT_STATUS,
    triggerActions: ["REST"],
    weight: 2,
    cooldownWeeks: 3,
    diversityGroup: "home",
    pityGroup: "ordinary-life",
    choices: [
      actionChoice("ba2-event-rain-knock-check", "查看门外", "门外没有留下可确认的访客信息。", []),
      actionChoice("ba2-event-rain-knock-ignore", "不再追问", "你把注意力重新放回休息上。", []),
    ],
  },
  {
    id: "ba2-event-distant-notice",
    kind: "WORLD_PULSE",
    title: "远方的公开消息",
    body: "新的一周开始时，公共栏上换了一张远方城市的简短通知。它没有涉及你的生活，却改变了街谈巷议的方向。",
    sourceLabel: "公共告示",
    contentStatus: BA2_CONTENT_STATUS,
    triggerActions: ["WORLD_PULSE"],
    weight: 3,
    cooldownWeeks: 2,
    diversityGroup: "public-news",
    pityGroup: "world-pulse",
    choices: [
      actionChoice("ba2-event-distant-notice-read", "读完通知", "你记下一条可以确认来源的公开消息。", [
        knowledgeConsequence("ba2-distant-notice-knowledge", "knowledge-public-notices", "公共通知的措辞和张贴位置可以帮助判断消息来源。"),
      ]),
      actionChoice("ba2-event-distant-notice-pass", "先行离开", "你只记住了公共栏更换过通知。", []),
    ],
  },
  {
    id: "ba2-event-chain-ledger",
    kind: "CHAIN_STAGE",
    title: "被折起的清单",
    body: "一张被折起的清单从旧纸堆中露出一角，条目普通，顺序却像是被人重新整理过。",
    sourceLabel: "旧纸堆",
    contentStatus: BA2_CONTENT_STATUS,
    triggerActions: ["INVESTIGATE"],
    weight: 1,
    cooldownWeeks: 4,
    diversityGroup: "paper-trail",
    pityGroup: "fixture-chain",
    choices: [
      checkChoice("ba2-event-chain-ledger-follow", "沿着编号追查", CHECK_KNOWLEDGE, "你找到下一张清单可能出现的公开位置。", [
        clueConsequence("ba2-chain-stage-one-clue", "clue-chain-stage-one", "被折起的清单与另一处公开记录存在编号联系。", "SUCCESS"),
        eventQueueConsequence("ba2-chain-stage-one-next", "ba2-event-chain-contact", "后续清单将在合适时机出现。"),
      ],),
      actionChoice("ba2-event-chain-ledger-copy", "只抄下编号", "你保存了一个可以继续核对的编号。", [
        eventQueueConsequence("ba2-chain-stage-one-copy-next", "ba2-event-chain-contact", "后续清单将在合适时机出现。"),
      ]),
    ],
  },
  {
    id: "ba2-event-chain-contact",
    kind: "CHAIN_STAGE",
    title: "约在白天的会面",
    body: "编号指向一张简短留言，留言只约定了白天的公共地点，没有写下更多身份信息。",
    sourceLabel: "公开留言",
    contentStatus: BA2_CONTENT_STATUS,
    triggerActions: ["INVESTIGATE", "WORLD_PULSE"],
    weight: 1,
    cooldownWeeks: 4,
    diversityGroup: "paper-trail",
    pityGroup: "fixture-chain",
    choices: [
      actionChoice("ba2-event-chain-contact-wait", "按留言等待", "你确认了一条关于会面时间的公开记录。", [
        clueConsequence("ba2-chain-stage-two-clue", "clue-chain-stage-two", "留言只确认白天会面，未说明对方身份。"),
        eventQueueConsequence("ba2-chain-stage-two-next", "ba2-event-chain-close", "最后一段记录将在后续出现。"),
      ]),
      actionChoice("ba2-event-chain-contact-leave", "不作回应", "你保留了留言本身，没有继续接触。", []),
    ],
  },
  {
    id: "ba2-event-chain-close",
    kind: "CHAIN_STAGE",
    title: "最后一张收据",
    body: "最后一张收据把此前的编号和日期放在同一页上，事情仍然普通，却终于能够前后对应。",
    sourceLabel: "公开收据",
    contentStatus: BA2_CONTENT_STATUS,
    triggerActions: ["INVESTIGATE", "WORLD_PULSE"],
    weight: 1,
    cooldownWeeks: 6,
    diversityGroup: "paper-trail",
    pityGroup: "fixture-chain",
    choices: [
      actionChoice("ba2-event-chain-close-file", "整理成一份记录", "你把这段公开记录整理成可供日后查阅的条目。", [
        knowledgeConsequence("ba2-chain-stage-three-knowledge", "knowledge-chain-record", "三张公开记录可以按编号和日期相互核对。"),
      ]),
      actionChoice("ba2-event-chain-close-discard", "收起收据", "你暂时不再追查这组普通记录。", []),
    ],
  },
] as const;

export const BA2_FIXTURE_CHAIN: BA2FixtureChain = {
  id: "ba2-fixture-paper-trail",
  contentStatus: BA2_CONTENT_STATUS,
  stages: [
    "ba2-event-chain-ledger",
    "ba2-event-chain-contact",
    "ba2-event-chain-close",
  ],
};

function isSafeText(value: unknown, maximumLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximumLength &&
    value === value.trim() && !/[<>\u0000-\u001f\u007f]/u.test(value);
}

function isValidCheck(value: unknown): value is BA2CheckDefinition {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join("\u0000") !== "ability\u0000difficulty\u0000modifiers") return false;
  return (
    record.ability === "physique" || record.ability === "perception" ||
    record.ability === "will" || record.ability === "knowledge"
  ) && Number.isSafeInteger(record.difficulty) && (record.difficulty as number) >= 0 &&
    (record.difficulty as number) <= 500 && Array.isArray(record.modifiers) &&
    record.modifiers.length <= 16 &&
    record.modifiers.every((modifier) => {
      if (typeof modifier !== "object" || modifier === null || Array.isArray(modifier)) return false;
      const item = modifier as Record<string, unknown>;
      return Object.keys(item).sort().join("\u0000") === "source\u0000value" &&
        isSafeText(item.source, 128) && Number.isSafeInteger(item.value) &&
        (item.value as number) >= -500 && (item.value as number) <= 500;
    });
}

function isValidConsequence(
  value: unknown,
  definitionIds?: ReadonlySet<string>,
): value is BA2ConsequenceDefinition {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const allowed = ["condition", "id", "numericValue", "referenceId", "source", "summary", "target", "change"];
  if (keys.some((key) => !allowed.includes(key)) || !keys.includes("condition") || !keys.includes("id") ||
    !keys.includes("source") || !keys.includes("summary") || !keys.includes("target") || !keys.includes("change")) {
    return false;
  }
  return isSafeText(record.id, 128) && isSafeText(record.source, 128) && isSafeText(record.summary, 512) &&
    (record.target === "CORE_STAT" || record.target === "RESOURCE" || record.target === "CASH" ||
      record.target === "KNOWLEDGE" || record.target === "CLUE" || record.target === "EVENT" ||
      record.target === "WORLD_STATE") &&
    (record.change === "ADD" || record.change === "SET" || record.change === "CREATE" ||
      record.change === "QUEUE" || record.change === "REMOVE") &&
    (record.condition === ALWAYS || record.condition === "GREAT_SUCCESS" || record.condition === "SUCCESS" ||
      record.condition === "FAILURE" || record.condition === "GREAT_FAILURE") &&
    (!Object.prototype.hasOwnProperty.call(record, "numericValue") || Number.isSafeInteger(record.numericValue)) &&
    (!Object.prototype.hasOwnProperty.call(record, "referenceId") || isSafeText(record.referenceId, 128)) &&
    (record.target !== "EVENT" || record.change !== "QUEUE" ||
      (definitionIds !== undefined && isSafeText(record.referenceId, 128) && definitionIds.has(record.referenceId)));
}

function isValidChoice(value: unknown, definitionIds: ReadonlySet<string>): value is BA2EventChoiceDefinition {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const allowed = ["check", "consequences", "foreseeableConsequences", "hardCostPreview", "id", "label", "nextStageDefinitionId", "resolutionMode"];
  if (keys.some((key) => !allowed.includes(key)) ||
    !["id", "label", "resolutionMode", "hardCostPreview", "foreseeableConsequences", "consequences"].every((key) => keys.includes(key))) {
    return false;
  }
  if (!isSafeText(record.id, 128) || !isSafeText(record.label, 128) || !isSafeText(record.hardCostPreview, 256) ||
    !Array.isArray(record.foreseeableConsequences) || record.foreseeableConsequences.length === 0 ||
    !record.foreseeableConsequences.every((item) => isSafeText(item, 512)) ||
    !Array.isArray(record.consequences) || !record.consequences.every((consequence) => isValidConsequence(consequence, definitionIds))) {
    return false;
  }
  if (record.resolutionMode !== "NONE" && record.resolutionMode !== "CHECK" &&
    record.resolutionMode !== "COMBAT" && record.resolutionMode !== "TRADE") return false;
  const hasCheck = Object.prototype.hasOwnProperty.call(record, "check");
  if (hasCheck && !isValidCheck(record.check)) return false;
  if (record.resolutionMode === "CHECK" && !hasCheck) return false;
  if (record.resolutionMode !== "CHECK" && hasCheck) return false;
  const hasNextStage = Object.prototype.hasOwnProperty.call(record, "nextStageDefinitionId");
  return !hasNextStage || (
    isSafeText(record.nextStageDefinitionId, 128) &&
    definitionIds.has(record.nextStageDefinitionId)
  );
}

export function validateBA2EventPack(
  definitions: unknown = BA2_EVENT_DEFINITIONS,
  chain: unknown = BA2_FIXTURE_CHAIN,
): definitions is readonly BA2EventDefinition[] {
  if (!Array.isArray(definitions) || definitions.length !== 12 ||
    typeof chain !== "object" || chain === null || Array.isArray(chain)) return false;
  const chainRecord = chain as Record<string, unknown>;
  if (Object.keys(chainRecord).sort().join("\u0000") !== "contentStatus\u0000id\u0000stages" ||
    chainRecord.contentStatus !== BA2_CONTENT_STATUS || !isSafeText(chainRecord.id, 128) ||
    !Array.isArray(chainRecord.stages) || chainRecord.stages.length !== 3 ||
    !chainRecord.stages.every((stage) => isSafeText(stage, 128))) return false;
  const ids = new Set(definitions.map((definition) => {
    if (typeof definition !== "object" || definition === null || Array.isArray(definition)) return "";
    return typeof (definition as Record<string, unknown>).id === "string"
      ? (definition as Record<string, unknown>).id as string
      : "";
  }));
  if (ids.size !== 12 || ids.has("")) return false;
  return definitions.every((definition) => {
    if (typeof definition !== "object" || definition === null || Array.isArray(definition)) return false;
    const record = definition as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const expected = ["body", "choices", "contentStatus", "cooldownWeeks", "diversityGroup", "id", "kind", "pityGroup", "sourceLabel", "title", "triggerActions", "weight"];
    if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) return false;
    if (!isSafeText(record.id, 128) || !isSafeText(record.title, 256) || !isSafeText(record.body, 1024) ||
      !isSafeText(record.sourceLabel, 128) || !isSafeText(record.diversityGroup, 128) || !isSafeText(record.pityGroup, 128) ||
      record.contentStatus !== BA2_CONTENT_STATUS ||
      (record.kind !== "ACTION_RESULT" && record.kind !== "INVESTIGATION" &&
        record.kind !== "CHAIN_STAGE" && record.kind !== "THRESHOLD" &&
        record.kind !== "MARKET" && record.kind !== "WORLD_PULSE") ||
      !Array.isArray(record.triggerActions) ||
      record.triggerActions.length === 0 || !record.triggerActions.every((action) =>
        action === "WORK" || action === "LEARN" || action === "INVESTIGATE" || action === "REST" || action === "WORLD_PULSE") ||
      !Number.isSafeInteger(record.weight) || (record.weight as number) < 1 || (record.weight as number) > 100 ||
      !Number.isSafeInteger(record.cooldownWeeks) || (record.cooldownWeeks as number) < 0 || (record.cooldownWeeks as number) > 52 ||
      !Array.isArray(record.choices) || record.choices.length !== 2 ||
      !record.choices.every((choice) => isValidChoice(choice, ids))) return false;
    const choiceIds = new Set((record.choices as readonly BA2EventChoiceDefinition[]).map((choice) => choice.id));
    return choiceIds.size === 2;
  }) && chainRecord.stages.every((stage) => ids.has(stage as string));
}

if (!validateBA2EventPack()) {
  throw new Error("BA2 event fixture pack is invalid");
}
