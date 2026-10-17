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

describe('Weather Warlock combat controls', () => {
  it.each(["combat-first", "combat-terminal"])("uses the existing six-slot battle and saves the actual %s round with explicit original-team policy", async name => {
    const captured = boundary(name), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    if (captured.lastIntent.type !== "COMBAT_ROUND") throw new Error("Expected an actual captured combat round.");
    const intent = captured.lastIntent, battle = projectSliceState(game.state).combat!;
    await mountGame(game);
    const stage = screen.getByRole("dialog", { name: battle.title ?? "普通人追击" });
    expect(battle.weatherWarlock?.targetId).toBe("WW2-ORREN-VOSS");
    expect(battle.playerCountWheel).toHaveLength(6);
    expect(battle.enemyCountWheel).toHaveLength(6);
    expect(stage.textContent).toContain("双方原六槽");
    expect(stage.textContent).toContain("40升原水有限不补");
    expect((within(stage).getByRole("radio", { name: "本回合保留" }) as HTMLInputElement).checked).toBe(true);
    expect(within(stage).getAllByRole("radio")).toHaveLength(2);
    await userEvent.click(within(stage).getByText("查看公开轮盘与风险", { selector: "summary" }));
    const playerWheel = within(stage).getByText(/^你的能力盘：/);
    for (const entry of battle.playerAbilityWheel) expect(playerWheel.textContent).toContain(entry.label);
    const enemyWheel = within(stage).getByText(/^对手能力盘：/);
    for (const entry of battle.enemyAbilityWheel) expect(enemyWheel.textContent).toContain(entry.label);
    if (intent.warBishopPolicy === "LINK_IF_READY") await userEvent.click(within(stage).getByRole("radio", { name: "条件满足时联结（本人5灵性、原五人各2精力）" }));
    const stance = battle.stances.find(s => s.id === intent.stance)!;
    await userEvent.click(within(stage).getByRole("button", { name: name => name.startsWith(stance.label) }));
    expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(stage).getByRole("button", { name: "确认姿态，结算完整回合" }));
    await waitFor(() => expect(game.state.revision).toBe(before.revision + 1));
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: before.runId,
      expectedRevision: before.revision, payload: captured.lastIntent });
    assertPreservedOlderPeople(before, game.state);
    expect(game.state.lastCombatRound?.weatherWarlockOutcome?.source.revision).toBe(before.revision);
    const result = await screen.findByRole("dialog", { name: "战斗回合结果" });
    expect(within(result).getByRole("heading", { name: `第 ${before.combat!.round} 回合结果` })).toBeTruthy();
    if (game.state.combat) {
      await userEvent.click(within(result).getByRole("button", { name: "进入下一回合" }));
      const next = screen.getByRole("dialog", { name: battle.title ?? "普通人追击" });
      expect((within(next).getByRole("radio", { name: "本回合保留" }) as HTMLInputElement).checked).toBe(true);
      expect((within(next).getByRole("radio", { name: "条件满足时联结（本人5灵性、原五人各2精力）" }) as HTMLInputElement).checked).toBe(false);
    } else {
      await userEvent.click(within(result).getByRole("button", { name: "返回生活" }));
      const close = screen.queryByRole("button", { name: "关闭天气术士页面" }); if (close) await userEvent.click(close);
      expect(screen.getByRole("heading", { name: "人物卷宗" })).toBeTruthy();
      expect(game.state.weatherWarlock.encounter.enemyStatus).toBe("SURRENDERED");
      expect(game.state.weatherWarlock.encounter.enemySpirituality).toBe(76);
      expect(game.state.weatherWarlock.encounter.terrain.waterLitres).toBe(36);
      expect(game.state.weatherWarlock.encounter.terrain.fixtureDamage).toBe(1);
    }
  }, 20_000);

  it("performs actual ordinary work after the saved exit without resetting the enemy, original people or field failures", async () => {
    const captured = boundary("ordinary-life-after-exit"), game = savedGame(captured.beforeLast), before = structuredClone(game.state);
    await mountGame(game, false);
    await userEvent.click(screen.getByRole("button", { name: /^工作，1行动/ }));
    await waitFor(() => expect(game.state.revision).toBe(before.revision + 1));
    expect(game.state).toEqual(migrateSliceState(captured.final));
    expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: before.runId,
      expectedRevision: before.revision, payload: captured.lastIntent });
    expect(game.state.weatherWarlock).toEqual(before.weatherWarlock);
    expect(game.state.warBishop).toEqual(before.warBishop);
    expect(game.state.ironBloodKnight).toEqual(before.ironBloodKnight);
    expect(game.state.combatHistory).toEqual(before.combatHistory);
    expect(game.state.status).toBe("ACTIVE");
  }, 20_000);
});
