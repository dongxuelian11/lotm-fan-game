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

interface NaturalCapture {
  prefixCount: number;
  commands: SliceIntent[];
  guidanceStart: unknown;
  promoted: unknown;
  practiced: unknown;
  combatStart: unknown;
  final: unknown;
}
interface Boundary { beforeLast: unknown; lastIntent: SliceIntent; final: unknown }
// Immutable real public-command captures. Never patch resources, RNG, people, qualifications or original objects.
const naturalCapture = JSON.parse(readFileSync("tests/fixtures/weather-warlock-v01650/natural.json", "utf8")) as NaturalCapture;
// Load one actual boundary at a time; retaining all 25 decoded histories exceeds the bounded UI worker heap.
function boundary(name: string): Boundary {
  const captured = readObjectEntry<Boundary>("tests/fixtures/weather-warlock-v01650/boundaries.json", name);
  if (!captured) throw new Error(`Missing actual Weather Warlock boundary: ${name}`);
  return captured;
}
function capturedCommand(captured: Boundary): WeatherWarlockCommand {
  if (captured.lastIntent.type !== "WEATHER_WARLOCK") throw new Error("Expected an actual Weather Warlock command.");
  return captured.lastIntent.command;
}
function savedGame(input: unknown, options: { failFirstSave?: boolean; deferFirstSave?: boolean } = {}) {
  let state = migrateSliceState(input), attempts = 0;
  assertValidSliceState(state);
  let releaseFirstSave = () => {};
  const firstSave = new Promise<void>(resolve => { releaseFirstSave = resolve; });
  const submit: SliceBridge["submitIntent"] = vi.fn(async envelope => {
    if (envelope.payload.type === "CREATE") throw new Error("This original run already exists.");
    const attempt = attempts++;
    if (attempt === 0 && options.deferFirstSave) await firstSave;
    if (attempt === 0 && options.failFirstSave) {
      return { ok: false as const, error: { code: "SAVE_FAILED", message: "本次原操作尚未保存", retryable: true } };
    }
    state = applySliceIntent(state, envelope.payload);
    assertValidSliceState(state);
    return { ok: true as const, value: {
      intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
      newRevision: state.revision, committedAt: "2026-10-13T22:00:00Z", replayed: false,
      state: projectSliceState(state),
    } };
  });
  return { get state() { return state; }, submit, releaseFirstSave };
}
type SavedGame = ReturnType<typeof savedGame>;
async function acknowledgeSavedRound() {
  const result = screen.queryByRole("dialog", { name: "战斗回合结果" });
  if (result) await userEvent.click(within(result).getByRole("button", { name: /^(返回生活|进入下一回合|查看收尾卷宗)$/ }));
}
async function continueRun(game: SavedGame) {
  const state = projectSliceState(game.state);
  await userEvent.click(await screen.findByRole("button", { name: state.status === "DEAD" ? /查看封存/ : /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(screen.queryByRole("heading", { name: "人物卷宗" })
    ?? screen.queryByRole("region", { name: "天气术士" })
    ?? screen.queryByRole("dialog", { name: "战斗回合结果" })
    ?? (state.ending ? screen.queryByRole("heading", { name: state.ending.title }) : null)).toBeTruthy());
  // S2 loading keeps old history but must not re-present the former S3 battle as current.
  if (state.weatherWarlock.promoted && state.lastCombatRound && !state.lastCombatRound.weatherWarlockOutcome) {
    expect(screen.queryByRole("dialog", { name: "战斗回合结果" })).toBeNull();
  }
  // Acknowledge current-route saved outcomes through the UI rather than erasing history.
  await acknowledgeSavedRound();
  if (state.ending) await screen.findByRole("heading", { name: state.ending.title });
  else if (state.combat) await screen.findByRole("dialog", { name: state.combat.title ?? "普通人追击" });
  else if (state.weatherWarlock.insideCase) await screen.findByRole("region", { name: "天气术士" });
  else await screen.findByRole("heading", { name: "人物卷宗" });
}
async function mountGame(game: SavedGame, openWeather = true) {
  const state = projectSliceState(game.state);
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge["getBootstrap"]>(async () => ({ ok: true, value: { mode: "browser", activeState: state, runs: [{
      runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
      week: state.week, date: state.date, status: state.status, revision: state.revision,
      updatedAt: "2026-10-13T21:59:00Z",
    }] } })),
    loadRun: vi.fn<SliceBridge["loadRun"]>(async () => ({ ok: true, value: projectSliceState(game.state) })),
    submitIntent: game.submit,
  };
  render(<SliceApp />);
  await continueRun(game);
  if (openWeather && !state.ending && !screen.queryByRole("region", { name: "天气术士" })) {
    await userEvent.click(screen.getByRole("button", { name: "天气术士与有限天气" }));
    await screen.findByRole("region", { name: "天气术士" });
  }
}
function actionButton(state: SliceState, command: WeatherWarlockCommand): HTMLButtonElement {
  const action = projectSliceState(state).weatherWarlock.actions.find(entry =>
    Object.entries(command).every(([key, value]) => (entry.command as unknown as Record<string, unknown>)[key] === value));
  if (!action) throw new Error(`Missing actual public Weather Warlock action: ${JSON.stringify(command)}`);
  return screen.getByRole("button", { name: name => name.startsWith(action.label) }) as HTMLButtonElement;
}
async function selectCommandObject(command: WeatherWarlockCommand) {
  if ("bottleId" in command) await userEvent.selectOptions(screen.getByRole("combobox", { name: "选择天气术士原瓶" }), command.bottleId);
  if ("caseId" in command) {
    const select = screen.getByRole("combobox", { name: "选择天气术士生活情境" }) as HTMLSelectElement;
    if (!select.disabled && select.value !== command.caseId) await userEvent.selectOptions(select, command.caseId);
  }
}
async function settled() {
  await waitFor(() => expect(screen.getByRole("region", { name: "天气术士" }).getAttribute("aria-busy")).toBe("false"));
}
function assertPreservedOlderPeople(before: SliceState, after: SliceState) {
  expect(after.character.gender).toBe(before.character.gender);
  expect(after.warBishop).toEqual(before.warBishop);
  expect(after.ironBloodKnight.encounter).toEqual(before.ironBloodKnight.encounter);
  expect(after.ironBloodKnight.team.members.slice(5)).toEqual(before.ironBloodKnight.team.members.slice(5));
}
const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
afterEach(() => {
  cleanup(); delete window.sliceGame; vi.restoreAllMocks();
  if (originalShowModal) Object.defineProperty(HTMLDialogElement.prototype, "showModal", originalShowModal);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  if (originalClose) Object.defineProperty(HTMLDialogElement.prototype, "close", originalClose);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});


export { boundary, capturedCommand, savedGame, acknowledgeSavedRound, continueRun, mountGame, actionButton, selectCommandObject, settled, assertPreservedOlderPeople, naturalCapture };
