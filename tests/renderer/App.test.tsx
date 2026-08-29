/* @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  type CommitReceipt,
  type IntentEnvelope,
  type MysteryGameBridge,
  type PublicError,
  type PublicGameState,
} from "@shared/contracts";

const ok = <T,>(value: T): BridgeResult<T> => ({ ok: true, value });

const errorResult = (error: PublicError): BridgeResult<never> => ({ ok: false, error });

function noRunBootstrap(): BootstrapProjection {
  return {
    appVersion: "0.1.0",
    contractVersion: CONTRACT_VERSION,
    storageSchemaVersion: STORAGE_SCHEMA_VERSION,
    storageStatus: "READY",
    lifecycle: "NO_RUN",
    runs: [],
    activeState: null,
  };
}

function activeGame(displayName = "阿黛尔"): PublicGameState {
  return {
    contractVersion: CONTRACT_VERSION,
    ruleVersion: RULE_VERSION,
    contentVersion: CONTENT_VERSION,
    runId: "run-r1-fixture",
    lifecycle: "ACTIVE",
    revision: 1,
    week: 1,
    availableActions: 3,
    cashPence: 1234,
    character: {
      displayName,
      origin: "LOEN",
      sequence: "ORDINARY",
      coreStats: {
        physique: 15,
        perception: 15,
        will: 15,
        knowledge: 15,
      },
      resources: {
        health: { current: 100, max: 100 },
        mind: { current: 100, max: 100 },
        spirituality: { current: 15, max: 15 },
        pollution: 0,
      },
    },
    chronicle: [
      {
        id: "chronicle-1",
        week: 1,
        title: "抵达贝克兰德",
        summary: "雾中的第一周已经开始。",
      },
    ],
    stateChecksum: "a".repeat(64),
  };
}

function commitReceipt(game: PublicGameState): CommitReceipt {
  return {
    intentId: "intent-r1-fixture",
    runId: game.runId,
    previousRevision: 0,
    newRevision: 1,
    stateChecksum: game.stateChecksum,
    committedAt: "2026-08-29T00:00:00.000Z",
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

describe("R1 renderer shell", () => {
  beforeEach(() => {
    delete window.mysteryGame;
  });

  afterEach(() => {
    cleanup();
    delete window.mysteryGame;
    vi.clearAllMocks();
  });

  it("shows the loading state while bootstrap is pending", async () => {
    let resolveBootstrap: (result: BridgeResult<BootstrapProjection>) => void = () => undefined;
    const pendingBootstrap = new Promise<BridgeResult<BootstrapProjection>>((resolve) => {
      resolveBootstrap = resolve;
    });
    const { bridge, getBootstrap } = createMockBridge();
    getBootstrap.mockReturnValue(pendingBootstrap);

    renderWithBridge(bridge);

    expect(screen.getByRole("status").textContent).toContain("正在翻开卷宗");

    resolveBootstrap(ok(noRunBootstrap()));
    expect(await screen.findByRole("heading", { name: "在雾都写下你的名字" })).toBeTruthy();
  });

  it("fails closed when the production bridge is missing", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { name: "卷宗暂时无法打开" })).toBeTruthy();
    expect(screen.getByText("请重新启动游戏后再试。")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/window\.mysteryGame|mock|bridge|R1|fixture/i);
    expect(screen.queryByRole("button", { name: "开始新的旅程" })).toBeNull();
  });

  it("renders the no-run state with immediate name validation and only the create action", async () => {
    const { bridge } = createMockBridge();
    const user = userEvent.setup();
    renderWithBridge(bridge);

    expect(await screen.findByRole("heading", { name: "在雾都写下你的名字" })).toBeTruthy();
    const input = screen.getByLabelText("姓名");
    const createButton = screen.getByRole("button", { name: "开始新的旅程" });

    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect((createButton as HTMLButtonElement).disabled).toBe(true);

    await user.type(input, "阿黛尔");

    expect(input.getAttribute("aria-invalid")).toBe("false");
    expect((createButton as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole("button", { name: /^工作/ })).toBeNull();
  });

  it("enforces the 80 UTF-16 code unit display-name boundary", async () => {
    const { bridge } = createMockBridge();
    const user = userEvent.setup();
    renderWithBridge(bridge);

    const input = (await screen.findByLabelText("姓名")) as HTMLInputElement;
    const createButton = screen.getByRole("button", { name: "开始新的旅程" });
    expect(input.maxLength).toBe(80);

    const exactlyEightyUnits = "😀".repeat(40);
    fireEvent.change(input, { target: { value: exactlyEightyUnits } });
    expect(input.getAttribute("aria-invalid")).toBe("false");
    expect((createButton as HTMLButtonElement).disabled).toBe(false);

    fireEvent.change(input, { target: { value: `${exactlyEightyUnits}a` } });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect((createButton as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("名字不能超过 80 个字。")).toBeTruthy();
    await user.clear(input);
  });

  it("shows a creating state while the fixture intent is in flight", async () => {
    let resolveSubmit: (result: BridgeResult<CommitReceipt>) => void = () => undefined;
    const pendingSubmit = new Promise<BridgeResult<CommitReceipt>>((resolve) => {
      resolveSubmit = resolve;
    });
    const { bridge, submitIntent } = createMockBridge();
    submitIntent.mockReturnValue(pendingSubmit);
    const user = userEvent.setup();
    renderWithBridge(bridge);

    const input = await screen.findByLabelText("姓名");
    await user.type(input, "阿黛尔");
    await user.click(screen.getByRole("button", { name: "开始新的旅程" }));

    expect(screen.getByRole("status").textContent).toContain("正在整理行装");
    expect(submitIntent).toHaveBeenCalledTimes(1);

    resolveSubmit(
      errorResult({
        code: "PERSISTENCE_UNAVAILABLE",
        message: "测试中的存储不可用。",
        retryable: true,
      }),
    );
    expect(await screen.findByRole("heading", { name: "旅程未能开始" })).toBeTruthy();
  });

  it("reuses the uncertain fixture envelope for a same-name retry", async () => {
    const game = activeGame("阿黛尔");
    const { bridge, submitIntent } = createMockBridge();
    submitIntent
      .mockRejectedValueOnce(new Error("IPC response lost"))
      .mockResolvedValueOnce(ok(commitReceipt(game)));
    const user = userEvent.setup();
    renderWithBridge(bridge);

    const input = await screen.findByLabelText("姓名");
    await user.type(input, "阿黛尔");
    await user.click(screen.getByRole("button", { name: "开始新的旅程" }));
    await screen.findByRole("heading", { name: "旅程未能开始" });

    await user.click(screen.getByRole("button", { name: "重试创建" }));
    expect(await screen.findByRole("heading", { name: "第 1 周" })).toBeTruthy();
    expect(submitIntent).toHaveBeenCalledTimes(2);

    const firstIntent = submitIntent.mock.calls[0]?.[0];
    const retryIntent = submitIntent.mock.calls[1]?.[0];
    expect(retryIntent).toEqual(firstIntent);
  });

  it("creates a new fixture envelope after the display name changes", async () => {
    const { bridge, submitIntent } = createMockBridge();
    submitIntent
      .mockRejectedValueOnce(new Error("IPC response lost"))
      .mockResolvedValueOnce(
        errorResult({
          code: "PERSISTENCE_UNAVAILABLE",
          message: "重试时存储仍不可用。",
          retryable: true,
        }),
      );
    const user = userEvent.setup();
    renderWithBridge(bridge);

    const input = await screen.findByLabelText("姓名");
    await user.type(input, "阿黛尔");
    await user.click(screen.getByRole("button", { name: "开始新的旅程" }));
    await screen.findByRole("heading", { name: "旅程未能开始" });

    const retryInput = screen.getByLabelText("姓名");
    fireEvent.change(retryInput, { target: { value: "伊莎贝拉" } });
    expect((retryInput as HTMLInputElement).value).toBe("伊莎贝拉");
    await user.click(screen.getByRole("button", { name: "重试创建" }));
    expect(await screen.findByText("请确认名字后再次尝试。")).toBeTruthy();
    expect(submitIntent).toHaveBeenCalledTimes(2);

    const firstIntent = submitIntent.mock.calls[0]?.[0];
    const renamedIntent = submitIntent.mock.calls[1]?.[0];
    expect(renamedIntent?.intentId).not.toBe(firstIntent?.intentId);
    expect(renamedIntent?.payload.displayName).toBe("伊莎贝拉");
  });

  it("surfaces a public create error without exposing internal details", async () => {
    const { bridge, submitIntent } = createMockBridge();
    submitIntent.mockResolvedValue(
      errorResult({
        code: "REVISION_CONFLICT",
        message: "公开状态已变化，请重新读取。",
        retryable: true,
        currentRevision: 1,
      }),
    );
    const user = userEvent.setup();
    renderWithBridge(bridge);

    const input = await screen.findByLabelText("姓名");
    await user.type(input, "阿黛尔");
    await user.click(screen.getByRole("button", { name: "开始新的旅程" }));

    expect(await screen.findByRole("heading", { name: "旅程未能开始" })).toBeTruthy();
    expect(screen.queryByText("REVISION_CONFLICT")).toBeNull();
    expect(screen.queryByText("公开状态已变化，请重新读取。")).toBeNull();
    expect(screen.getByText("请确认名字后再次尝试。")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).not.toMatch(/SQL|堆栈|stack/i);
  });

  it("submits the exact R1 fixture envelope and renders the returned public state", async () => {
    const game = activeGame("阿黛尔");
    const { bridge, submitIntent } = createMockBridge();
    submitIntent.mockResolvedValue(ok(commitReceipt(game)));
    const user = userEvent.setup();
    renderWithBridge(bridge);

    const input = await screen.findByLabelText("姓名");
    await user.type(input, "阿黛尔");
    await user.click(screen.getByRole("button", { name: "开始新的旅程" }));

    expect(await screen.findByRole("heading", { name: "第 1 周" })).toBeTruthy();
    expect(submitIntent).toHaveBeenCalledTimes(1);

    const submitted = submitIntent.mock.calls[0]?.[0] as IntentEnvelope;
    expect(submitted).toMatchObject({
      contractVersion: "r1-v1",
      runId: null,
      expectedRevision: 0,
      payload: {
        kind: "CREATE_R1_FIXTURE_RUN",
        fixtureId: "ordinary-week-one",
        displayName: "阿黛尔",
      },
    });
    expect(submitted.intentId).toEqual(expect.any(String));
    expect(screen.getByText("1,234 便士")).toBeTruthy();
    expect(screen.getByText("抵达贝克兰德")).toBeTruthy();
  });

  it("renders an active public projection and keeps all later-round entrances inert", async () => {
    const game = activeGame();
    const { bridge } = createMockBridge(
      ok({
        appVersion: "0.1.0",
        contractVersion: CONTRACT_VERSION,
        storageSchemaVersion: STORAGE_SCHEMA_VERSION,
        storageStatus: "READY",
        lifecycle: "ACTIVE",
        runs: [
          {
            runId: game.runId,
            lifecycle: "ACTIVE",
            displayName: game.character.displayName,
            week: game.week,
            revision: game.revision,
            updatedAt: "2026-08-29T00:00:00.000Z",
          },
        ],
        activeState: game,
      }),
    );

    renderWithBridge(bridge);

    expect(await screen.findByRole("heading", { name: "第 1 周" })).toBeTruthy();
    expect(screen.getByText("普通人")).toBeTruthy();
    expect(screen.getByText("鲁恩")).toBeTruthy();
    expect(screen.getByText("体魄")).toBeTruthy();
    expect(screen.getByText("感知")).toBeTruthy();
    expect(screen.getByText("意志")).toBeTruthy();
    expect(screen.getByText("知识")).toBeTruthy();
    expect(screen.getByText("健康")).toBeTruthy();
    expect(screen.getByText("精神")).toBeTruthy();
    expect(screen.getByText("灵性")).toBeTruthy();
    expect(screen.getAllByText("污染")).toHaveLength(2);
    expect(screen.getByText("1,234 便士")).toBeTruthy();
    expect(screen.getByText("抵达贝克兰德")).toBeTruthy();

    for (const label of ["工作", "学习", "调查", "休养"]) {
      const actionButton = screen.getByRole("button", { name: new RegExp(`^${label}`) });
      expect((actionButton as HTMLButtonElement).disabled).toBe(true);
    }

    for (const label of ["黑市", "季度拍卖", "事件", "战斗"]) {
      expect(screen.getByRole("heading", { name: label })).toBeTruthy();
    }
    expect(screen.getAllByText("尚未解锁")).toHaveLength(8);
    expect(document.body.textContent).not.toMatch(/R1|fixture|工程|公开投影|公开状态|Main|SQLite|bridge|回执|后续轮次|READ ONLY/i);
  });

  it("debounces duplicate clicks before the first receipt returns", async () => {
    let resolveSubmit: (result: BridgeResult<CommitReceipt>) => void = () => undefined;
    const pendingSubmit = new Promise<BridgeResult<CommitReceipt>>((resolve) => {
      resolveSubmit = resolve;
    });
    const { bridge, submitIntent } = createMockBridge();
    submitIntent.mockReturnValue(pendingSubmit);
    const user = userEvent.setup();
    renderWithBridge(bridge);

    const input = await screen.findByLabelText("姓名");
    await user.type(input, "阿黛尔");
    const createButton = screen.getByRole("button", { name: "开始新的旅程" });

    act(() => {
      fireEvent.click(createButton);
      fireEvent.click(createButton);
    });

    expect(submitIntent).toHaveBeenCalledTimes(1);

    resolveSubmit(
      errorResult({
        code: "PERSISTENCE_UNAVAILABLE",
        message: "测试中的存储不可用。",
        retryable: true,
      }),
    );
    await waitFor(() => expect(screen.getByRole("heading", { name: "旅程未能开始" })).toBeTruthy());
  });

  it("allows keyboard users to focus and submit the create form", async () => {
    const game = activeGame("键盘用户");
    const { bridge, submitIntent } = createMockBridge();
    submitIntent.mockResolvedValue(ok(commitReceipt(game)));
    const user = userEvent.setup();
    renderWithBridge(bridge);

    const input = await screen.findByLabelText("姓名");
    await user.tab();
    expect(document.activeElement).toBe(input);
    await user.type(input, "键盘用户");
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("heading", { name: "第 1 周" })).toBeTruthy();
    expect(submitIntent).toHaveBeenCalledTimes(1);
  });

  it("maps a bootstrap public error to the explicit unavailable state", async () => {
    const { bridge } = createMockBridge(
      errorResult({
        code: "PERSISTENCE_UNAVAILABLE",
        message: "无法打开本地存储。",
        retryable: true,
      }),
    );

    renderWithBridge(bridge);

    expect(await screen.findByRole("heading", { name: "卷宗暂时无法打开" })).toBeTruthy();
    expect(screen.queryByText("PERSISTENCE_UNAVAILABLE")).toBeNull();
    expect(screen.queryByText("无法打开本地存储。")).toBeNull();
    expect(screen.getByText("你可以稍后再次打开游戏。")).toBeTruthy();
  });
});
