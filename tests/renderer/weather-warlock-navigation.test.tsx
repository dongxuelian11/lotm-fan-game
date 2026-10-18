/* @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { readObjectEntry } from "../helpers/read-object-entry.js";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SliceApp } from "../../src/renderer/SliceApp";
import { applySliceIntent, assertValidSliceState, projectSliceState } from "../../src/domain/slice";
import { migrateSliceState } from "../../src/domain/slice/migration";
import type { SliceIntent, SliceState } from "../../src/domain/slice/types";
import type { WeatherWarlockCommand } from "../../src/domain/weather-warlock/types";
import type { SliceBridge } from "../../src/shared/slice-contracts";

import { boundary, capturedCommand, savedGame, acknowledgeSavedRound, continueRun, mountGame, actionButton, selectCommandObject, settled, assertPreservedOlderPeople, naturalCapture } from './weather-warlock-ui-fixture';

describe('Weather Warlock navigation controls', () => {
  it("opens the optional S2 route from the actual living S3 continuation without altering original history", async () => {
    const game = savedGame(naturalCapture.guidanceStart), before = structuredClone(game.state);
    expect(naturalCapture.prefixCount).toBe(543);
    expect(game.state.progression.sequence).toBe(3);
    expect(game.state.ironBloodKnight.team.members).toHaveLength(30);
    await mountGame(game, false);
    await userEvent.click(screen.getByRole("button", { name: "天气术士与有限天气" }));
    const panel = screen.getByRole("region", { name: "天气术士" });
    expect(panel.textContent).toContain("战争主教3 → 天气术士2");
    const history = within(panel).getByText("继承与能力边界", { selector: "summary" });
    expect(history.closest("details")!.open).toBe(false);
    await userEvent.click(history);
    expect(history.closest("details")!.textContent).toContain("30位原成员只有一份健康");
    expect(history.closest("details")!.textContent).toContain("本次不再改变身体性别");
    await userEvent.click(screen.getByRole("button", { name: "关闭天气术士页面" }));
    expect(screen.getByRole("heading", { name: "人物卷宗" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "战争主教" })).toBeTruthy();
    expect(game.state).toEqual(before);
    expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it.each(["promoted", "practiced", "final"] as const)("routes the actual %s S2 save from the homepage growth entry to Weather Warlock", async name => {
    const game = savedGame(naturalCapture[name]), before = structuredClone(game.state);
    await mountGame(game, false);
    expect(game.state.progression.sequence).toBe(2);
    expect(screen.getByRole("button", { name: /^工作，1行动/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^休养，1行动/ })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "天气术士" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "战争主教" })).toBeNull();
    expect(screen.queryByRole("button", { name: /独立确认服用第/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "关闭天气术士页面" }));
    await userEvent.click(screen.getByRole("button", { name: "天气术士与有限天气" }));
    expect(game.state).toEqual(before);
    expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it.each([
    "guidance", "preparation-plan_support", "potion-work-5", "buy-independent-potion", "prepare-current-week",
    "fog-corridor-perform", "fog-corridor-stop", "frost-tray-perform", "frost-tray-ordinary",
    "wind-rain-perform", "wind-rain-stop", "wind-rain-close",
    "team-rest-paid", "team-recovered-next-week", "wind-rain-report", "reflection", "encounter-original-five",
  ])("submits the real %s boundary once through the published controls", async name => {
    const captured = boundary(name), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    const command = capturedCommand(captured);
    await mountGame(game);
    await selectCommandObject(command);
    expect(actionButton(game.state, command).disabled).toBe(false);
    await userEvent.click(actionButton(game.state, command));
    await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: before.runId,
      expectedRevision: before.revision, payload: captured.lastIntent });
    expect(game.state.ironBloodKnight.encounter).toEqual(before.ironBloodKnight.encounter);
    expect(game.state.warBishop).toEqual(before.warBishop);
  }, 20_000);

  it.each(["consume-failure", "promotion"])("independently reviews and cancels the actual %s bottle before confirming once", async name => {
    const captured = boundary(name), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    const command = capturedCommand(captured);
    if (command.type !== "CONSUME") throw new Error("Expected the actual original bottle consumption.");
    await mountGame(game);
    await selectCommandObject(command);
    const trigger = actionButton(game.state, command);
    await userEvent.click(trigger);
    let review = screen.getByRole("dialog", { name: "确认服用天气术士原瓶？" });
    expect(review.textContent).toContain(command.bottleId);
    expect(review.textContent).toContain(projectSliceState(before).weatherWarlock.risk);
    expect(document.activeElement).toBe(within(review).getByRole("button", { name: "确认服用这一原瓶" }));
    expect(within(review).queryByRole("checkbox")).toBeNull();
    expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(review).getByRole("button", { name: "暂不服用，返回准备" }));
    expect(screen.queryByRole("dialog", { name: "确认服用天气术士原瓶？" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(game.state).toEqual(before);
    await userEvent.click(trigger);
    review = screen.getByRole("dialog", { name: "确认服用天气术士原瓶？" });
    fireEvent(review, new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog", { name: "确认服用天气术士原瓶？" })).toBeNull();
    expect(game.state).toEqual(before);
    expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(trigger);
    const confirm = within(screen.getByRole("dialog", { name: "确认服用天气术士原瓶？" })).getByRole("button", { name: "确认服用这一原瓶" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(game.submit).toHaveBeenCalledOnce();
    expect(vi.mocked(game.submit).mock.calls[0]![0].payload).toEqual(captured.lastIntent);
    expect(game.state.ironBloodKnight).toEqual(before.ironBloodKnight);
    expect(game.state.warBishop).toEqual(before.warBishop);
    expect(game.state.character.gender).toBe(before.character.gender);
    expect(game.state.weatherWarlock.bottles.find(b => b.id === command.bottleId)?.status).toBe("CONSUMED");
    expect(game.state.progression.sequence).toBe(name === "promotion" ? 2 : 3);
    expect(screen.queryByRole("dialog", { name: "确认服用天气术士原瓶？" })).toBeNull();
  }, 20_000);

  it.each(["buy-independent-potion", "prepare-current-week", "promotion"])("locks pending and failed %s saves, then retries the identical envelope without duplicate payment", async name => {
    const captured = boundary(name), game = savedGame(captured.beforeLast, { deferFirstSave: true, failFirstSave: true });
    const before = structuredClone(game.state), command = capturedCommand(captured);
    await mountGame(game);
    await selectCommandObject(command);
    await userEvent.click(actionButton(game.state, command));
    if (command.type === "CONSUME") await userEvent.click(screen.getByRole("button", { name: "确认服用这一原瓶" }));
    expect(game.submit).toHaveBeenCalledOnce();
    expect(game.state).toEqual(before);
    expect(screen.getByRole("region", { name: "天气术士" }).getAttribute("aria-busy")).toBe("true");
    expect(actionButton(game.state, command).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "返回主菜单" }) as HTMLButtonElement).disabled).toBe(true);
    const close = screen.queryByRole("button", { name: "关闭天气术士页面" }) as HTMLButtonElement | null;
    if (close) expect(close.disabled).toBe(true);
    const bottleSelect = screen.queryByRole("combobox", { name: "选择天气术士原瓶" }) as HTMLSelectElement | null;
    if (bottleSelect) expect(bottleSelect.disabled).toBe(true);
    fireEvent.click(actionButton(game.state, command));
    expect(game.submit).toHaveBeenCalledOnce();
    await act(async () => { game.releaseFirstSave(); });
    await screen.findAllByRole("alert");
    expect(game.state).toEqual(before);
    expect(actionButton(game.state, command).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "返回主菜单" }) as HTMLButtonElement).disabled).toBe(true);
    const retry = screen.getByRole("button", { name: "重试这次操作" });
    const review = screen.queryByRole("dialog", { name: "确认服用天气术士原瓶？" });
    // Real showModal makes controls outside the dialog inert. A failed save must either
    // dismiss this review (without releasing the pending command) or put retry inside it.
    // jsdom does not model inertness, so assert this reachability explicitly.
    if (review) expect(review.contains(retry)).toBe(true);
    await userEvent.click(retry);
    await settled();
    const calls = vi.mocked(game.submit).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[1]![0]).toEqual(calls[0]![0]);
    expect(calls[0]![0].payload).toEqual(captured.lastIntent);
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(game.state.cash).toBe(before.cash - (name === "buy-independent-potion" ? 800 : name === "prepare-current-week" ? 120 : 0));
    expect(game.state.actionsRemaining).toBe(before.actionsRemaining - (name === "prepare-current-week" ? 1 : 0));
    expect(game.state.ironBloodKnight).toEqual(before.ironBloodKnight);
  }, 20_000);


});
