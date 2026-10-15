/* @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SliceApp } from "../../src/renderer/SliceApp";
import { applySliceIntent, projectSliceState } from "../../src/domain/slice";
import { migrateSliceState } from "../../src/domain/slice/migration";
import type { SliceIntent, SliceState } from "../../src/domain/slice/types";
import type { ArcaneScholarCommand } from "../../src/domain/arcane-scholar/types";
import type { SliceBridge } from "../../src/shared/slice-contracts";

interface NaturalCapture {
  prefixCount: number; commands: SliceIntent[]; departureStart: unknown; guidanceStart: unknown;
  promoted: unknown; practiced: unknown; combatStart: unknown; final: unknown;
}
interface Boundary { beforeLast: unknown; lastIntent: SliceIntent; final: unknown }
// These are actual public-command captures. Never edit resources, consent, RNG, original people or objects.
const original = (): { commands: SliceIntent[]; final: unknown } => JSON.parse(readFileSync("tests/fixtures/alchemist-v01200/natural.json", "utf8"));
const natural = (): NaturalCapture => JSON.parse(readFileSync("tests/fixtures/arcane-scholar-v01430/natural.json", "utf8"));
function boundary(name: string): Boundary {
  const entries = JSON.parse(readFileSync("tests/fixtures/arcane-scholar-v01430/boundaries.json", "utf8")) as Record<string, Boundary>;
  if (!entries[name]) throw new Error(`Missing real Arcane Scholar boundary: ${name}`);
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
const LEGACY_STAGES = ["savant", "archaeologist", "appraiser", "artisan", "astronomer"] as const;
function expectLegacyPreserved(state: SliceState, before: SliceState) {
  for (const key of LEGACY_STAGES) expect(state[key]).toEqual(before[key]);
  const old = structuredClone(before.alchemist), now = structuredClone(state.alchemist);
  expect(now.life.creations).toHaveLength(old.life.creations.length);
  for (const original of now.life.creations) {
    const prior = old.life.creations.find(entry => entry.id === original.id);
    expect(prior).toBeTruthy();
    // Only actual use may change the one original construct's resource and placement fields.
    for (const key of ["charge", "durability", "location", "active"] as const) Object.assign(original, { [key]: prior![key] });
  }
  expect(now).toEqual(old);
  expect(state.arcaneScholar.life.objectIds).toEqual(["AL4-BOX-1", "AL4-FRAME-1"]);
  expect(Object.hasOwn(state.arcaneScholar.life, "creations")).toBe(false);
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
    ?? screen.queryByRole("region", { name: "奥秘学者" })
    ?? screen.queryByRole("dialog", { name: "战斗回合结果" })
    ?? (state.combat ? screen.queryByRole("dialog", { name: state.combat.title ?? "普通人追击" }) : null)
    ?? (state.ending ? screen.queryByRole("heading", { name: state.ending.title }) : null)).toBeTruthy());
  // Previous battles remain in the save. Acknowledge their real outcomes through the UI instead of erasing them.
  await acknowledgeSavedRound();
  if (state.ending) await screen.findByRole("heading", { name: state.ending.title });
  else if (state.combat) await screen.findByRole("dialog", { name: state.combat.title ?? "普通人追击" });
  else if (state.arcaneScholar.insideCase) await screen.findByRole("region", { name: "奥秘学者" });
  else {
    await screen.findByRole("heading", { name: "人物卷宗" });
    await userEvent.click(screen.getByRole("button", { name: "奥秘学者与双原件协作" }));
    await screen.findByRole("region", { name: "奥秘学者" });
  }
}
function actionButton(state: SliceState, command: ArcaneScholarCommand) {
  const entry = projectSliceState(state).arcaneScholar.actions.find(item => JSON.stringify(item.command) === JSON.stringify(command));
  if (!entry) throw new Error(`No actual public Arcane Scholar action: ${JSON.stringify(command)}`);
  return screen.getByRole("button", { name: name => name.startsWith(entry.label) }) as HTMLButtonElement;
}
async function settled() {
  await waitFor(() => expect(screen.getByRole("region", { name: "奥秘学者" }).getAttribute("aria-busy")).toBe("false"));
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

describe("Arcane Scholar navigation from preserved real Alchemist captures", () => {
  it("opens and closes the optional S3 route after the exact 352-command prefix without reviving Osric or duplicating originals", async () => {
    const old = original(), capture = natural(), game = savedGame(old.final), before = structuredClone(game.state);
    expect(old.commands).toHaveLength(352); expect(capture.prefixCount).toBe(352);
    expect(capture.commands.slice(0, capture.prefixCount)).toEqual(old.commands);
    expect(migrateSliceState(capture.departureStart)).toEqual(before);
    expect(before.progression.sequence).toBe(4); expect(before.alchemist.promotionWeek).toBe(83);
    expect(before.alchemist.encounter.enemy).toMatchObject({ id: "AL4-OSRIC", health: 0, status: "DEAD", weaponLocation: "YARD" });
    expect(before.alchemist.life.creations).toMatchObject([
      { id: "AL4-BOX-1", charge: 2, durability: 100, location: "PLAYER", active: false },
      { id: "AL4-FRAME-1", charge: 0, durability: 95, location: "PLAYER", active: false },
    ]);
    await mountGame(game);
    expect(screen.getByRole("region", { name: "奥秘学者当前目标" }).textContent).toContain("炼金术士需消化100");
    expect(screen.getByRole("region", { name: "奥秘学者当前目标" }).textContent).toContain("奥秘学者为序列3，本阶段只开放有限解析与两原件协同。当前渠道只提供成品魔药，晋升仍须完成专业准备，不提供完整配方。");
    const summary = screen.getByText("原身体、旧园地与旧人记录", { selector: "summary" });
    expect(summary.closest("details")!.open).toBe(false); await userEvent.click(summary);
    const history = screen.getByRole("region", { name: "奥秘学者继承记录" });
    expect(history.textContent).toContain("第83周真实晋升"); expect(history.textContent).toContain("AL4-OSRIC-CLUB");
    expect(history.textContent).toContain("已死亡，不会复活"); expect(history.textContent).toContain("沙化"); expect(history.textContent).toContain("干涸");
    expect(history.textContent).toContain("AL4-BOX-1"); expect(history.textContent).toContain("储能0/3、耐久95/100");
    expect(within(history).queryByRole("button")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭奥秘学者页面" }));
    expect(screen.getByRole("heading", { name: "人物卷宗" })).toBeTruthy();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 15_000);

  it("retries the original guidance envelope after save failure without charging 500 or one action twice", async () => {
    const captured = boundary("guidance"), game = savedGame(captured.beforeLast, true), before = structuredClone(game.state);
    expect(captured.lastIntent).toEqual({ type: "ARCANE_SCHOLAR", command: { type: "LEARN_GUIDANCE" } });
    expect(migrateSliceState(natural().guidanceStart)).toEqual(before);
    await mountGame(game); await userEvent.click(actionButton(game.state, { type: "LEARN_GUIDANCE" }));
    await screen.findByRole("alert"); expect(game.state).toEqual(before); expect(game.submit).toHaveBeenCalledTimes(1);
    expect(actionButton(game.state, { type: "LEARN_GUIDANCE" }).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "关闭奥秘学者页面" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "返回主菜单" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "重试这次操作" })); await settled();
    const calls = vi.mocked(game.submit).mock.calls;
    expect(calls).toHaveLength(2); expect(calls[1]![0]).toEqual(calls[0]![0]); expect(calls[0]![0].payload).toEqual(captured.lastIntent);
    expect(game.state).toEqual(migrateSliceState(captured.final)); expect(game.state.cash).toBe(before.cash - 500);
    expect(game.state.actionsRemaining).toBe(before.actionsRemaining - 1);
    expect(game.state.arcaneScholar.guidanceKnown).toBe(true); expect(game.state.arcaneScholar.preparations).toEqual([]);
    expect(game.state.arcaneScholar.preparedWeek).toBeNull(); expect(game.state.alchemist).toEqual(before.alchemist);
    expectLegacyPreserved(game.state, before); expect(screen.getByRole("button", { name: "关闭奥秘学者页面" })).toBeTruthy();
  }, 15_000);

  it("receives the actual separately worked bottle without drinking it or granting free preparation", async () => {
    const captured = boundary("buy-independent-potion"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    if (captured.lastIntent.type !== "ARCANE_SCHOLAR" || captured.lastIntent.command.type !== "BUY_POTION") throw new Error("Expected the real bottle handover.");
    const command = captured.lastIntent.command;
    await mountGame(game);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立奥秘学者原瓶" }), command.bottleId);
    await userEvent.click(actionButton(game.state, command)); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(game.state.cash).toBe(before.cash - 800); expect(game.state.actionsRemaining).toBe(before.actionsRemaining);
    expect(game.state.arcaneScholar.bottles.find(b => b.id === command.bottleId)).toMatchObject({ status: "PLAYER", labourSteps: 5, consumedWeek: null, outcome: null });
    expect(game.state.progression.sequence).toBe(4); expect(game.state.arcaneScholar.preparedWeek).toBeNull();
    expect(game.state.arcaneScholar.preparations).toEqual(before.arcaneScholar.preparations);
    expect(screen.queryByRole("region", { name: "奥秘学者原瓶服用确认" })).toBeNull();
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
    expect(game.state.alchemist).toEqual(before.alchemist); expectLegacyPreserved(game.state, before);
  }, 15_000);

  it("saves the real current-week preparation and exposes an unpaid ordinary exit rather than closing its view", async () => {
    const captured = boundary("prepare-current-week"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    expect(captured.lastIntent).toEqual({ type: "ARCANE_SCHOLAR", command: { type: "PREPARE_PROMOTION" } });
    await mountGame(game); await userEvent.click(actionButton(game.state, { type: "PREPARE_PROMOTION" })); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect([game.state.cash, game.state.actionsRemaining, game.state.week]).toEqual([before.cash - 120, before.actionsRemaining - 1, before.week]);
    expect(game.state.arcaneScholar.preparedWeek).toBe(before.week);
    expect(screen.queryByRole("button", { name: "关闭奥秘学者页面" })).toBeNull();
    const exit = actionButton(game.state, { type: "LEAVE_PREPARATION" });
    expect(exit.disabled).toBe(false); expect(exit.textContent).toContain("0行动");
    expect(game.state.alchemist).toEqual(before.alchemist); expectLegacyPreserved(game.state, before);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
  }, 15_000);

  it("requires independent bottle confirmation and retains the actual promoted route without restoring old resources", async () => {
    const captured = boundary("promotion"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    if (captured.lastIntent.type !== "ARCANE_SCHOLAR" || captured.lastIntent.command.type !== "CONSUME") throw new Error("Expected actual independent consumption.");
    const command = captured.lastIntent.command;
    expect(projectSliceState(before).arcaneScholar.insideCase).toBe(true);
    await mountGame(game); expect(screen.queryByRole("button", { name: "奥秘学者与双原件协作" })).toBeNull();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立奥秘学者原瓶" }), command.bottleId);
    await userEvent.click(actionButton(game.state, command));
    const review = screen.getByRole("region", { name: "奥秘学者原瓶服用确认" });
    expect(review.textContent).toContain(command.bottleId); expect(review.textContent).toContain("本阶身体性别不改变");
    expect(review.textContent).toContain("当前灵性不补满"); expect(review.textContent).toContain("旧人不复活");
    expect(within(review).queryByRole("checkbox")).toBeNull(); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(review).getByRole("button", { name: "暂不服用，返回准备" }));
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(actionButton(game.state, command));
    await userEvent.click(screen.getByRole("button", { name: "确认服用这一原瓶" })); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final)); expect(game.state.progression.sequence).toBe(3);
    expect(game.state.arcaneScholar.preparedWeek).toBeNull(); expect(game.state.arcaneScholar.alchemistActingAtPromotion).toBe(100);
    expect(game.state.injuries).toEqual(before.injuries); expect(game.state.alchemist).toEqual(before.alchemist); expectLegacyPreserved(game.state, before);
    expect(screen.getByRole("region", { name: "奥秘学者当前目标" }).textContent).toContain("奥秘学者3");
    expect(screen.queryByRole("region", { name: "奥秘学者原瓶服用确认" })).toBeNull();
    expect(screen.getByRole("region", { name: "两件唯一原造物" }).textContent).toContain("AL4-BOX-1");
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
    await userEvent.click(screen.getByRole("button", { name: "关闭奥秘学者页面" }));
    expect(screen.getByRole("heading", { name: "人物卷宗" })).toBeTruthy();
  }, 15_000);

  it("retains the first real failed bottle and paid costs while returning to the unpromoted route", async () => {
    const captured = boundary("consume-failure"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    if (captured.lastIntent.type !== "ARCANE_SCHOLAR" || captured.lastIntent.command.type !== "CONSUME") throw new Error("Expected the actual failed bottle.");
    const command = captured.lastIntent.command;
    await mountGame(game);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择独立奥秘学者原瓶" }), command.bottleId);
    await userEvent.click(actionButton(game.state, command)); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "确认服用这一原瓶" })); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(game.state.arcaneScholar.bottles.find(b => b.id === command.bottleId)).toMatchObject({ status: "CONSUMED", outcome: "FAILURE", consumedWeek: before.week });
    expect(game.state.arcaneScholar.preparedWeek).toBeNull(); expect(game.state.progression.sequence).toBe(4);
    expect(game.state.health).toBe(before.health - 15); expect(game.state.mind).toBe(before.mind - 25);
    expect(game.state.cash).toBe(before.cash); expect(game.state.actionsRemaining).toBe(before.actionsRemaining);
    expect(game.state.arcaneScholar.preparations).toEqual(before.arcaneScholar.preparations);
    expect(game.state.alchemist).toEqual(before.alchemist); expectLegacyPreserved(game.state, before);
    expect(screen.getByRole("button", { name: "关闭奥秘学者页面" })).toBeTruthy();
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
  }, 15_000);

  it.each(["tolerance-map", "timed-transfer", "fault-isolation"] as const)("shows the actual %s ability result and exact spent resources without forcing its tier", async caseId => {
    const captured = boundary(`${caseId}-ability-outcome`), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    if (captured.lastIntent.type !== "ARCANE_SCHOLAR") throw new Error("Expected an original research command.");
    await mountGame(game); await userEvent.click(actionButton(game.state, captured.lastIntent.command)); await settled();
    const expected = migrateSliceState(captured.final);
    expect(game.state).toEqual(expected); expectLegacyPreserved(game.state, before);
    const attempt = game.state.arcaneScholar.life.cases[caseId].attempts.at(-1)!;
    const tier = caseId === "tolerance-map" ? attempt.analysisTier : attempt.linkTier;
    expect(["GREAT_SUCCESS", "SUCCESS", "FAILURE", "GREAT_FAILURE"]).toContain(tier);
    expect(game.state.spirituality).toBe(before.spirituality - (caseId === "tolerance-map" ? 4 : 5));
    expect(game.state.actionsRemaining).toBe(before.actionsRemaining); expect(game.state.progression.mastery).toEqual(before.progression.mastery);
    expect(game.state.alchemist.life.creations).toHaveLength(2);
    const summary = screen.getByText("本次实际尝试与已付代价", { selector: "summary" }); await userEvent.click(summary);
    const costs = screen.getByRole("region", { name: "奥秘学者本次尝试与代价" });
    expect(costs.textContent).toContain(`已付灵性 ${attempt.spiritualitySpent}`);
    if (tier === "FAILURE" || tier === "GREAT_FAILURE") expect(costs.textContent).toContain("本次能力尝试失败，已付成本保留");
    if (caseId !== "tolerance-map") {
      expect(attempt.boxChargeSpent).toBe(1); expect(attempt.frameChargeSpent).toBe(1);
      for (const original of game.state.alchemist.life.creations) expect(original.charge).toBe(before.alchemist.life.creations.find(o => o.id === original.id)!.charge - 1);
    }
    if (caseId === "fault-isolation") {
      expect(game.state.arcaneScholar.life.fuses.find(f => f.id === attempt.fuseId)!.consumed).toBe(true);
      expect(screen.getByRole("region", { name: "原低载荷装置与熔片" }).textContent).toContain("AR3-LOAD-HANDLE");
      if (tier === "FAILURE" || tier === "GREAT_FAILURE") {
        expect(attempt.frameDurabilityLost).toBe(5); expect(actionButton(game.state, { type: "MANUAL_STOP", caseId }).disabled).toBe(false);
      }
    }
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
  }, 15_000);

  it("returns the same original paper, then physically retrieves both originals and closes through the captured zero-action route", async () => {
    const capture = natural(), captured = boundary("timed-transfer-returned"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    expect(captured.lastIntent).toEqual({ type: "ARCANE_SCHOLAR", command: { type: "RETURN_NOTE", caseId: "timed-transfer" } });
    const prior = before.arcaneScholar.life.cases["timed-transfer"].attempts.at(-1)!;
    expect(before.actionsRemaining).toBe(0); expect(before.week).toBe(139);
    expect(prior.noteDelivered).toBe(true); expect(prior.noteReturned).toBe(false);
    expect(before.arcaneScholar.life.note).toMatchObject({ id: "AR3-TEST-NOTE", owner: "AR3-NELL", location: "BENCH_END" });
    await mountGame(game); expect(screen.queryByRole("button", { name: "关闭奥秘学者页面" })).toBeNull();
    const returnedAt = capture.commands.findIndex((intent, index) => index >= capture.prefixCount && intent.type === "ARCANE_SCHOLAR" && intent.command.type === "RETURN_NOTE" && intent.command.caseId === "timed-transfer");
    expect(returnedAt).toBeGreaterThanOrEqual(capture.prefixCount);
    const closingCommands = capture.commands.slice(returnedAt + 1, returnedAt + 3);
    expect(closingCommands).toEqual([
      { type: "ARCANE_SCHOLAR", command: { type: "RETURN_ORIGINALS", caseId: "timed-transfer" } },
      { type: "ARCANE_SCHOLAR", command: { type: "CLOSE", caseId: "timed-transfer" } },
    ]);
    await userEvent.click(actionButton(game.state, { type: "RETURN_NOTE", caseId: "timed-transfer" })); await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(game.state.arcaneScholar.life.note).toEqual({ id: "AR3-TEST-NOTE", owner: "AR3-NELL", custodian: "AR3-NELL", location: "OWNER" });
    expect(screen.getByRole("region", { name: "唯一受托原测试纸" }).textContent).toContain("原纸已亲手归还内尔");
    expect(actionButton(game.state, { type: "CLOSE", caseId: "timed-transfer" }).disabled).toBe(true);
    for (const intent of closingCommands) {
      if (intent.type !== "ARCANE_SCHOLAR") throw new Error("Only captured original scene steps may close this scene.");
      const control = actionButton(game.state, intent.command); expect(control.textContent).toContain("0行动");
      await userEvent.click(control); await settled();
      if (intent.command.type === "RETURN_ORIGINALS") { expect(game.state.actionsRemaining).toBe(0); expect(game.state.week).toBe(before.week); expect(game.state.cash).toBe(before.cash); }
    }
    const life = game.state.arcaneScholar.life, attempt = life.cases["timed-transfer"].attempts.at(-1)!;
    expect(life.activeCase).toBeNull(); expect(life.ownerNode).toBe("BENCH_START"); expect(attempt.closed).toBe(true);
    expect(attempt.noteReturned).toBe(true); expect(attempt.originalsReturned).toBe(true);
    expect(attempt.ownerTravelMetres).toBeGreaterThan(prior.ownerTravelMetres);
    for (const original of game.state.alchemist.life.creations) expect(original).toMatchObject({ location: "PLAYER", active: false });
    // The real last paid action already exhausted W139. Closing now releases its pending weekly settlement.
    expect(game.state.week).toBe(140); expect(game.state.actionsRemaining).toBe(3); expect(game.state.cash).toBe(before.cash - 30);
    expect(game.state.spirituality).toBe(before.spirituality); expect(game.state.progression.mastery).toEqual(before.progression.mastery);
    expectLegacyPreserved(game.state, before);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent, ...closingCommands]);
    await userEvent.click(screen.getByRole("button", { name: "关闭奥秘学者页面" }));
    expect(screen.getByRole("heading", { name: "人物卷宗" })).toBeTruthy();
  }, 15_000);

  it("returns the real digested S3 run to ordinary life and reopens growth without recharging or renewing consent", async () => {
    const game = savedGame(natural().practiced), before = structuredClone(game.state);
    expect(before.status).toBe("ACTIVE"); expect(before.progression.sequence).toBe(3); expect(before.progression.acting).toBe(100);
    expect(before.arcaneScholar.life.reflected).toBe(true); expect(before.arcaneScholar.life.activeCase).toBeNull();
    expect(Object.values(before.arcaneScholar.life.cases).every(entry => entry.status === "RESOLVED" && entry.returned && !entry.contactOpen)).toBe(true);
    await mountGame(game);
    expect(screen.getByRole("region", { name: "奥秘学者当前目标" }).textContent).toContain("炼金术士消化100/100留存");
    const practice = projectSliceState(game.state).arcaneScholar.life;
    expect(practice.insideCase).toBe(false); expect(practice.currentAttempt).toBeNull();
    expect(game.state.arcaneScholar.life.note).toEqual({ id: "AR3-TEST-NOTE", owner: "AR3-NELL", custodian: "AR3-NELL", location: "OWNER" });
    expect(Object.values(game.state.arcaneScholar.life.cases).every(entry => entry.attempts.every(attempt => attempt.closed))).toBe(true);
    // The default closed record-only case needs no participant consent. Inspect the closed paper case explicitly.
    await userEvent.click(screen.getByText("三项研究情境与原尝试记录", { selector: "summary" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择奥秘学者生活情境" }), "timed-transfer");
    expect(screen.getByRole("region", { name: "奥秘学者当前原场" }).textContent).toContain("尚无本次已保存同意");
    expect(screen.getByRole("region", { name: "唯一受托原测试纸" }).textContent).toContain("内尔保管");
    expect(game.state.arcaneScholar.life).toEqual(before.arcaneScholar.life); expect(game.submit).not.toHaveBeenCalled();
    const originals = screen.getByRole("region", { name: "两件唯一原造物" });
    for (const original of before.alchemist.life.creations) expect(originals.textContent).toContain(`储能 ${original.charge} / 3 · 耐久 ${original.durability} / 100`);
    const optional = screen.getByText("新原人的可选冲突", { selector: "summary" });
    expect(optional.closest("details")!.open).toBe(false); await userEvent.click(optional);
    expect(screen.getByRole("region", { name: "奥秘学者原人遭遇" }).textContent).toContain("AR3-CORWIN");
    expect(screen.getByRole("region", { name: "奥秘学者原人遭遇" }).textContent).toContain("旧奥斯里克分别保存");
    await userEvent.click(screen.getByRole("button", { name: "关闭奥秘学者页面" }));
    expect(screen.getByRole("heading", { name: "人物卷宗" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^工作，1行动/ })).toBeTruthy(); expect(screen.getByRole("button", { name: /^休养，1行动/ })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "奥秘学者" })).toBeTruthy();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 15_000);

  it("saves the actual first Corwin round and replays it without duplicating bodies, originals or costs", async () => {
    const captured = boundary("combat-first"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    expect(migrateSliceState(natural().combatStart)).toEqual(before);
    expect(before.combat?.encounterId).toBe("ARCANE_SCHOLAR_DISPUTE"); expect(before.arcaneScholar.encounter.targetId).toBe("AR3-CORWIN");
    expect(before.arcaneScholar.encounter.enemySpirituality).toBe(120);
    expect(before.arcaneScholar.encounter.carriedIds).toEqual(["AL4-BOX-1", "AL4-FRAME-1"]);
    await mountGame(game);
    const battle = projectSliceState(before).combat!, stage = screen.getByRole("dialog", { name: battle.title ?? "普通人追击" });
    expect(battle.enemyName).toContain("科尔温"); expect(within(stage).getByRole("heading", { name: battle.enemyName })).toBeTruthy();
    expect(battle.arcaneScholar).toBeTruthy(); expect(stage.textContent).toContain(battle.arcaneScholar!.summary);
    expect(game.submit).not.toHaveBeenCalled();
    const result = await submitCapturedRound(game, captured.lastIntent);
    expect(game.state).toEqual(migrateSliceState(captured.final)); expectLegacyPreserved(game.state, before);
    expect(game.state.combatHistory.slice(0, before.combatHistory.length)).toEqual(before.combatHistory);
    const round = game.state.lastCombatRound!, after = structuredClone(game.state);
    expect(round.arcaneScholarOutcome).toBeTruthy();
    const displayRound = projectSliceState(game.state).lastCombatRound!;
    const displayLabels = [
      "观察眼前原人、原件和普通出口，0灵性0贡献，不读取未知真相、制造或补充储能。",
      "同一原科尔温有限协同干扰：独立原灵性实际−4、余116/120；本轮下一次成功施展协同的抵抗30%提高70%，消费后或轮末失效，不借本人原资源。",
      "继承原架赋灵知识31≤78，实际4S和1原储能，原架沿眼前2米地面一次有限推挡，优势40×原掌握；储能余2，不补能或增添次数。",
      "本人原身体普通避让减势10，0灵性0储能，不重抽、不免伤。",
    ];
    const displayConsequence = "同一47岁原科尔温在独立工院2米外，独立灵性120/120。原盒原架仍用旧唯一资源，缺能普通回退；全新3扩展以当前说明为准。你本回合处于下风，但没有承受实际致伤攻击，不掷伤势盘、不直接扣健康。本轮有限分析与双原件协调窗口结束；原储能、灵性和耐久实际消耗保留。";
    expect(displayRound.moves).toEqual(round.moves.map((move, index) => ({ ...move, label: displayLabels[index] })));
    expect(displayRound.consequence).toBe(displayConsequence);
    expect(round).toEqual(migrateSliceState(captured.final).lastCombatRound);
    expect(game.state).toEqual(after);
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

  it("commits and reloads the captured terminal outcome without changing death, surrender, retreat or original resources", async () => {
    const captured = boundary("combat-terminal"), game = savedGame(captured.beforeLast), before = structuredClone(game.state), terminal = migrateSliceState(captured.final);
    expect(terminal.combat).toBeNull(); expect(terminal.arcaneScholar.encounter.terminal).toBeTruthy();
    await mountGame(game); const result = await submitCapturedRound(game, captured.lastIntent);
    expect(game.state).toEqual(terminal); expectLegacyPreserved(game.state, before);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([captured.lastIntent]);
    if (terminal.status === "DEAD") {
      expect(terminal.health).toBe(0); expect(terminal.ending?.kind).toBe("DEATH");
      expect(terminal).toEqual(migrateSliceState(natural().final));
      for (const original of terminal.alchemist.life.creations) expect(original).toMatchObject({ location: "YARD", active: false });
      await userEvent.click(within(result).getByRole("button", { name: "查看收尾卷宗" }));
      expect(screen.getByRole("heading", { name: terminal.ending!.title })).toBeTruthy(); expect(screen.queryByRole("button", { name: "继续生活" })).toBeNull();
    } else {
      expect(terminal.health).toBeGreaterThan(0);
      for (const original of terminal.alchemist.life.creations) expect(original).toMatchObject({ location: "PLAYER", active: false });
      await userEvent.click(within(result).getByRole("button", { name: "返回生活" }));
    }
    cleanup(); delete window.sliceGame;
    const reloaded = savedGame(captured.final); await mountGame(reloaded);
    expect(reloaded.state).toEqual(terminal); expect(reloaded.submit).not.toHaveBeenCalled();
    if (terminal.ending) {
      expect(screen.getByRole("heading", { name: terminal.ending.title })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "继续生活" })).toBeNull(); expect(screen.queryByRole("button", { name: /^工作，1行动/ })).toBeNull();
    } else expect(screen.getByRole("region", { name: "奥秘学者" })).toBeTruthy();
    expect(reloaded.state.alchemist.encounter.enemy).toMatchObject({ id: "AL4-OSRIC", status: "DEAD", health: 0, weaponLocation: "YARD" });
    expectLegacyPreserved(reloaded.state, before);
  }, 15_000);
});
