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

describe('Weather Warlock life controls', () => {
  it.each([
    ["fog-corridor-ability-outcome", "fog-corridor", 6, false],
    ["frost-tray-ability-outcome", "frost-tray", 8, true],
    ["wind-rain-ability-outcome", "wind-rain", 10, true],
  ] as const)("retains actual field costs and the one-attempt result for %s", async (name, caseId, cost, failed) => {
    const captured = boundary(name), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    await mountGame(game);
    expect(screen.queryByRole("button", { name: "关闭天气术士页面" })).toBeNull();
    expect((screen.getByRole("combobox", { name: "选择天气术士生活情境" }) as HTMLSelectElement).disabled).toBe(true);
    await userEvent.click(actionButton(game.state, { type: "CAST_WEATHER" }));
    await settled();
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(game.state.spirituality).toBe(before.spirituality - cost);
    expect(game.state.health).toBe(before.health - (failed ? 1 : 0));
    expect(game.state.cash).toBe(before.cash);
    expect(game.state.actionsRemaining).toBe(before.actionsRemaining);
    for (const [i, member] of game.state.ironBloodKnight.team.members.slice(0, 5).entries()) {
      expect(member.health).toBe(before.ironBloodKnight.team.members[i]!.health - (failed ? 1 : 0));
      expect(member.energy).toBe(before.ironBloodKnight.team.members[i]!.energy - 1);
    }
    assertPreservedOlderPeople(before, game.state);
    const practice = game.state.weatherWarlock.life.practice;
    const field = screen.getByRole("region", { name: "实际水源与天气现场" });
    expect(field.textContent).toContain(`原水箱${practice.reservoir.remainingMl}毫升`);
    expect(field.textContent).toContain(`同一盘液水${practice.tray.liquidMl}、冰${practice.tray.iceMl}`);
    expect(field.textContent).toContain(`地面${practice.groundMl}`);
    expect(field.textContent).toContain(`能见${practice.weather.visibilityMetres}米`);
    expect(game.state.weatherWarlock.life.cases[caseId].attempts[0]!.evidence.failed).toBe(failed);
    expect(screen.getByRole("region", { name: "天气术士" }).textContent).toContain(failed ? "能力失败已保留" : "本次实际记录");
    expect(screen.queryByRole("button", { name: /^实际尝试本案一次局部天气/ })).toBeNull();
    expect(projectSliceState(game.state).weatherWarlock.actions.some(action => action.command.type === "CAST_WEATHER")).toBe(false);
    expect(game.submit).toHaveBeenCalledOnce();
  }, 20_000);

  it.each(["prepare-current-week", "fog-corridor-ability-outcome", "wind-rain-ability-outcome", "encounter-original-five"])("cannot escape the saved %s physical lock by returning to the menu and re-entering", async name => {
    const game = savedGame(boundary(name).final), before = structuredClone(game.state);
    expect(projectSliceState(game.state).weatherWarlock.insideCase).toBe(true);
    await mountGame(game);
    expect(screen.queryByRole("button", { name: "关闭天气术士页面" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^工作，1行动/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "返回主菜单" }));
    await continueRun(game);
    expect(screen.getByRole("region", { name: "天气术士" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "关闭天气术士页面" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^工作，1行动/ })).toBeNull();
    if (name.includes("ability-outcome")) {
      expect(screen.queryByRole("button", { name: /^实际尝试本案一次局部天气/ })).toBeNull();
      expect((screen.getByRole("combobox", { name: "选择天气术士生活情境" }) as HTMLSelectElement).disabled).toBe(true);
    }
    expect(game.state).toEqual(before);
    expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it("shows the practiced failed frost and storm history, original water and damaged fixture after closing and reopening", async () => {
    const game = savedGame(naturalCapture.practiced), before = structuredClone(game.state);
    await mountGame(game);
    for (const caseId of ["frost-tray", "wind-rain"] as const) {
      await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择天气术士生活情境" }), caseId);
      expect(screen.getByRole("region", { name: "天气术士" }).textContent).toContain("能力失败已保留");
      expect(game.state.weatherWarlock.life.cases[caseId].result).toBe("ORDINARY");
    }
    const field = screen.getByRole("region", { name: "实际水源与天气现场" });
    expect(field.textContent).toContain("原水箱2500毫升");
    expect(field.textContent).toContain("原盆2300");
    expect(field.textContent).toContain("原挡板沾水200毫升");
    expect(field.textContent).toContain("挡板已损坏，停止不修复");
    await userEvent.click(screen.getByText("原五人的实际资源", { selector: "summary" }));
    for (const member of before.ironBloodKnight.team.members.slice(0, 5)) {
      expect(screen.getByRole("region", { name: "天气术士" }).textContent).toContain(`${member.name} · ${member.id} · 健康${member.health}/100、精力${member.energy}/20`);
    }
    await userEvent.click(screen.getByRole("button", { name: "关闭天气术士页面" }));
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));
    expect(screen.getByRole("region", { name: "实际水源与天气现场" }).textContent).toContain("挡板已损坏，停止不修复");
    expect(game.state).toEqual(before);
    expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);


});
