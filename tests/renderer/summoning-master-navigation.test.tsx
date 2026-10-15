/* @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SliceApp } from "../../src/renderer/SliceApp";
import { applySliceIntent, projectSliceState } from "../../src/domain/slice";
import { migrateSliceState } from "../../src/domain/slice/migration";
import type { SliceIntent, SliceState } from "../../src/domain/slice/types";
import type { SummoningMasterCommand } from "../../src/domain/summoning-master/types";
import type { SliceBridge } from "../../src/shared/slice-contracts";

interface NaturalCapture {
  prefixCount: number; commands: SliceIntent[]; departureStart: unknown; guidanceStart: unknown;
  promoted: unknown; practiced: unknown; combatStart: unknown; final: unknown;
}
interface Boundary { beforeLast: unknown; lastIntent: SliceIntent; final: unknown }
// These are actual public-command captures. Never edit resources, consent, RNG, original people or objects.
const original = (): { commands: SliceIntent[]; final: unknown } => JSON.parse(readFileSync("tests/fixtures/witch-king-v01210/natural.json", "utf8"));
const natural = (): NaturalCapture => JSON.parse(readFileSync("tests/fixtures/summoning-master-v01440/natural.json", "utf8"));
function boundary(name: string): Boundary {
  const entries = JSON.parse(readFileSync("tests/fixtures/summoning-master-v01440/boundaries.json", "utf8")) as Record<string, Boundary>;
  if (!entries[name]) throw new Error(`Missing real Summoning Master boundary: ${name}`);
  return entries[name];
}
function savedGame(state: unknown, failFirstSave = false) {
  let current = migrateSliceState(state), attempts = 0;
  const submit: SliceBridge["submitIntent"] = vi.fn(async envelope => {
    if (envelope.payload.type === "CREATE") throw new Error("This original run already exists.");
    if (failFirstSave && attempts++ === 0) return { ok: false as const, error: { code: "SAVE_FAILED", message: "本次原操作尚未保存", retryable: true } };
    current = applySliceIntent(current, envelope.payload);
    return { ok: true as const, value: { intentId: envelope.intentId, runId: current.runId,
      previousRevision: envelope.expectedRevision, newRevision: current.revision,
      committedAt: "2026-10-13T08:00:00Z", replayed: false, state: projectSliceState(current) } };
  });
  return { get state() { return current; }, submit };
}
type SavedGame = ReturnType<typeof savedGame>;
const LEGACY_STAGES = ["apothecary", "tamer", "vampire", "potionProfessor", "crimsonScholar"] as const;
function expectLegacyPreserved(state: SliceState, before: SliceState) {
  for (const key of LEGACY_STAGES) expect(state[key]).toEqual(before[key]);
  const old = structuredClone(before.witchKing), now = structuredClone(state.witchKing);
  expect(now.life.papers).toHaveLength(old.life.papers.length);
  for (const paper of now.life.papers) {
    const prior = old.life.papers.find(entry => entry.id === paper.id)!;
    expect(prior).toBeTruthy();
    if (paper.status !== prior.status) {
      expect(prior.status).toBe("PREPARED"); expect(paper.status).toBe("CONSUMED");
      expect(paper.consumedBy).toBe("COMBAT"); expect(paper.consumedWeek).toBe(before.week);
      expect(paper.combatRound).toBeGreaterThan(0);
      // Only the actually used original paper may change these consumption fields.
      for (const key of ["status", "consumedWeek", "consumedBy", "combatRound"] as const) Object.assign(paper, { [key]: prior[key] });
    }
  }
  expect(now).toEqual(old);
  expect(state.summoningMaster.life.partner.id).toBe("SM3-LUMEN");
  expect(state.summoningMaster.life.partner.bodyId).toBe("SM3-LUMEN-BODY");
  expect(state.summoningMaster.life.partner.chime).toEqual({ id: "SM3-CHIME", owner: "SM3-LUMEN" });
  expect(state.runId).toBe(before.runId); expect(state.random.seed).toBe(before.random.seed);
  expect(state.character.gender).toBe(before.character.gender);
}
async function acknowledgeSavedRound() {
  const reveal = screen.queryByRole("dialog", { name: "战斗回合结果" });
  if (reveal) await userEvent.click(within(reveal).getByRole("button", { name: /^(返回生活|进入下一回合|查看收尾卷宗)$/ }));
}
async function mountGame(game: SavedGame) {
  const state = projectSliceState(game.state);
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge["getBootstrap"]>(async () => ({ ok: true, value: { mode: "browser", activeState: state, runs: [{
      runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
      week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: "2026-10-13T07:59:00Z",
    }] } })),
    loadRun: vi.fn<SliceBridge["loadRun"]>(async () => ({ ok: true, value: projectSliceState(game.state) })), submitIntent: game.submit,
  };
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: state.status === "DEAD" ? /查看封存/ : /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(screen.queryByRole("heading", { name: "人物卷宗" })
    ?? screen.queryByRole("region", { name: "召唤大师" })
    ?? screen.queryByRole("dialog", { name: "战斗回合结果" })
    ?? (state.combat ? screen.queryByRole("dialog", { name: state.combat.title ?? "普通人追击" }) : null)
    ?? (state.ending ? screen.queryByRole("heading", { name: state.ending.title }) : null)).toBeTruthy());
  // Previous battles remain in the save. Acknowledge their real outcomes through the UI instead of erasing them.
  await acknowledgeSavedRound();
  if (state.ending) await screen.findByRole("heading", { name: state.ending.title });
  else if (state.combat) await screen.findByRole("dialog", { name: state.combat.title ?? "普通人追击" });
  else if (state.summoningMaster.insideCase) await screen.findByRole("region", { name: "召唤大师" });
  else {
    await screen.findByRole("heading", { name: "人物卷宗" });
    await userEvent.click(screen.getByRole("button", { name: "召唤大师与同一真实来客" }));
    await screen.findByRole("region", { name: "召唤大师" });
  }
}
function actionButton(state: SliceState, command: SummoningMasterCommand) {
  const entry = projectSliceState(state).summoningMaster.actions.find(item => JSON.stringify(item.command) === JSON.stringify(command));
  if (!entry) throw new Error(`No actual public Summoning Master action: ${JSON.stringify(command)}`);
  return screen.getByRole("button", { name: name => name.startsWith(entry.label) }) as HTMLButtonElement;
}
async function settled() {
  await waitFor(() => expect(screen.getByRole("region", { name: "召唤大师" }).getAttribute("aria-busy")).toBe("false"));
}
async function submitCapturedRound(game: SavedGame, intent: SliceIntent) {
  if (intent.type !== "COMBAT_ROUND") throw new Error("The actual captured intent must be a combat round.");
  const battle = projectSliceState(game.state).combat!;
  const stage = screen.getByRole("dialog", { name: battle.title ?? "普通人追击" });
  const stance = battle.stances.find(item => item.id === intent.stance)!;
  await userEvent.click(within(stage).getByRole("button", { name: name => name.startsWith(stance.label) }));
  await userEvent.click(within(stage).getByRole("button", { name: "确认姿态，结算完整回合" }));
  return screen.findByRole("dialog", { name: "战斗回合结果" });
}
beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe("Summoning Master navigation from preserved real Witch King captures", () => {
  it("opens and closes after the exact349-command prefix while preserving injured Dorian and every original paper", async () => {
    const old = original(), capture = natural(), game = savedGame(old.final), before = structuredClone(game.state);
    expect(old.commands).toHaveLength(349); expect(capture.prefixCount).toBe(349);
    expect(capture.commands).toHaveLength(444); expect(capture.commands.slice(0, capture.prefixCount)).toEqual(old.commands);
    expect(migrateSliceState(capture.departureStart)).toEqual(before);
    expect(before).toMatchObject({ week: 92, health: 100, mind: 100, spirituality: 102, cash: 664, actionsRemaining: 3, character: { gender: "FEMALE" }, progression: { sequence: 4, acting: 100 } });
    expect(before.witchKing.promotionWeek).toBe(83);
    expect(before.witchKing.encounter.enemy).toMatchObject({ id: "WK4-DORIAN", health: 70, status: "SURRENDERED", weaponLocation: "YARD" });
    expect(before.witchKing.life.papers.map(paper => [paper.id, paper.status])).toEqual([["WK4-PAPER-1-1", "CONSUMED"], ["WK4-PAPER-1-2", "PREPARED"], ["WK4-PAPER-1-3", "HELD"]]);
    await mountGame(game);
    const target = screen.getByRole("region", { name: "召唤大师当前目标" });
    expect(target.textContent).toContain("巫王需消化100"); expect(target.textContent).toContain("9/12");
    expect(target.textContent).toContain("召唤大师为月亮序列3。本阶段仅使用一位真实来客、有限门与有限协作；完整配方与晋升仪式细节尚未掌握。");
    const summary = screen.getByText("原身体、旧多里安与月亮原纸", { selector: "summary" });
    expect(summary.closest("details")!.open).toBe(false); await userEvent.click(summary);
    const history = screen.getByRole("region", { name: "召唤大师继承记录" });
    expect(history.textContent).toContain("第83周真实晋升"); expect(history.textContent).toContain("WK4-DORIAN-CLUB");
    expect(history.textContent).toContain("健康70/100"); expect(history.textContent).toContain("已投降，原伤势保留");
    expect(history.textContent).toContain("WK4-PAPER-1-1"); expect(history.textContent).toContain("已明确准备，未耗尽");
    expect(history.textContent).toContain("已经破损，不重置"); expect(within(history).queryByRole("button")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭召唤大师页面" }));
    expect(screen.getByRole("heading", { name: "人物卷宗" })).toBeTruthy();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 15_000);

  it("retries the exact guidance envelope after save failure without charging500 or one action twice", async () => {
    const captured = boundary("guidance"), game = savedGame(captured.beforeLast, true), before = structuredClone(game.state);
    expect(captured.lastIntent).toEqual({ type: "SUMMONING_MASTER", command: { type: "LEARN_GUIDANCE" } });
    expect(migrateSliceState(natural().guidanceStart)).toEqual(before);
    await mountGame(game); await userEvent.click(actionButton(game.state, { type: "LEARN_GUIDANCE" }));
    await screen.findByRole("alert"); expect(game.state).toEqual(before); expect(game.submit).toHaveBeenCalledTimes(1);
    expect(actionButton(game.state, { type: "LEARN_GUIDANCE" }).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "关闭召唤大师页面" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "返回主菜单" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" })); await settled();
    const calls = vi.mocked(game.submit).mock.calls;
    expect(calls).toHaveLength(2); expect(calls[1]![0]).toEqual(calls[0]![0]); expect(calls[0]![0].payload).toEqual(captured.lastIntent);
    expect(game.state).toEqual(migrateSliceState(captured.final)); expect(game.state.cash).toBe(before.cash - 500);
    expect(game.state.actionsRemaining).toBe(before.actionsRemaining - 1);
    expect(game.state.summoningMaster).toMatchObject({ guidanceKnown: true, preparations: [], preparedWeek: null });
    expect(game.state.witchKing).toEqual(before.witchKing); expectLegacyPreserved(game.state, before);
    expect(screen.getByRole("button", { name: "关闭召唤大师页面" })).toBeTruthy();
  }, 15_000);

  it("records the fifth real job against only its original bottle before any handover", async () => {
    const captured = boundary("potion-work-5"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    if (captured.lastIntent.type !== "SUMMONING_MASTER" || captured.lastIntent.command.type !== "POTION_WORK") throw new Error("Expected the real fifth bottle job.");
    const command = captured.lastIntent.command, bottle = before.summoningMaster.bottles.find(entry => entry.id === command.bottleId)!;
    expect(bottle).toMatchObject({ labourSteps: 4, status: "SUPPLIER" });
    await mountGame(game); await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立召唤大师原瓶" }), command.bottleId);
    await userEvent.click(actionButton(game.state, command)); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(game.state.summoningMaster.bottles.find(entry => entry.id === command.bottleId)).toMatchObject({ labourSteps: 5, status: "SUPPLIER", acquiredWeek: null });
    expect(game.state.summoningMaster.bottles.filter(entry => entry.id !== command.bottleId)).toEqual(before.summoningMaster.bottles.filter(entry => entry.id !== command.bottleId));
    expect(game.state.summoningMaster.preparations).toEqual(before.summoningMaster.preparations);
    expect(game.state.summoningMaster.life).toEqual(before.summoningMaster.life); expectLegacyPreserved(game.state, before);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
  }, 15_000);

  it("receives the independently worked original800p bottle without drinking or granting preparation", async () => {
    const captured = boundary("buy-independent-potion"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    if (captured.lastIntent.type !== "SUMMONING_MASTER" || captured.lastIntent.command.type !== "BUY_POTION") throw new Error("Expected the real bottle handover.");
    const command = captured.lastIntent.command;
    await mountGame(game); await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立召唤大师原瓶" }), command.bottleId);
    await userEvent.click(actionButton(game.state, command)); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(game.state.cash).toBe(before.cash - 800); expect(game.state.actionsRemaining).toBe(before.actionsRemaining);
    expect(game.state.summoningMaster.bottles.find(bottle => bottle.id === command.bottleId)).toMatchObject({ status: "PLAYER", labourSteps: 5, consumedWeek: null, outcome: null });
    expect(game.state.progression.sequence).toBe(4); expect(game.state.summoningMaster.preparedWeek).toBeNull();
    expect(game.state.summoningMaster.preparations).toEqual(before.summoningMaster.preparations);
    expect(screen.queryByRole("region", { name: "召唤大师原瓶服用确认" })).toBeNull();
    expect(game.state.witchKing).toEqual(before.witchKing); expectLegacyPreserved(game.state, before);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
  }, 15_000);

  it("saves the actual current-week120p preparation and retains its zero-action physical exit", async () => {
    const captured = boundary("prepare-current-week"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    expect(captured.lastIntent).toEqual({ type: "SUMMONING_MASTER", command: { type: "PREPARE_PROMOTION" } });
    await mountGame(game); await userEvent.click(actionButton(game.state, { type: "PREPARE_PROMOTION" })); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect([game.state.cash, game.state.actionsRemaining, game.state.week]).toEqual([before.cash - 120, before.actionsRemaining - 1, before.week]);
    expect(game.state.summoningMaster.preparedWeek).toBe(before.week);
    expect(screen.queryByRole("button", { name: "关闭召唤大师页面" })).toBeNull();
    const exit = actionButton(game.state, { type: "LEAVE_PREPARATION" });
    expect(exit.disabled).toBe(false); expect(exit.textContent).toContain("0行动");
    expectLegacyPreserved(game.state, before);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
  }, 15_000);

  it("requires separate bottle confirmation then keeps the promoted page without creating a guest or resetting old resources", async () => {
    const captured = boundary("promotion"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    if (captured.lastIntent.type !== "SUMMONING_MASTER" || captured.lastIntent.command.type !== "CONSUME") throw new Error("Expected actual independent consumption.");
    const command = captured.lastIntent.command;
    expect(projectSliceState(before).summoningMaster.insideCase).toBe(true);
    await mountGame(game); expect(screen.queryByRole("button", { name: "召唤大师与同一真实来客" })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立召唤大师原瓶" }), command.bottleId);
    await userEvent.click(actionButton(game.state, command));
    const review = screen.getByRole("region", { name: "召唤大师原瓶服用确认" });
    expect(review.textContent).toContain(command.bottleId); expect(review.textContent).toContain("本阶身体性别不改变");
    expect(review.textContent).toContain("当前灵性不补满"); expect(review.textContent).toContain("不发放新的来客");
    expect(within(review).queryByRole("checkbox")).toBeNull(); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(review).getByRole("button", { name: "暂不服用，返回准备" }));
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(actionButton(game.state, command)); await userEvent.click(screen.getByRole("button", { name: "确认服用这一原瓶" })); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final)); expect(game.state.progression.sequence).toBe(3);
    expect(game.state.week).toBe(100); expect(game.state.summoningMaster.bottles[0]).toMatchObject({ status: "CONSUMED", outcome: "GREAT_SUCCESS" });
    expect([game.state.health, game.state.mind, game.state.spirituality]).toEqual([100, 92, before.spirituality]);
    expect(game.state.summoningMaster.preparedWeek).toBeNull(); expect(game.state.summoningMaster.witchKingActingAtPromotion).toBe(100);
    expect(game.state.injuries).toEqual(before.injuries); expect(game.state.witchKing).toEqual(before.witchKing); expectLegacyPreserved(game.state, before);
    expect(game.state.summoningMaster.life).toEqual(before.summoningMaster.life);
    expect(screen.getByRole("region", { name: "召唤大师当前目标" }).textContent).toContain("召唤大师3");
    expect(screen.queryByRole("region", { name: "召唤大师原瓶服用确认" })).toBeNull();
    expect(screen.getByRole("region", { name: "唯一流灯的当前身体" }).textContent).toContain("SM3-LUMEN-BODY");
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
    await userEvent.click(screen.getByRole("button", { name: "关闭召唤大师页面" }));
    expect(screen.getByRole("heading", { name: "人物卷宗" })).toBeTruthy();
  }, 15_000);


  it.each(["source-visit", "original-token"] as const)("shows the captured%s ability tier and real cost without changing it to success", async caseId => {
    const captured = boundary(`${caseId}-ability-outcome`), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    if (captured.lastIntent.type !== "SUMMONING_MASTER") throw new Error("Expected the actual finite guest command.");
    const expectedCommand = caseId === "source-visit" ? "OPEN_GATE" : "COOPERATE";
    expect(captured.lastIntent.command.type).toBe(expectedCommand);
    await mountGame(game); await userEvent.click(actionButton(game.state, captured.lastIntent.command)); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final)); expectLegacyPreserved(game.state, before);
    const life = game.state.summoningMaster.life, attempt = life.cases[caseId].attempts.at(-1)!;
    const tier = caseId === "source-visit" ? attempt.gateTier : attempt.cooperationTier;
    expect(tier).toBe(caseId === "source-visit" ? "SUCCESS" : "FAILURE");
    expect(game.state.spirituality).toBe(before.spirituality - (caseId === "source-visit" ? 6 : 3));
    expect(game.state.actionsRemaining).toBe(before.actionsRemaining);
    expect(life.partner.id).toBe(before.summoningMaster.life.partner.id);
    expect(life.partner.chime).toEqual(before.summoningMaster.life.partner.chime);
    const summary = screen.getByText("本次实际尝试与已付代价", { selector: "summary" });
    if (!summary.closest("details")!.open) await userEvent.click(summary);
    const costs = screen.getByRole("region", { name: "召唤大师本次尝试与代价" });
    expect(costs.textContent).toContain(`已付灵性 ${attempt.spiritualitySpent}`);
    expect(costs.textContent).toContain(`来客已付精力 ${attempt.guestStaminaSpent}`);
    if (caseId === "source-visit") {
      expect(life.partner).toEqual(before.summoningMaster.life.partner);
      if (tier === "FAILURE" || tier === "GREAT_FAILURE") {
        expect(life.gate.status).not.toBe("OPEN"); expect(costs.textContent).toContain("没有成功开启原门");
      } else expect(life.gate.status).toBe("OPEN");
    } else {
      expect(life.partner.stamina).toBe(before.summoningMaster.life.partner.stamina - 8);
      expect(life.token.id).toBe(before.summoningMaster.life.token.id); expect(life.token.owner).toBe("SM3-ADA39");
      if (tier === "FAILURE" || tier === "GREAT_FAILURE") {
        expect(attempt.tokenDelivered).toBe(false); expect(costs.textContent).toContain("失败成本保留");
        expect(actionButton(game.state, { type: "CARRY_TOKEN", caseId }).disabled).toBe(false);
      } else expect(attempt.tokenDelivered).toBe(true);
    }
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
  }, 15_000);

  it("returns the same original token then performs the captured zero-action body and gate closure steps", async () => {
    const capture = natural(), captured = boundary("original-token-returned"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    expect(captured.lastIntent).toEqual({ type: "SUMMONING_MASTER", command: { type: "RETURN_TOKEN", caseId: "original-token" } });
    const prior = before.summoningMaster.life.cases["original-token"].attempts.at(-1)!;
    expect(before.week).toBe(102); expect(before.actionsRemaining).toBe(0);
    expect(prior.tokenDelivered).toBe(true); expect(prior.tokenReturned).toBe(false); expect(prior.cooperationTier).toBe("FAILURE");
    expect(before.summoningMaster.life.token).toMatchObject({ id: "SM3-TEST-TOKEN", owner: "SM3-ADA39", massGrams: 200 });
    await mountGame(game); expect(screen.queryByRole("button", { name: "关闭召唤大师页面" })).toBeNull();
    const returnedAt = capture.commands.findIndex((intent, index) => index >= capture.prefixCount && JSON.stringify(intent) === JSON.stringify(captured.lastIntent));
    expect(returnedAt).toBeGreaterThanOrEqual(capture.prefixCount);
    const closedAt = capture.commands.findIndex((intent, index) => index > returnedAt && intent.type === "SUMMONING_MASTER" && intent.command.type === "CLOSE" && intent.command.caseId === "original-token");
    expect(closedAt).toBeGreaterThan(returnedAt);
    const closingCommands = capture.commands.slice(returnedAt + 1, closedAt + 1);
    expect(closingCommands).toEqual([
      { type: "SUMMONING_MASTER", command: { type: "RETURN_GUEST", caseId: "original-token", method: "ORDINARY" } },
      { type: "SUMMONING_MASTER", command: { type: "RETURN_PLAYER", caseId: "original-token" } },
      { type: "SUMMONING_MASTER", command: { type: "INSPECT", caseId: "original-token" } },
      { type: "SUMMONING_MASTER", command: { type: "CLOSE", caseId: "original-token" } },
    ]);
    await userEvent.click(actionButton(game.state, { type: "RETURN_TOKEN", caseId: "original-token" })); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(game.state.summoningMaster.life.token).toMatchObject({ id: "SM3-TEST-TOKEN", owner: "SM3-ADA39", custodian: "SM3-ADA39", location: "OWNER" });
    expect(screen.getByRole("region", { name: "唯一受托原测试牌" }).textContent).toContain("原牌已实际交回艾达");
    expect(actionButton(game.state, { type: "CLOSE", caseId: "original-token" }).disabled).toBe(true);
    for (const intent of closingCommands) {
      if (intent.type !== "SUMMONING_MASTER" || !("caseId" in intent.command) || intent.command.caseId !== "original-token") throw new Error("Expected captured zero-action original-token closure only.");
      const control = actionButton(game.state, intent.command), stepBefore = structuredClone(game.state);
      expect(control.textContent).toContain("0行动"); await userEvent.click(control);
      if (intent.command.type !== "CLOSE") {
        await settled();
        expect(game.state.actionsRemaining).toBe(stepBefore.actionsRemaining); expect(game.state.week).toBe(stepBefore.week);
        expect(game.state.cash).toBe(stepBefore.cash); expect(game.state.spirituality).toBe(stepBefore.spirituality);
      }
    }
    // This real zero-AP close releases the recorded living-cost event. Handle its actual next choice through the UI.
    const eventIntent = capture.commands[closedAt + 1]!;
    if (eventIntent.type !== "EVENT_CHOICE") throw new Error("Expected the captured living-cost choice after zero-AP closure.");
    const event = projectSliceState(game.state).activeEvent!;
    expect(event.instanceId).toBe(eventIntent.eventInstanceId);
    const eventDialog = await screen.findByRole("dialog", { name: event.title });
    const choice = event.choices.find(entry => entry.id === eventIntent.choiceId)!;
    expect(eventIntent.choiceId).toBe("PAY_PART");
    await userEvent.click(within(eventDialog).getByRole("button", { name: name => name.startsWith(choice.label) }));
    await waitFor(() => { expect(game.state.activeEvent).toBeNull(); expect(screen.queryByRole("dialog", { name: event.title })).toBeNull(); });
    await userEvent.click(screen.getByRole("button", { name: "召唤大师与同一真实来客" })); await settled();
    const life = game.state.summoningMaster.life, attempt = life.cases["original-token"].attempts.at(-1)!;
    expect(life.activeCase).toBeNull(); expect(life.playerLocation).toBe("YARD");
    expect(life.partner).toMatchObject({ id: "SM3-LUMEN", bodyId: "SM3-LUMEN-BODY", location: "HOME", status: "ALIVE" });
    expect(life.gate.status).toBe("EXPIRED"); expect(attempt).toMatchObject({ closed: true, tokenReturned: true, guestReturned: true, inspected: true, result: "ORDINARY", ownerTravelMetres: 132, guestTravelMetres: 30 });
    expect(game.state.week).toBe(103); expect(game.state.actionsRemaining).toBe(3);
    expect(game.state.spirituality).toBe(before.spirituality); expectLegacyPreserved(game.state, before);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent, ...closingCommands, eventIntent]);
    await userEvent.click(screen.getByRole("button", { name: "关闭召唤大师页面" }));
    expect(screen.getByRole("heading", { name: "人物卷宗" })).toBeTruthy();
  }, 20_000);

  it("records the actual failed interruption-case gate attempt without moving or cloning a body", async () => {
    const captured = boundary("interrupted-door-opened"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    expect(captured.lastIntent).toEqual({ type: "SUMMONING_MASTER", command: { type: "OPEN_GATE", caseId: "interrupted-door" } });
    await mountGame(game); await userEvent.click(actionButton(game.state, { type: "OPEN_GATE", caseId: "interrupted-door" })); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final)); expect(game.state.spirituality).toBe(before.spirituality - 6);
    expect(game.state.summoningMaster.life.partner).toEqual(before.summoningMaster.life.partner);
    const attempt = game.state.summoningMaster.life.cases["interrupted-door"].attempts.at(-1)!;
    expect(attempt.gateTier).toBe("FAILURE"); expect(game.state.summoningMaster.life.gate.status).toBe("CLOSED");
    expect(actionButton(game.state, { type: "OPEN_GATE", caseId: "interrupted-door" }).disabled).toBe(true);
    expect(screen.getByRole("region", { name: "召唤大师原门与普通退路" }).textContent).toContain("不会令已过门的身体消失");
    expectLegacyPreserved(game.state, before);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
  }, 15_000);

  it("preserves the ordinarily fetched body in the yard after the actual unopened-door observation", async () => {
    const captured = boundary("interrupted-door-cut"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    if (captured.lastIntent.type !== "SUMMONING_MASTER" || captured.lastIntent.command.type !== "OBSERVE_CLOSED_GATE") throw new Error("Expected the actual failed-gate ordinary observation.");
    await mountGame(game); await userEvent.click(actionButton(game.state, captured.lastIntent.command)); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final));
    const life = game.state.summoningMaster.life, attempt = life.cases["interrupted-door"].attempts.at(-1)!;
    expect(life.partner).toEqual(before.summoningMaster.life.partner);
    expect(life.gate.status).not.toBe("OPEN"); expect(attempt.interruptionObserved).toBe(true);
    expect(game.state.spirituality).toBe(before.spirituality); expect(game.state.actionsRemaining).toBe(before.actionsRemaining);
    expect(before.summoningMaster.life.partner.location).toBe("YARD"); expect(life.partner.location).toBe("YARD");
    expect(attempt).toMatchObject({ gateTier: "FAILURE", gateInterrupted: false, arrivalMethod: "ORDINARY", result: "ORDINARY", ownerTravelMetres: 120, guestTravelMetres: 30 });
    const route = screen.getByRole("region", { name: "召唤大师原门与普通退路" });
    expect(route.textContent).toContain("30米"); expect(route.textContent).toContain("门关闭不代替返程");
    expect(screen.queryByRole("button", { name: "关闭召唤大师页面" })).toBeNull();
    expectLegacyPreserved(game.state, before);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
  }, 15_000);

  it("saves actual reflection then returns to ordinary life and reopens growth without renewing guest consent", async () => {
    const captured = boundary("reflection"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    expect(captured.lastIntent).toEqual({ type: "SUMMONING_MASTER", command: { type: "REFLECT" } });
    await mountGame(game); await userEvent.click(actionButton(game.state, { type: "REFLECT" })); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final)); expect(game.state).toEqual(migrateSliceState(natural().practiced));
    expect(game.state.status).toBe("ACTIVE"); expect(game.state.progression).toMatchObject({ sequence: 3, acting: 100 });
    const life = game.state.summoningMaster.life, after = structuredClone(game.state);
    expect(life.reflected).toBe(true); expect(life.activeCase).toBeNull(); expect(life.partner.location).toBe("HOME");
    expect(game.state.week).toBe(105); expect(life.partner).toMatchObject({ health: 100, mind: 100, stamina: 74, ordinaryDistanceM: 90, gateCrossings: 3 });
    expect(Object.values(life.cases).every(entry => entry.status === "RESOLVED" && entry.returned && !entry.contactOpen && entry.attempts.every(attempt => attempt.closed))).toBe(true);
    expect(life.token).toMatchObject({ id: "SM3-TEST-TOKEN", owner: "SM3-ADA39", custodian: "SM3-ADA39", location: "OWNER" });
    const practice = projectSliceState(game.state).summoningMaster.life;
    expect(practice.insideCase).toBe(false); expect(practice.currentAttempt).toBeNull();
    expect(screen.getByRole("region", { name: "召唤大师当前目标" }).textContent).toContain("巫王消化100/100留存");
    await userEvent.click(screen.getByRole("button", { name: "关闭召唤大师页面" }));
    expect(screen.getByRole("heading", { name: "人物卷宗" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^工作，1行动/ })).toBeTruthy(); expect(screen.getByRole("button", { name: /^休养，1行动/ })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "召唤大师" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "唯一流灯的当前身体" }).textContent).toContain("SM3-LUMEN-BODY");
    expect(game.state).toEqual(after); expectLegacyPreserved(game.state, before);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
  }, 15_000);

  it("saves the first actual Edwin round and replays it without repeating paper or guest costs", async () => {
    const captured = boundary("combat-first"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    expect(migrateSliceState(natural().combatStart)).toEqual(before);
    expect(before.combat?.encounterId).toBe("SUMMONING_MASTER_DISPUTE");
    // The old Dorian result and this new encounter both use round1. The saved-history append must reveal the new result.
    expect(before.combat?.round).toBe(1); expect(before.lastCombatRound?.round).toBe(before.combat?.round);
    expect(before.lastCombatRound?.witchKingOutcome).toBeTruthy();
    expect(before.summoningMaster.encounter.targetId).toBe("SM3-EDWIN"); expect(before.summoningMaster.encounter.enemySpirituality).toBe(120);
    expect(before.summoningMaster.encounter.gateOpen).toBe(false); expect(before.summoningMaster.life.partner.location).toBe("HOME");
    if (before.summoningMaster.encounter.guestPolicy === "ASK_HELP") expect(before.summoningMaster.encounter.guestPermit).toMatchObject({ partnerId: "SM3-LUMEN", paidPence: 20 });
    await mountGame(game);
    const battle = projectSliceState(before).combat!, stage = screen.getByRole("dialog", { name: battle.title ?? "普通人追击" });
    expect(battle.enemyName).toContain("埃德温"); expect(within(stage).getByRole("heading", { name: battle.enemyName })).toBeTruthy();
    expect(battle.summoningMaster).toBeTruthy(); expect(stage.textContent).toContain(battle.summoningMaster!.summary);
    expect(game.submit).not.toHaveBeenCalled();
    const result = await submitCapturedRound(game, captured.lastIntent);
    expect(game.state).toEqual(migrateSliceState(captured.final)); expectLegacyPreserved(game.state, before);
    expect(game.state.combatHistory.slice(0, before.combatHistory.length)).toEqual(before.combatHistory);
    expect(game.state.combatHistory).toHaveLength(before.combatHistory.length + 1);
    expect(game.state.lastCombatRound?.round).toBe(before.lastCombatRound?.round);
    const round = game.state.lastCombatRound!, after = structuredClone(game.state);
    expect(round.summoningMasterOutcome).toBeTruthy();
    const displayRound = projectSliceState(game.state).lastCombatRound!;
    const displayLabels = [
      "同一预备原纸WK4-PAPER-1-2与3灵性实际消耗，有限纸影减势35后结束；HELD纸不自动准备，不生成新纸或复活原身体。",
      "原埃德温持自己的唯一SM3-EDWIN-CLUB普通打击20×身体，0S。原来客没有实际承接，不凭空扣其资源。",
      "原埃德温实付4S干扰门媒介；当前没有开着的门可毁。没有再次惊扰或删去身体；原来客仍在实际位置，能沿原普通小径返家，0直接贡献。"
    ];
    const displayConsequence = "同一46岁原埃德温在净空石院2米外，S120/120；原流灯HOME、H100/M100/精力100，政策ASK_HELP。只使用双方共同轮盘。同一原埃德温本回合处于下风，但没有承受实际致伤攻击，不掷伤势盘、不直接扣健康。本轮有限门关闭；同一来客按事先约定沿普通小径自行返回，死亡者留原场，实付灵性、原纸及来客代价保留。";
    expect(displayRound.moves).toEqual(round.moves.map((move, index) => ({ ...move, label: displayLabels[index] })));
    expect(displayRound.consequence).toBe(displayConsequence);
    expect(round).toEqual(migrateSliceState(captured.final).lastCombatRound);
    expect(game.state).toEqual(after);
    const consumedNow = game.state.witchKing.life.papers.filter(paper => paper.status === "CONSUMED" && before.witchKing.life.papers.find(original => original.id === paper.id)!.status === "PREPARED").map(paper => paper.id);
    expect(round.summoningMasterOutcome!.papersConsumed).toEqual(consumedNow);
    expect(consumedNow).toEqual(["WK4-PAPER-1-2"]); expect(game.state.summoningMaster.encounter.enemySpirituality).toBe(116);
    const guest = game.state.summoningMaster.life.partner;
    expect(guest).toMatchObject({ id: "SM3-LUMEN", bodyId: "SM3-LUMEN-BODY", chime: { id: "SM3-CHIME", owner: "SM3-LUMEN" } });
    expect(guest.location).toBe(guest.status === "DEAD" ? "YARD" : "HOME");
    expect(game.state.summoningMaster.encounter.gateOpen).toBe(false);
    expect(within(result).getByRole("heading", { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
    for (const label of displayLabels) expect(result.textContent).toContain(label);
    expect(result.textContent).toContain(displayConsequence);
    await userEvent.click(within(result).getByRole("checkbox", { name: "快速显示本回合结果" }));
    expect(game.state).toEqual(after);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
    if (game.state.combat) {
      await userEvent.click(within(result).getByRole("button", { name: "进入下一回合" }));
      const next = screen.getByRole("dialog", { name: battle.title ?? "普通人追击" });
      const replay = within(next).getByText(`回看第 ${round.round} 回合完整记录`, { selector: "summary" });
      await userEvent.click(replay); expect(replay.closest("details")!.open).toBe(true);
      for (const label of displayLabels) expect(replay.closest("details")!.textContent).toContain(label);
      expect(replay.closest("details")!.textContent).toContain(displayConsequence);
      expect(game.state).toEqual(after); expect(game.submit).toHaveBeenCalledOnce();
    }
  }, 15_000);

  it("commits and reloads the actual terminal outcome without reviving bodies, resetting Dorian or replenishing papers", async () => {
    const captured = boundary("combat-terminal"), game = savedGame(captured.beforeLast), before = structuredClone(game.state), terminal = migrateSliceState(captured.final);
    expect(terminal.combat).toBeNull(); expect(terminal.summoningMaster.encounter.terminal).toMatchObject({ outcome: "RETREATED", round: 5, enemyHealth: 100, enemySpirituality: 71 });
    expect(terminal).toMatchObject({ week: 107, status: "ACTIVE", health: 30, mind: 100, spirituality: 120 });
    await mountGame(game); const result = await submitCapturedRound(game, captured.lastIntent);
    expect(game.state).toEqual(terminal); expectLegacyPreserved(game.state, before);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
    const partner = terminal.summoningMaster.life.partner;
    expect(partner.location).toBe(partner.status === "DEAD" ? "YARD" : "HOME");
    expect(partner.chime).toEqual({ id: "SM3-CHIME", owner: "SM3-LUMEN" });
    expect(terminal.summoningMaster.encounter.gateOpen).toBe(false);
    if (terminal.status === "DEAD") {
      expect(terminal.health).toBe(0); expect(terminal.ending?.kind).toBe("DEATH");
      expect(terminal).toEqual(migrateSliceState(natural().final));
      await userEvent.click(within(result).getByRole("button", { name: "查看收尾卷宗" }));
      expect(screen.getByRole("heading", { name: terminal.ending!.title })).toBeTruthy(); expect(screen.queryByRole("button", { name: "继续生活" })).toBeNull();
    } else {
      expect(terminal.health).toBeGreaterThan(0);
      await userEvent.click(within(result).getByRole("button", { name: "返回生活" }));
    }
    cleanup(); delete window.sliceGame;
    const reloaded = savedGame(captured.final); await mountGame(reloaded);
    expect(reloaded.state).toEqual(terminal); expect(reloaded.submit).not.toHaveBeenCalled();
    if (terminal.ending) {
      expect(screen.getByRole("heading", { name: terminal.ending.title })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "继续生活" })).toBeNull(); expect(screen.queryByRole("button", { name: /^工作，1行动/ })).toBeNull();
    } else expect(screen.getByRole("region", { name: "召唤大师" })).toBeTruthy();
    expect(reloaded.state.witchKing.encounter.enemy).toMatchObject({ id: "WK4-DORIAN", status: "SURRENDERED", health: 70, weaponLocation: "YARD" });
    expectLegacyPreserved(reloaded.state, before);
  }, 15_000);
});
