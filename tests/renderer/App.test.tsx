/* @vitest-environment jsdom */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../../src/renderer/App";
import {
  CONTENT_VERSION,
  CONTRACT_VERSION,
  RULE_VERSION,
  STORAGE_SCHEMA_VERSION,
  type BootstrapProjection,
  type BridgeResult,
  type CharacterCreationSelection,
  type CommitReceipt,
  type IntentEnvelope,
  type MysteryGameBridge,
  type PublicActionResult,
  type PublicCheckPreview,
  type PublicCharacterCreationCatalogue,
  type PublicClueRecord,
  type PublicConsequenceItem,
  type PublicEventCard,
  type PublicEventResolutionResult,
  type PublicGameDate,
  type PublicGameState,
  type PublicKnowledgeRecord,
  type PublicPendingEvent,
  type PublicSocialTier,
  type PublicWorldFeedbackEntry,
} from "@shared/contracts";

const appSource = readFileSync(resolve(process.cwd(), "src", "renderer", "App.tsx"), "utf8");
const rendererMainSource = readFileSync(resolve(process.cwd(), "src", "renderer", "main.tsx"), "utf8");

const ok = <T,>(value: T): BridgeResult<T> => ({ ok: true, value });

function makePublicError(
  code: "CONTENT_SELECTION_INVALID" | "PERSISTENCE_UNAVAILABLE" | "REVISION_CONFLICT" | "ACTION_UNAVAILABLE" | "INTERNAL_ERROR",
  retryable = true,
) {
  return { code, message: "private detail", retryable } as const;
}

const errorResult = (error: ReturnType<typeof makePublicError>): BridgeResult<never> => ({ ok: false, error });

const FORBIDDEN_PLAYER_TERMS = [
  /\bR[0-9]+\b/i,
  /fixture/i,
  /工程/,
  /公开投影/,
  /公开状态/,
  /\bMain\b/i,
  /\bSQLite\b/i,
  /\bbridge\b/i,
  /持久化/,
  /后续轮次/,
  /READ ONLY VIEW/i,
  /未开放/,
  /开发/,
  /轮次/,
  /本轮/,
  /未结算/,
];

function expectNoForbiddenPlayerTerms() {
  const visibleText = document.body.textContent ?? "";
  for (const term of FORBIDDEN_PLAYER_TERMS) {
    expect(visibleText).not.toMatch(term);
  }
}

type PageOverflowMeasurement =
  | { readonly status: "NOT_PROVABLE_IN_JSDOM"; readonly reason: string }
  | { readonly status: "MEASURED"; readonly horizontal: boolean; readonly vertical: boolean };

function measurePageOverflow(): PageOverflowMeasurement {
  const documentElement = document.documentElement;
  const body = document.body;
  if (
    documentElement.clientWidth === 0 ||
    documentElement.clientHeight === 0 ||
    body.clientWidth === 0 ||
    body.clientHeight === 0
  ) {
    return {
      status: "NOT_PROVABLE_IN_JSDOM",
      reason: "jsdom does not perform the layout needed to measure rendered page overflow",
    };
  }

  return {
    status: "MEASURED",
    horizontal: documentElement.scrollWidth > documentElement.clientWidth || body.scrollWidth > body.clientWidth,
    vertical: documentElement.scrollHeight > documentElement.clientHeight || body.scrollHeight > body.clientHeight,
  };
}

const date = (day = 28): PublicGameDate => ({ epoch: "FIFTH_EPOCH", year: 1349, month: 6, day });

const ORIGIN_DEFINITIONS: readonly {
  readonly id: string;
  readonly label: string;
  readonly tier: PublicSocialTier;
  readonly summary: string;
}[] = [
  { id: "origin-street", label: "无依街巷长大", tier: "POOR", summary: "没有固定的家门，先学会在街巷里照料自己。" },
  { id: "origin-indebted", label: "负债失业家庭", tier: "POOR", summary: "家里欠着账，也仍在想办法把日子撑下去。" },
  { id: "origin-factory", label: "工厂工资家庭", tier: "LABOR", summary: "家人的工资来自工厂，工友和班次组成了熟悉的世界。" },
  { id: "origin-service", label: "雇主依附的服务家庭", tier: "LABOR", summary: "家人依靠一户雇主生活，推荐与声誉都不能轻易失去。" },
  { id: "origin-shop", label: "自营小店或小作坊家庭", tier: "LOWER_MIDDLE", summary: "家里有一间小店或作坊，熟客和手艺撑起日常。" },
  { id: "origin-clerical", label: "受教育的基层职员家庭", tier: "LOWER_MIDDLE", summary: "家人熟悉文书、规章和机构里的来往。" },
  { id: "origin-professional", label: "高等教育专业人士家庭", tier: "UPPER_MIDDLE", summary: "家里有人受过高等教育，专业声誉带来清晰的道路。" },
  { id: "origin-commerce", label: "中型商贸或产业经营家庭", tier: "UPPER_MIDDLE", summary: "家里经营一项稳定的商贸或产业，往来与信用相互牵连。" },
  { id: "origin-noble", label: "贵族家系", tier: "UPPER", summary: "家名和旧日关系仍在，但它们不等于你本人拥有爵位。" },
  { id: "origin-elite", label: "获社会承认的实业或金融精英家庭", tier: "UPPER", summary: "资本与社会承认打开一些门，也带来相应的期待。" },
];

const PROFESSION_DEFINITIONS = [
  ["profession-factory", "工厂工人", "LEGAL"],
  ["profession-dock", "码头工人", "LEGAL"],
  ["profession-servant", "宅邸仆役", "LEGAL"],
  ["profession-craft", "手工业学徒", "LEGAL"],
  ["profession-shop", "商店店员", "LEGAL"],
  ["profession-clerk", "公司文员", "LEGAL"],
  ["profession-police", "基层警员", "LEGAL"],
  ["profession-detective", "私家侦探", "GRAY"],
  ["profession-accountant", "公司会计", "LEGAL"],
  ["profession-lawyer", "律师", "LEGAL"],
  ["profession-bounty", "赏金猎人", "GRAY"],
  ["profession-runner", "帮派跑腿", "ILLEGAL"],
] as const;

function makeCatalogue(): PublicCharacterCreationCatalogue {
  const professions = PROFESSION_DEFINITIONS.map(([id, label, legality]) => ({
    id,
    label,
    summary: `${label}是你眼前的一条谋生道路。这里的说明只用于选择时参考。`,
    legality,
    opening: {
      coreStatModifiers: { physique: 2, perception: 0, will: 1, knowledge: 0 },
      initialCashPence: 10,
      weeklyWorkPayPence: 72,
      status: "BALANCE_REVIEW_CANDIDATE" as const,
    },
  }));
  const origins = ORIGIN_DEFINITIONS.map((origin) => ({
    ...origin,
    opening: {
      coreStatModifiers: { physique: 2, perception: 0, will: 1, knowledge: -1 },
      defaultEducation: "BASIC" as const,
      educationLabel: "基础教育",
      openingKnowledgeBonus: 1,
      familyEconomyLabel: "依靠固定工资",
      status: "BALANCE_REVIEW_CANDIDATE" as const,
    },
  }));
  const compatibility = origins.flatMap((origin, originIndex) =>
    professions.map((profession, professionIndex) => ({
      originId: origin.id,
      professionId: profession.id,
      status: professionIndex === 0
        ? "DIRECT" as const
        : professionIndex === 1
          ? "CONDITIONAL" as const
          : professionIndex === 11
            ? "FORBIDDEN" as const
            : "DIRECT" as const,
      publicReason: professionIndex === 1
        ? "需要一位熟人替你作保。"
        : professionIndex === 11
          ? "这条路与你当前的来处还接不上。"
          : "这条路与你熟悉的生活可以相接。",
      ...(professionIndex === 1
        ? { conditionId: `condition-${originIndex}`, conditionCostSummary: "承下一份人情与相应的约束。" }
        : {}),
    })),
  );

  return {
    contentVersion: CONTENT_VERSION,
    fixtureContent: true,
    notice: "可用选择会随旅程继续整理。",
    birthplaces: [
      { id: "birth-backlund", label: "贝克兰德", summary: "王国首都的街区与人群。" },
      { id: "birth-tingen", label: "廷根市", summary: "大学城里交错的旧街与新知。" },
      { id: "birth-konstant", label: "康斯顿市", summary: "煤钢工业重镇的烟尘与汽笛。" },
      { id: "birth-pritz", label: "普利兹港", summary: "港口潮声与来往不息的货船。" },
    ],
    portraits: [
      { id: "portrait-a", label: "沉静的面容", summary: "", appearanceTags: ["短发", "沉静"] },
      { id: "portrait-b", label: "清醒的面容", summary: "", appearanceTags: ["长发", "敏锐"] },
    ],
    origins,
    professions,
    traits: [
      { id: "trait-careful", label: "谨慎", summary: "习惯先看清脚下的路。", incompatibleTraitIds: ["trait-reckless"] },
      { id: "trait-curious", label: "好奇", summary: "难以对未知之物视而不见。", incompatibleTraitIds: [] },
      { id: "trait-reckless", label: "莽撞", summary: "常常先迈步，再考虑后果。", incompatibleTraitIds: ["trait-careful"] },
    ],
    flaws: [
      { id: "flaw-distracted", label: "容易分心", summary: "细小的诱因也会带走注意。" },
      { id: "flaw-proud", label: "不肯低头", summary: "明知不利，也很难承认退让。" },
    ],
    specializations: [],
    compatibility,
  };
}

function noRunBootstrap(catalogue = makeCatalogue()): BootstrapProjection {
  return {
    appVersion: "0.1.0",
    contractVersion: CONTRACT_VERSION,
    storageSchemaVersion: STORAGE_SCHEMA_VERSION,
    storageStatus: "READY",
    lifecycle: "NO_RUN",
    runs: [],
    activeState: null,
    characterCreation: catalogue,
  };
}

function activeGame(
  displayName = "阿黛尔",
  cashPence = 1234,
  overrides: Partial<PublicGameState> = {},
): PublicGameState {
  return {
    contractVersion: CONTRACT_VERSION,
    ruleVersion: RULE_VERSION,
    contentVersion: CONTENT_VERSION,
    runId: "run-browser-alpha",
    lifecycle: "ACTIVE",
    revision: 1,
    week: 1,
    currentDate: date(),
    availableActions: 3,
    cashPence,
    character: {
      displayName,
      sex: "FEMALE",
      age: 28,
      originCountry: "LOEN",
      birthplace: { id: "birth-backlund", label: "贝克兰德" },
      appearanceDescription: "黑发，灰眼，衣着整洁。",
      origin: { id: "origin-street", label: "无依街巷长大", tier: "POOR" },
      profession: { id: "profession-factory", label: "工厂工人", legality: "LEGAL" },
      traits: [
        { id: "trait-careful", label: "谨慎" },
        { id: "trait-curious", label: "好奇" },
      ],
      flaw: { id: "flaw-distracted", label: "容易分心" },
      sequence: "ORDINARY",
      coreStats: { physique: 15, perception: 15, will: 15, knowledge: 15 },
      resources: {
        health: { current: 100, max: 100 },
        mind: { current: 100, max: 100 },
        spirituality: { current: 15, max: 15 },
        pollution: 0,
      },
    },
    chronicle: [
      { id: "chronicle-1", week: 1, date: date(), title: "日子开始转动", summary: "你在熟悉的街区醒来，今天还有许多事要做。" },
    ],
    knowledgeRecords: [],
    clues: [],
    worldFeedback: [],
    activeEvent: null,
    pendingEvents: [],
    lastEventResolution: null,
    lastAction: null,
    stateChecksum: "a".repeat(64),
    ...overrides,
  };
}

function checkPreview(overrides: Partial<PublicCheckPreview> = {}): PublicCheckPreview {
  return {
    ability: "perception",
    baseAbility: 15,
    modifiers: [{ source: "熟悉街巷", value: 2 }],
    effectiveAbility: 17,
    difficulty: 12,
    chance: 60,
    ...overrides,
  };
}

function checkResult(): NonNullable<PublicActionResult["resolution"]> {
  return { ...checkPreview(), roll: 34, tier: "SUCCESS" };
}

function consequence(overrides: Partial<PublicConsequenceItem> = {}): PublicConsequenceItem {
  return {
    id: "consequence-knowledge",
    target: "KNOWLEDGE",
    change: "ADD",
    numericValue: 2,
    condition: "SUCCESS",
    applied: true,
    source: "一次学习安排",
    summary: "你把一段晦涩的记载整理成了自己的认识。",
    ...overrides,
  };
}

function knowledgeRecord(): PublicKnowledgeRecord {
  return {
    id: "knowledge-clock",
    title: "钟表匠的暗语",
    summary: "旧钟表店的记号与一条失踪消息有关。",
    visibility: "CONFIRMED",
    acquiredOn: date(),
    sourceLabel: "学习所得",
  };
}

function clueRecord(): PublicClueRecord {
  return {
    id: "clue-letter",
    title: "没有寄出的信",
    summary: "信封上的地址被人匆忙划去。",
    visibility: "RUMOR",
    acquiredOn: date(),
    sourceLabel: "街头调查",
  };
}

function feedback(overrides: Partial<PublicWorldFeedbackEntry> = {}): PublicWorldFeedbackEntry {
  return {
    id: "feedback-action",
    kind: "ACTION",
    visibility: "CONFIRMED",
    date: date(),
    title: "街区有了回声",
    summary: "有人记住了你今天的来去。",
    ...overrides,
  };
}

function actionResult(overrides: Partial<PublicActionResult> = {}): PublicActionResult {
  return {
    action: "INVESTIGATE",
    title: "线索留下回声",
    summary: "你记下了一条值得稍后回看的线索。",
    weekBefore: 1,
    weekAfter: 1,
    availableActionsBefore: 3,
    availableActionsAfter: 2,
    weekAdvanced: false,
    dateBefore: date(),
    dateAfter: date(),
    resolution: null,
    consequences: [],
    feedbackEntryId: "feedback-action",
    ...overrides,
  };
}

function eventCard(overrides: Partial<PublicEventCard> = {}): PublicEventCard {
  return {
    eventInstanceId: "event-letter",
    definitionId: "event-letter-definition",
    kind: "INVESTIGATION",
    title: "门缝里的信",
    body: "一封没有署名的信从门缝下滑进来，纸面上留着陌生的印记。",
    date: date(),
    sourceLabel: "街巷传闻",
    choices: [
      {
        id: "read-letter",
        label: "读完这封信",
        resolutionMode: "CHECK",
        hardCostPreview: "不消耗行动",
        foreseeableConsequences: ["可能得到一条新的认识"],
        checkPreview: checkPreview({ ability: "knowledge", difficulty: 14, chance: 52 }),
      },
      {
        id: "leave-letter",
        label: "暂且离开",
        resolutionMode: "NONE",
        hardCostPreview: "不消耗行动",
        foreseeableConsequences: ["这条消息会留在纪事中"],
      },
    ],
    ...overrides,
  };
}

function pendingEvent(): PublicPendingEvent {
  return {
    eventInstanceId: "event-pending",
    title: "楼梯口的脚步声",
    sourceLabel: "邻里传闻",
    createdOn: date(),
    expiresOn: date(30),
  };
}

function eventResolution(): PublicEventResolutionResult {
  return {
    eventInstanceId: "event-letter",
    choiceId: "read-letter",
    title: "信里的地址",
    summary: "你从字缝里辨出了一个可以追查的地址。",
    resolution: { ...checkPreview({ ability: "knowledge" }), roll: 12, tier: "GREAT_SUCCESS" },
    consequences: [{
      id: "consequence-clue",
      target: "CLUE",
      change: "CREATE",
      condition: "ALWAYS",
      applied: true,
      source: "信里的地址",
      summary: "一条新的地址线索留了下来。",
    }],
  };
}

function commitReceipt(game: PublicGameState, intentId = "intent-browser-alpha"): CommitReceipt {
  return {
    intentId,
    runId: game.runId,
    previousRevision: Math.max(0, game.revision - 1),
    newRevision: game.revision,
    stateChecksum: game.stateChecksum,
    committedAt: "2026-08-30T00:00:00.000Z",
    replayed: false,
    publicState: game,
  };
}

function createMockBridge(bootstrap: BridgeResult<BootstrapProjection> = ok(noRunBootstrap())) {
  const getBootstrap = vi.fn<MysteryGameBridge["getBootstrap"]>();
  const submitIntent = vi.fn<MysteryGameBridge["submitIntent"]>();
  getBootstrap.mockResolvedValue(bootstrap);
  return { bridge: { getBootstrap, submitIntent } satisfies MysteryGameBridge, getBootstrap, submitIntent };
}

function renderWithBridge(bridge: MysteryGameBridge) {
  window.mysteryGame = bridge;
  return render(<App />);
}

async function continueCreation(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "继续" }));
}

async function completeIdentity(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText("姓名"), "阿黛尔");
  await user.selectOptions(screen.getByLabelText("性别"), "FEMALE");
  await user.type(screen.getByLabelText("年龄"), "28");
  await user.selectOptions(screen.getByLabelText("出生地"), "birth-backlund");
  await user.type(screen.getByLabelText("外貌描述"), "黑发，灰眼，衣着整洁。");
  await continueCreation(user);
}

async function completeIdentityAndOrigin(user: ReturnType<typeof userEvent.setup>) {
  await completeIdentity(user);
  await user.click(screen.getByRole("button", { name: /无依街巷长大/ }));
  await continueCreation(user);
}

async function completeCreation(user: ReturnType<typeof userEvent.setup>, name = "阿黛尔") {
  const input = await screen.findByLabelText("姓名");
  await user.type(input, name);
  await user.selectOptions(screen.getByLabelText("性别"), "FEMALE");
  await user.type(screen.getByLabelText("年龄"), "28");
  await user.selectOptions(screen.getByLabelText("出生地"), "birth-backlund");
  await user.type(screen.getByLabelText("外貌描述"), "黑发，灰眼，衣着整洁。");
  await continueCreation(user);

  await user.click(screen.getByRole("button", { name: /无依街巷长大/ }));
  await continueCreation(user);

  await user.click(screen.getByRole("button", { name: /工厂工人/ }));
  await continueCreation(user);

  await user.click(screen.getByRole("button", { name: /谨慎/ }));
  await user.click(screen.getByRole("button", { name: /好奇/ }));
  await user.click(screen.getByRole("button", { name: /容易分心/ }));
  await continueCreation(user);

  expect(screen.getByRole("heading", { name: "角色摘要" })).toBeTruthy();
  expect(screen.queryByLabelText("普通技能")).toBeNull();
  expect(screen.queryByLabelText("专长")).toBeNull();
  await continueCreation(user);
  expect(screen.getByRole("heading", { name: "确认出发" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "开始旅程" }));
}

describe("BA2 renderer public play slice", () => {
  beforeEach(() => {
    delete window.mysteryGame;
  });

  afterEach(() => {
    cleanup();
    delete window.mysteryGame;
    vi.clearAllMocks();
  });

  it("shows loading before the public record responds", async () => {
    let resolveBootstrap: (result: BridgeResult<BootstrapProjection>) => void = () => undefined;
    const pendingBootstrap = new Promise<BridgeResult<BootstrapProjection>>((resolve) => {
      resolveBootstrap = resolve;
    });
    const { bridge, getBootstrap } = createMockBridge();
    getBootstrap.mockReturnValue(pendingBootstrap);

    renderWithBridge(bridge);
    expect(screen.getByRole("status").textContent).toContain("正在读取记录");

    resolveBootstrap(ok(noRunBootstrap()));
    expect(await screen.findByRole("heading", { name: "从哪一个名字开始？" })).toBeTruthy();
    expectNoForbiddenPlayerTerms();
  });

  it("fails closed when no bridge is present", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { name: "记录暂时无法打开" })).toBeTruthy();
    expect(screen.getByText("请重新启动游戏后再试。")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "开始旅程" })).toBeNull();
    expect(appSource).not.toContain("localStorage");
    expectNoForbiddenPlayerTerms();
  });

  it("keeps six steps, accepts one appearance description, and exposes no portrait or specialization choice", async () => {
    const { bridge } = createMockBridge();
    const user = userEvent.setup();
    renderWithBridge(bridge);

    expect(await screen.findByRole("heading", { name: "从哪一个名字开始？" })).toBeTruthy();
    expect(screen.getByLabelText("捏人步骤")).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    expect(screen.getByText("第 1 步，共 6 步")).toBeTruthy();
    expect(screen.getByLabelText("外貌描述")).toBeTruthy();
    expect(screen.queryByLabelText("普通技能")).toBeNull();
    expect(screen.queryByLabelText("专长")).toBeNull();
    expect(screen.queryByRole("button", { name: /肖像/ })).toBeNull();

    await user.type(screen.getByLabelText("姓名"), "阿黛尔");
    expect(screen.getByText("请选择性别。")).toBeTruthy();
    expectNoForbiddenPlayerTerms();
  });

  it("renders the four birthplaces from the public catalogue without rendering portrait data", async () => {
    const { bridge } = createMockBridge();
    renderWithBridge(bridge);

    const birthplace = await screen.findByLabelText("出生地");
    expect(Array.from((birthplace as HTMLSelectElement).options).map((option) => option.textContent)).toEqual([
      "请选择",
      "贝克兰德",
      "廷根市",
      "康斯顿市",
      "普利兹港",
    ]);
    expect(document.querySelectorAll("[data-portrait-slot]")).toHaveLength(0);
    expect(document.body.textContent).not.toContain("素描");
    expect(document.body.textContent).not.toContain("肖像");
    expectNoForbiddenPlayerTerms();
  });

  it("enforces the 80 UTF-16 code unit display-name boundary and treats whitespace as empty", async () => {
    const { bridge } = createMockBridge();
    renderWithBridge(bridge);

    const input = (await screen.findByLabelText("姓名")) as HTMLInputElement;
    expect(input.maxLength).toBe(80);
    const exactlyEightyUnits = "😀".repeat(40);
    fireEvent.change(input, { target: { value: exactlyEightyUnits } });
    expect(input.getAttribute("aria-invalid")).toBe("false");
    fireEvent.change(input, { target: { value: `${exactlyEightyUnits}a` } });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getAllByText("名字不能超过 80 个字符。")).toHaveLength(2);

    fireEvent.change(input, { target: { value: " \t " } });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getAllByText("尚未填写").length).toBeGreaterThan(0);
  });

  it("keeps conditional professions blocked without a public condition id", async () => {
    const catalogue = makeCatalogue();
    const compatibility = catalogue.compatibility.map((rule) =>
      rule.originId === "origin-street" && rule.professionId === "profession-dock"
        ? (({ conditionId: _conditionId, ...ruleWithoutCondition }) => ruleWithoutCondition)(rule)
        : rule,
    );
    const { bridge } = createMockBridge(ok(noRunBootstrap({ ...catalogue, compatibility })));
    const user = userEvent.setup();
    renderWithBridge(bridge);

    await completeIdentityAndOrigin(user);
    await user.click(screen.getByRole("button", { name: /码头工人/ }));
    expect(screen.getByText("条件内容尚未接入。")).toBeTruthy();
    expect((screen.getByRole("button", { name: "继续" }) as HTMLButtonElement).disabled).toBe(true);
    expectNoForbiddenPlayerTerms();
  });

  it("keeps the ten origins and twelve professions grounded in the public catalogue", async () => {
    const { bridge } = createMockBridge();
    const user = userEvent.setup();
    renderWithBridge(bridge);

    await completeIdentity(user);
    expect(document.querySelectorAll(".choice-grid--origins .choice-card")).toHaveLength(10);
    expect(within(screen.getByRole("button", { name: /无依街巷长大/ })).getByText("贫民")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /负债失业家庭/ }));
    expect(within(document.querySelector(".creation-detail-panel") as HTMLElement).getByText("家里欠着账，也仍在想办法把日子撑下去。")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /无依街巷长大/ }));
    await continueCreation(user);

    expect(document.querySelectorAll(".choice-grid--professions .choice-card")).toHaveLength(12);
    expect(within(screen.getByRole("button", { name: /工厂工人/ })).getByText("可从事")).toBeTruthy();
    expect(within(screen.getByRole("button", { name: /码头工人/ })).getByText("需条件")).toBeTruthy();
    expect(within(screen.getByRole("button", { name: /帮派跑腿/ })).getByText("不可从事")).toBeTruthy();
    expect((screen.getByRole("button", { name: /帮派跑腿/ }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: /码头工人/ }));
    expect(screen.getByRole("group", { name: "这条路的条件" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "继续" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("checkbox", { name: /接受/ }));
    expect((screen.getByRole("button", { name: "继续" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("keeps the opening summary sourced from selections rather than catalogue prose", async () => {
    const catalogue = makeCatalogue();
    const catalogueWithDistinctProse: PublicCharacterCreationCatalogue = {
      ...catalogue,
      origins: catalogue.origins.map((origin, index) => index === 0 ? { ...origin, summary: "选择说明不应在摘要中重复。" } : origin),
      professions: catalogue.professions.map((profession, index) => index === 0 ? { ...profession, summary: "职业说明不应在摘要中重复。" } : profession),
    };
    const { bridge } = createMockBridge(ok(noRunBootstrap(catalogueWithDistinctProse)));
    const user = userEvent.setup();
    renderWithBridge(bridge);

    await completeIdentityAndOrigin(user);
    await user.click(screen.getByRole("button", { name: /工厂工人/ }));
    await continueCreation(user);
    await user.click(screen.getByRole("button", { name: /谨慎/ }));
    await user.click(screen.getByRole("button", { name: /好奇/ }));
    await user.click(screen.getByRole("button", { name: /容易分心/ }));
    await continueCreation(user);

    const summary = screen.getByRole("region", { name: "开局摘要" });
    expect(within(summary).getByText("阿黛尔")).toBeTruthy();
    expect(within(summary).queryByText("选择说明不应在摘要中重复。")).toBeNull();
    expect(within(summary).queryByText("职业说明不应在摘要中重复。")).toBeNull();
  });

  it("fails closed when the selected profession has no public wage", async () => {
    const catalogue = makeCatalogue();
    const catalogueWithoutWage: PublicCharacterCreationCatalogue = {
      ...catalogue,
      professions: catalogue.professions.map((profession, index) => index === 0
        ? { ...profession, opening: { ...profession.opening, weeklyWorkPayPence: undefined as never } }
        : profession),
    };
    const game = activeGame();
    const { bridge } = createMockBridge(ok({ ...noRunBootstrap(catalogueWithoutWage), lifecycle: "ACTIVE", activeState: game }));
    const user = userEvent.setup();
    renderWithBridge(bridge);

    await screen.findByRole("heading", { name: "第五纪1349年6月28日" });
    const workButton = screen.getByRole("button", { name: /^工作/ });
    expect(within(workButton).getByText("工资暂未提供")).toBeTruthy();
    await user.click(workButton);
    expect(bridge.submitIntent).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the active profession is absent from the public directory", async () => {
    const catalogue = makeCatalogue();
    const game: PublicGameState = {
      ...activeGame(),
      character: { ...activeGame().character, profession: { ...activeGame().character.profession, id: "profession-missing" } },
    };
    const { bridge } = createMockBridge(ok({ ...noRunBootstrap(catalogue), lifecycle: "ACTIVE", activeState: game }));
    renderWithBridge(bridge);

    await screen.findByRole("heading", { name: "第五纪1349年6月28日" });
    expect(screen.getByText("工资暂未提供")).toBeTruthy();
  });

  it("shows the fifth-step opening summary and keeps the sixth step for final creation only", async () => {
    const { bridge } = createMockBridge();
    const user = userEvent.setup();
    renderWithBridge(bridge);
    await completeIdentityAndOrigin(user);
    await user.click(screen.getByRole("button", { name: /工厂工人/ }));
    await continueCreation(user);
    await user.click(screen.getByRole("button", { name: /谨慎/ }));
    await user.click(screen.getByRole("button", { name: /好奇/ }));
    await user.click(screen.getByRole("button", { name: /容易分心/ }));
    await continueCreation(user);

    const summary = screen.getByRole("region", { name: "开局摘要" });
    expect(within(summary).getByText("外貌")).toBeTruthy();
    expect(within(summary).getByText("黑发，灰眼，衣着整洁。")).toBeTruthy();
    expect(within(summary).getByText("初始资金")).toBeTruthy();
    expect(within(summary).getByText("0 镑 0 苏勒 10 便士")).toBeTruthy();
    expect(within(summary).getByText("每周工资")).toBeTruthy();
    expect(within(summary).getByText("0 镑 6 苏勒 0 便士")).toBeTruthy();
    expect(screen.queryByText(/专精|普通技能/)).toBeNull();

    await continueCreation(user);
    expect(screen.getByRole("heading", { name: "确认出发" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "开始旅程" })).toBeTruthy();
    expectNoForbiddenPlayerTerms();
  });

  it("submits only the public creation choices and the appearance description", async () => {
    const game = activeGame();
    const { bridge, submitIntent } = createMockBridge();
    submitIntent.mockResolvedValue(ok(commitReceipt(game)));
    const user = userEvent.setup();
    renderWithBridge(bridge);

    await completeCreation(user, "  阿黛尔  ");
    expect(await screen.findByRole("heading", { name: "第五纪1349年6月28日" })).toBeTruthy();
    expect(submitIntent).toHaveBeenCalledTimes(1);
    const submitted = submitIntent.mock.calls[0]?.[0] as IntentEnvelope;
    expect(submitted).toMatchObject({
      contractVersion: CONTRACT_VERSION,
      runId: null,
      expectedRevision: 0,
      payload: {
        kind: "CREATE_CHARACTER_RUN",
        selection: {
          displayName: "阿黛尔",
          birthplaceId: "birth-backlund",
          appearanceDescription: "黑发，灰眼，衣着整洁。",
          originId: "origin-street",
          professionId: "profession-factory",
          traitIds: ["trait-careful", "trait-curious"],
          flawId: "flaw-distracted",
          acceptedConditionIds: [],
        },
      },
    });
    const selection = (submitted.payload as { selection: CharacterCreationSelection }).selection;
    expect(selection).not.toHaveProperty("portraitId");
    expect(selection).not.toHaveProperty("specializationId");
    expect(screen.queryByText(/第 \d+ 周/)).toBeNull();
    expectNoForbiddenPlayerTerms();
  });

  it("reuses an uncertain create envelope only for the unchanged selection", async () => {
    const game = activeGame("阿黛尔");
    const { bridge, submitIntent } = createMockBridge();
    submitIntent
      .mockRejectedValueOnce(new Error("response lost"))
      .mockRejectedValueOnce(new Error("response lost again"))
      .mockResolvedValueOnce(ok(commitReceipt(game)));
    const user = userEvent.setup();
    renderWithBridge(bridge);

    await completeCreation(user);
    await screen.findByRole("heading", { name: "还没能出发" });
    await user.click(screen.getByRole("button", { name: "开始旅程" }));
    await screen.findByRole("heading", { name: "还没能出发" });
    expect(submitIntent.mock.calls[1]?.[0]).toEqual(submitIntent.mock.calls[0]?.[0]);

    for (let index = 0; index < 5; index += 1) {
      await user.click(screen.getByRole("button", { name: "上一步" }));
    }
    const renamedInput = screen.getByLabelText("姓名");
    await user.clear(renamedInput);
    await user.type(renamedInput, "伊莎贝拉");
    for (let index = 0; index < 5; index += 1) {
      await continueCreation(user);
    }
    await user.click(screen.getByRole("button", { name: "开始旅程" }));

    expect(submitIntent).toHaveBeenCalledTimes(3);
    const firstIntent = submitIntent.mock.calls[0]?.[0] as IntentEnvelope;
    const renamedIntent = submitIntent.mock.calls[2]?.[0] as IntentEnvelope;
    expect(renamedIntent.intentId).not.toBe(firstIntent.intentId);
    expect((renamedIntent.payload as { selection: CharacterCreationSelection }).selection.displayName).toBe("伊莎贝拉");
  });

  it("maps public create errors without exposing internal details", async () => {
    const { bridge, submitIntent } = createMockBridge();
    submitIntent.mockResolvedValue(errorResult(makePublicError("REVISION_CONFLICT")));
    const user = userEvent.setup();
    renderWithBridge(bridge);
    await completeCreation(user);
    expect(await screen.findByRole("heading", { name: "还没能出发" })).toBeTruthy();
    expect(screen.getByText("记录已经发生变化，请重新打开游戏。")).toBeTruthy();
    expect(screen.queryByText("private detail")).toBeNull();
    expect(screen.queryByText("REVISION_CONFLICT")).toBeNull();
    expectNoForbiddenPlayerTerms();
  });

  it("renders the active public dossier with appearance and the primary date", async () => {
    const game = activeGame();
    const { bridge } = createMockBridge(ok({ ...noRunBootstrap(), lifecycle: "ACTIVE", activeState: game }));
    renderWithBridge(bridge);

    expect(await screen.findByRole("heading", { name: "第五纪1349年6月28日" })).toBeTruthy();
    expect(screen.getByText("黑发，灰眼，衣着整洁。")).toBeTruthy();
    expect(screen.getByText("5 镑 2 苏勒 10 便士")).toBeTruthy();
    for (const label of ["体质", "感知", "意志", "知识", "健康", "精神", "灵性", "污染"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText("扮演进度")).toBeTruthy();
    expect(screen.getByText("未开始")).toBeTruthy();
    expect(screen.queryByText(/第 \d+ 周/)).toBeNull();
    expect(document.querySelectorAll("[data-portrait-slot]")).toHaveLength(0);
    expect(screen.getByRole("heading", { name: "随身物品" })).toBeTruthy();
    expect(screen.getByRole("tabpanel").textContent).toContain("这里还没有可以带在身边的物品。");
    expectNoForbiddenPlayerTerms();
  });

  it("keeps all coin denominations and a negative sign visible", async () => {
    const { bridge } = createMockBridge(ok({ ...noRunBootstrap(), lifecycle: "ACTIVE", activeState: activeGame("负债者", -1) }));
    renderWithBridge(bridge);
    await screen.findByRole("heading", { name: "第五纪1349年6月28日" });
    expect(screen.getByText("-0 镑 0 苏勒 1 便士")).toBeTruthy();
    expectNoForbiddenPlayerTerms();
  });

  it("submits each daily action directly with its known role and hard cost", async () => {
    const initialGame = activeGame();
    const nextGame = activeGame("阿黛尔", 1306, {
      revision: 2,
      availableActions: 2,
      lastAction: actionResult({ action: "WORK", title: "完成工作", summary: "工资已经入账。" }),
    });
    const { bridge, submitIntent } = createMockBridge(ok({ ...noRunBootstrap(), lifecycle: "ACTIVE", activeState: initialGame }));
    submitIntent.mockResolvedValue(ok(commitReceipt(nextGame, "action-intent")));
    const user = userEvent.setup();
    renderWithBridge(bridge);
    await screen.findByRole("heading", { name: "第五纪1349年6月28日" });

    const workButton = screen.getByRole("button", { name: /^工作/ });
    expect(within(workButton).getByText("每次消耗 1 次行动")).toBeTruthy();
    await user.click(workButton);
    expect(submitIntent).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "确认安排" })).toBeNull();
    expect(screen.queryByRole("button", { name: "再想想" })).toBeNull();
    expect(submitIntent.mock.calls[0]?.[0]).toMatchObject({
      contractVersion: CONTRACT_VERSION,
      runId: initialGame.runId,
      expectedRevision: initialGame.revision,
      payload: { kind: "PERFORM_WEEKLY_ACTION", action: "WORK" },
    });
    expect(screen.getByText(/工资：0 镑 6 苏勒 0 便士/)).toBeTruthy();
    expect(within(workButton).getAllByText("工资：0 镑 6 苏勒 0 便士")).toHaveLength(1);
    expectNoForbiddenPlayerTerms();
  });

  it("debounces direct action clicks and reuses an uncertain action envelope", async () => {
    let resolveSubmit: (result: BridgeResult<CommitReceipt>) => void = () => undefined;
    const pendingSubmit = new Promise<BridgeResult<CommitReceipt>>((resolve) => {
      resolveSubmit = resolve;
    });
    const game = activeGame();
    const nextGame = activeGame("阿黛尔", 1234, { revision: 2, availableActions: 2, lastAction: actionResult() });
    const { bridge, submitIntent } = createMockBridge(ok({ ...noRunBootstrap(), lifecycle: "ACTIVE", activeState: game }));
    submitIntent.mockReturnValueOnce(pendingSubmit).mockResolvedValueOnce(ok(commitReceipt(nextGame, "replayed-action")));
    const user = userEvent.setup();
    renderWithBridge(bridge);
    await screen.findByRole("heading", { name: "第五纪1349年6月28日" });

    const investigate = screen.getByRole("button", { name: /^调查/ });
    act(() => {
      fireEvent.click(investigate);
      fireEvent.click(investigate);
    });
    expect(submitIntent).toHaveBeenCalledTimes(1);
    resolveSubmit(errorResult(makePublicError("PERSISTENCE_UNAVAILABLE")));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("行动没有保存成功"));
    await user.click(screen.getByRole("button", { name: /^调查/ }));
    await waitFor(() => expect(submitIntent).toHaveBeenCalledTimes(2));
    expect(submitIntent.mock.calls[1]?.[0]).toEqual(submitIntent.mock.calls[0]?.[0]);
    expectNoForbiddenPlayerTerms();
  });

  it("renders check details, ordered consequences, knowledge, clues and world feedback from the projection", async () => {
    const game = activeGame("记录者", 1234, {
      revision: 2,
      lastAction: actionResult({ resolution: checkResult(), consequences: [
        consequence(),
        consequence({ id: "consequence-cash", target: "CASH", numericValue: 72, summary: "工作报酬已经入账。" }),
      ] }),
      knowledgeRecords: [knowledgeRecord()],
      clues: [clueRecord()],
      worldFeedback: [feedback()],
    });
    const { bridge } = createMockBridge(ok({ ...noRunBootstrap(), lifecycle: "ACTIVE", activeState: game }));
    const user = userEvent.setup();
    renderWithBridge(bridge);

    await screen.findByRole("heading", { name: "第五纪1349年6月28日" });
    await user.click(screen.getByText("查看行动详情"));
    expect(screen.getByRole("region", { name: "判定结果" })).toBeTruthy();
    expect(screen.getByText("判定能力 感知")).toBeTruthy();
    expect(screen.getByText("感知")).toBeTruthy();
    expect(screen.getByText("难度 12")).toBeTruthy();
    expect(screen.getByText("成功率 60%")).toBeTruthy();
    expect(screen.getByText("掷骰 34")).toBeTruthy();
    expect(screen.getByText("成功")).toBeTruthy();
    expect(screen.getByRole("list", { name: "结算后果" })).toBeTruthy();
    expect(screen.getByText("你把一段晦涩的记载整理成了自己的认识。")).toBeTruthy();
    expect(screen.getByText("知识 +2")).toBeTruthy();
    expect(screen.getByText("现金 +0 镑 6 苏勒 0 便士")).toBeTruthy();
    expect(screen.getAllByText("现金 +0 镑 6 苏勒 0 便士")).toHaveLength(1);
    expect(screen.getByRole("region", { name: "知识记录" })).toBeTruthy();
    expect(screen.getByText("钟表匠的暗语")).toBeTruthy();
    expect(screen.getByRole("region", { name: "线索" })).toBeTruthy();
    expect(screen.getByText("没有寄出的信")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "世界反馈" })).toBeNull();
    expect(within(screen.getByRole("article", { name: "世界推演消息" })).getByText("暂无新的公开变化")).toBeTruthy();
    expectNoForbiddenPlayerTerms();
  });

  it("keeps action receipts in the bottom result strip and leaves the world stage for world feedback", async () => {
    const game = activeGame("结果记录者", 1234, {
      lastAction: actionResult({ action: "WORK", title: "工作已经完成", summary: "本周工资已经结算。" }),
      chronicle: [{ id: "chronicle-action", week: 1, date: date(), title: "行动纪事不应占据主舞台", summary: "这只是行动留下的内部记录。" }],
      worldFeedback: [feedback({ id: "feedback-action", kind: "ACTION", title: "行动留下记录", summary: "行动记录不应占据世界推演。" })],
    });
    const { bridge } = createMockBridge(ok({ ...noRunBootstrap(), lifecycle: "ACTIVE", activeState: game }));
    renderWithBridge(bridge);

    await screen.findByRole("heading", { name: "第五纪1349年6月28日" });
    const worldStage = screen.getByRole("article", { name: "世界推演消息" });
    expect(within(worldStage).getByText("暂无新的公开变化")).toBeTruthy();
    expect(within(worldStage).queryByText("行动纪事不应占据主舞台")).toBeNull();
    expect(within(worldStage).queryByText("行动记录不应占据世界推演。")).toBeNull();

    const resultStrip = screen.getByRole("status", { name: "行动结果" });
    expect(within(resultStrip).getByText("工作已经完成")).toBeTruthy();
    expect(within(resultStrip).getByText("本周工资已经结算。")).toBeTruthy();
    expectNoForbiddenPlayerTerms();
  });

  it("keeps a bounded newest-first public world feed without a duplicate feedback panel", async () => {
    const game = activeGame("消息整理者", 1234, {
      worldFeedback: [
        feedback({ id: "feedback-old", kind: "WORLD_PULSE", title: "更早的变化", summary: "更早的公开变化。" }),
        feedback({ id: "feedback-prior", kind: "WORLD_PULSE", title: "稍早的变化", summary: "稍早的公开变化。" }),
        feedback({ id: "feedback-event", kind: "EVENT_RESULT", title: "上一件事", summary: "上一件事的公开结果。" }),
        feedback({ id: "feedback-action", kind: "ACTION", title: "行动留下记录", summary: "行动记录不应出现在世界推演中。" }),
        feedback({ id: "feedback-latest", kind: "WORLD_PULSE", title: "最新变化", summary: "最新的公开变化。" }),
      ],
    });
    const { bridge } = createMockBridge(ok({ ...noRunBootstrap(), lifecycle: "ACTIVE", activeState: game }));
    renderWithBridge(bridge);

    await screen.findByRole("heading", { name: "第五纪1349年6月28日" });
    const worldStage = screen.getByRole("article", { name: "世界推演消息" });
    expect(within(worldStage).getByRole("heading", { name: "最新变化" })).toBeTruthy();
    const recent = within(worldStage).getByRole("list", { name: "此前的公开消息" });
    const recentItems = within(recent).getAllByRole("listitem");
    expect(recentItems).toHaveLength(2);
    expect(recentItems[0]?.textContent).toContain("上一件事");
    expect(recentItems[1]?.textContent).toContain("稍早的变化");
    expect(within(worldStage).queryByText("更早的变化")).toBeNull();
    expect(screen.queryByRole("region", { name: "世界反馈" })).toBeNull();
    expect(screen.queryByText("行动记录不应出现在世界推演中。")).toBeNull();
    expectNoForbiddenPlayerTerms();
  });

  it("prioritizes an active event, shows public choice previews, and blocks daily actions", async () => {
    const game = activeGame("调查者", 1234, { activeEvent: eventCard() });
    const resolvedEvent = eventResolution();
    const resolvedGame = activeGame("调查者", 1234, {
      revision: 2,
      activeEvent: null,
      lastEventResolution: resolvedEvent,
      chronicle: [{ id: "chronicle-event", week: 1, date: date(), title: "门缝里的信", summary: resolvedEvent.summary }],
      worldFeedback: [feedback({ id: "feedback-event", kind: "EVENT_RESULT", title: "门缝里的信", summary: resolvedEvent.summary })],
    });
    const { bridge, submitIntent } = createMockBridge(ok({ ...noRunBootstrap(), lifecycle: "ACTIVE", activeState: game }));
    submitIntent.mockResolvedValue(ok(commitReceipt(resolvedGame, "event-intent")));
    const user = userEvent.setup();
    renderWithBridge(bridge);

    const eventDialog = await screen.findByRole("dialog", { name: "门缝里的信" });
    expect(eventDialog.getAttribute("aria-modal")).toBe("true");
    expect(eventDialog.closest(".event-overlay")).not.toBeNull();
    expect(eventDialog.closest(".stage-panel")).toBeNull();
    await waitFor(() => expect(document.querySelector(".dashboard-surface")?.getAttribute("aria-hidden")).toBe("true"));
    expect(document.querySelector(".dashboard-surface")?.hasAttribute("inert")).toBe(true);
    expect(within(eventDialog).getByText("一封没有署名的信从门缝下滑进来，纸面上留着陌生的印记。")).toBeTruthy();
    expect(within(eventDialog).getByText("难度 14")).toBeTruthy();
    expect(within(eventDialog).getByText("成功率 52%")).toBeTruthy();
    const dashboard = document.querySelector(".dashboard-surface") as HTMLElement;
    const backgroundActions = Array.from(dashboard.querySelectorAll<HTMLButtonElement>(".action-dock .action-button"));
    expect(backgroundActions).toHaveLength(4);
    for (const action of backgroundActions) {
      expect(action.disabled).toBe(true);
    }

    fireEvent.click(document.querySelector(".event-overlay-backdrop") as HTMLElement);
    fireEvent.keyDown(eventDialog, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "门缝里的信" })).toBeTruthy();

    await user.click(within(eventDialog).getByRole("button", { name: /^读完这封信/ }));
    expect(submitIntent).toHaveBeenCalledTimes(1);
    expect(submitIntent.mock.calls[0]?.[0]).toMatchObject({
      runId: game.runId,
      expectedRevision: game.revision,
      payload: { kind: "RESOLVE_EVENT_CHOICE", eventInstanceId: "event-letter", choiceId: "read-letter" },
    });
    expect(await screen.findByRole("article", { name: "世界推演消息" })).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "门缝里的信" })).toBeNull();
    expect(document.querySelector(".dashboard-surface")?.hasAttribute("inert")).toBe(false);
    expect(within(screen.getByRole("region", { name: "行动台" })).getByText("还可安排 3 次")).toBeTruthy();
    expect(within(screen.getByRole("article", { name: "世界推演消息" })).getByText("门缝里的信")).toBeTruthy();
    expect(within(screen.getByRole("article", { name: "世界推演消息" })).getByText("你从字缝里辨出了一个可以追查的地址。")).toBeTruthy();
    expect(within(screen.getByRole("article", { name: "世界推演消息" })).getByText("事件后续")).toBeTruthy();
    expectNoForbiddenPlayerTerms();
  });

  it("renders a minimal pending-event list without adding another action system", async () => {
    const game = activeGame("留意者", 1234, { pendingEvents: [pendingEvent()] });
    const { bridge } = createMockBridge(ok({ ...noRunBootstrap(), lifecycle: "ACTIVE", activeState: game }));
    renderWithBridge(bridge);

    await screen.findByRole("heading", { name: "第五纪1349年6月28日" });
    const pending = screen.getByRole("region", { name: "待处理事项" });
    expect(within(pending).getByText("楼梯口的脚步声")).toBeTruthy();
    expect(within(pending).getByText("到期：第五纪1349年6月30日")).toBeTruthy();
    expect(within(pending).queryByRole("button")).toBeNull();
    expect(screen.getAllByRole("button", { name: /^工作|^学习|^调查|^休养/ })).toHaveLength(4);
    expectNoForbiddenPlayerTerms();
  });

  it("keeps the creation and dashboard regions present at all required viewport sizes", async () => {
    const { bridge } = createMockBridge();
    renderWithBridge(bridge);
    await screen.findByRole("heading", { name: "从哪一个名字开始？" });

    for (const [width, height] of [[1280, 720], [1366, 768], [1600, 900]]) {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
      Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
      expect(document.querySelectorAll(".creation-flow > .creation-step-nav")).toHaveLength(1);
      expect(document.querySelectorAll(".creation-flow > .creation-choice-panel")).toHaveLength(1);
      expect(document.querySelectorAll(".creation-flow > .creation-detail-panel")).toHaveLength(1);
      expect(document.querySelectorAll(".creation-flow > .creation-nav")).toHaveLength(1);
      const measurement = measurePageOverflow();
      if (measurement.status === "NOT_PROVABLE_IN_JSDOM") {
        expect(measurement.reason).toContain("jsdom");
      } else {
        expect(measurement.horizontal).toBe(false);
        expect(measurement.vertical).toBe(false);
      }
    }

    cleanup();
    renderWithBridge(createMockBridge(ok({ ...noRunBootstrap(), lifecycle: "ACTIVE", activeState: activeGame() })).bridge);
    await screen.findByRole("heading", { name: "第五纪1349年6月28日" });
    for (const [width, height] of [[1280, 720], [1366, 768], [1600, 900]]) {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
      Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
      expect(document.querySelectorAll(".weekly-workbench > .dossier-panel")).toHaveLength(1);
      expect(document.querySelectorAll(".weekly-workbench > .stage-panel")).toHaveLength(1);
      expect(document.querySelectorAll(".weekly-workbench > .inventory-panel")).toHaveLength(1);
      expect(document.querySelectorAll(".action-dock .action-button")).toHaveLength(4);
      expect(document.querySelectorAll(".stage-support-grid > .record-panel")).toHaveLength(3);
      const dossier = document.querySelector(".dossier-panel");
      expect(dossier).not.toBeNull();
      expect(dossier?.getAttribute("aria-hidden")).toBeNull();
      expect(dossier?.querySelectorAll(".core-stat")).toHaveLength(4);
      expect(dossier?.querySelectorAll(".resource-row")).toHaveLength(4);
      expect(dossier?.textContent).toContain("四项核心能力");
      expect(dossier?.textContent).toContain("当前状态");
    }
  });

  it("keeps physical layout proof honest when jsdom cannot measure it", () => {
    const measurement = measurePageOverflow();
    expect(measurement.status).toBe("NOT_PROVABLE_IN_JSDOM");
    if (measurement.status === "NOT_PROVABLE_IN_JSDOM") {
      expect(measurement.reason).toContain("jsdom");
    }
  });

  it("keeps renderer code on the public bridge boundary", () => {
    expect(appSource).not.toMatch(/from ["']node:/);
    expect(appSource).not.toContain("SQLite");
    expect(appSource).not.toContain("localStorage");
    expect(appSource).not.toContain("Math.random");
    expect(appSource).not.toContain("innerHTML");
  });

  it("keeps the preload bridge first and has a browser bridge install path", () => {
    expect(rendererMainSource).toContain("createSliceBrowserBridge");
    expect(rendererMainSource).toContain('import("../simulation/slice-browser-bridge.js")');
    expect(rendererMainSource).toContain("if (window.sliceGame) return window.sliceGame");
    expect(rendererMainSource).toContain('navigator.userAgent.includes("Electron/")');
    expect(rendererMainSource).not.toContain("localStorage");
  });

  it("keeps keyboard users able to move through creation", async () => {
    const { bridge } = createMockBridge();
    const user = userEvent.setup();
    renderWithBridge(bridge);

    const nameInput = await screen.findByLabelText("姓名");
    await user.tab();
    expect(document.activeElement).toBe(nameInput);
    await user.type(nameInput, "键盘用户");
    await user.selectOptions(screen.getByLabelText("性别"), "FEMALE");
    await user.type(screen.getByLabelText("年龄"), "28");
    await user.selectOptions(screen.getByLabelText("出生地"), "birth-backlund");
    await user.type(screen.getByLabelText("外貌描述"), "黑发，灰眼。");
    const nextButton = screen.getByRole("button", { name: "继续" });
    nextButton.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("heading", { name: "什么样的日子养大了你？" })).toBeTruthy();
    expectNoForbiddenPlayerTerms();
  });

  it("keeps the bridge error state explicit", async () => {
    const { bridge } = createMockBridge(errorResult(makePublicError("PERSISTENCE_UNAVAILABLE")));
    renderWithBridge(bridge);
    expect(await screen.findByRole("heading", { name: "记录暂时无法打开" })).toBeTruthy();
    expect(screen.getByText("可以稍后再次打开游戏。")).toBeTruthy();
    expect(screen.queryByText("private detail")).toBeNull();
    expectNoForbiddenPlayerTerms();
  });
});
