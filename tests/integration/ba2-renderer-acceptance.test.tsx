/* @vitest-environment jsdom */

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { R2_FIXTURE_DEFAULT_SELECTION } from "../../src/content/r2-catalogue.js";
import { App } from "../../src/renderer/App";
import { MysteryGameBridge } from "../../src/simulation/browser-bridge.js";
import {
  CONTRACT_VERSION,
  type BridgeResult,
  type IntentEnvelope,
  type PublicGameState,
} from "../../src/shared/contracts.js";

function okValue<T>(result: BridgeResult<T>): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.value;
}

function createIntent(intentId: string): IntentEnvelope {
  return {
    contractVersion: CONTRACT_VERSION,
    intentId,
    runId: null,
    expectedRevision: 0,
    payload: {
      kind: "CREATE_CHARACTER_RUN",
      selection: {
        ...R2_FIXTURE_DEFAULT_SELECTION,
        appearanceDescription: "黑发，灰眼，衣着整洁。",
      },
    },
  };
}

function actionIntent(intentId: string, state: PublicGameState, action: "LEARN" | "INVESTIGATE"): IntentEnvelope {
  return {
    contractVersion: CONTRACT_VERSION,
    intentId,
    runId: state.runId,
    expectedRevision: state.revision,
    payload: { kind: "PERFORM_WEEKLY_ACTION", action },
  };
}

afterEach(() => {
  cleanup();
  delete window.mysteryGame;
});

describe("BA2 renderer and real browser bridge acceptance RED", () => {
  it("asks for a short appearance description without presenting portrait choices", async () => {
    window.mysteryGame = new MysteryGameBridge("ba2-ui-create-seed");
    render(<App />);

    expect(await screen.findByLabelText(/外貌描述/)).toBeTruthy();
    expect(screen.queryByText(/肖像/)).toBeNull();
  });

  it("submits learning on the first click and renders the committed date and knowledge record", async () => {
    const bridge = new MysteryGameBridge("ba2-ui-learn-seed");
    const created = okValue(await bridge.submitIntent(createIntent("ba2-ui-learn-create")));
    const knowledgeBefore = created.publicState.character.coreStats.knowledge;
    window.mysteryGame = bridge;
    render(<App />);

    expect((await screen.findAllByText(/第五纪.*1349年6月28日/)).length).toBeGreaterThan(0);
    expect(screen.getByText("黑发，灰眼，衣着整洁。")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "确认安排" })).toBeNull();
    expect(screen.queryByRole("button", { name: "再想想" })).toBeNull();

    await userEvent.setup().click(screen.getByRole("button", { name: /^学习/ }));
    let state: PublicGameState | null = null;
    await waitFor(async () => {
      state = okValue(await bridge.getBootstrap()).activeState;
      expect(state?.revision).toBeGreaterThan(created.publicState.revision);
    });
    expect(state).not.toBeNull();
    expect(state!.character.coreStats.knowledge).toBeGreaterThan(knowledgeBefore);
    const record = state!.knowledgeRecords.at(-1);
    expect(record).toBeDefined();
    expect(await screen.findByText(record!.title)).toBeTruthy();
  });

  it("renders and resolves the deterministic investigation event without spending another action", async () => {
    const bridge = new MysteryGameBridge("ba2-ui-event-seed");
    const created = okValue(await bridge.submitIntent(createIntent("ba2-ui-event-create")));
    const investigated = okValue(await bridge.submitIntent(actionIntent(
      "ba2-ui-investigate",
      created.publicState,
      "INVESTIGATE",
    )));
    const event = investigated.publicState.activeEvent;
    expect(event).not.toBeNull();
    const availableActions = investigated.publicState.availableActions;
    window.mysteryGame = bridge;
    render(<App />);

    const dialog = await screen.findByRole("dialog", { name: event!.title });
    expect(dialog.textContent).toContain(event!.body);
    const choice = event!.choices.find((candidate) => candidate.unavailableReason === undefined);
    expect(choice).toBeDefined();
    const choiceButton = within(dialog).getAllByRole("button")
      .find((button) => button.textContent?.startsWith(choice!.label));
    expect(choiceButton).toBeDefined();
    await userEvent.setup().click(choiceButton!);

    let state: PublicGameState | null = null;
    await waitFor(async () => {
      state = okValue(await bridge.getBootstrap()).activeState;
      expect(state?.activeEvent).toBeNull();
    });
    expect(state!.availableActions).toBe(availableActions);
    expect(state!.lastEventResolution?.eventInstanceId).toBe(event!.eventInstanceId);
    expect((await screen.findAllByText(state!.lastEventResolution!.title)).length).toBeGreaterThan(0);
  });
});
