/* @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { projectSliceState } from "../../src/domain/slice";
import { migrateSliceState } from "../../src/domain/slice/migration";
import type { SliceProjection } from "../../src/domain/slice/types";
import { SliceApp } from "../../src/renderer/SliceApp";
import type { SliceBridge } from "../../src/shared/slice-contracts";

// Each row names a distinct pathway and its saved peaceful S4 checkpoint (Door uses explicitly directed promotion).
// Never patch a fixture or public projection to make navigation reachable.
const routes = [
  [
    "diviner",
    "bizarroSorcerer",
    "诡法师",
    "bizarro-sorcerer-v01170"
  ],
  [
    "hunter",
    "ironBloodKnight",
    "铁血骑士",
    "iron-blood-knight-v01180"
  ],
  [
    "audience",
    "manipulator",
    "操纵师",
    "manipulator-v01190"
  ],
  [
    "paragon",
    "alchemist",
    "炼金术士",
    "alchemist-v01200"
  ],
  [
    "moon",
    "witchKing",
    "巫王",
    "witch-king-v01210"
  ],
  [
    "darkness",
    "nightwatcher",
    "守夜人",
    "nightwatcher-v01220"
  ],
  [
    "white-tower",
    "prophet",
    "预言家",
    "prophet-v01230"
  ],
  [
    "tyrant",
    "cataclysmPriest",
    "灾难主祭",
    "cataclysm-priest-v01240"
  ],
  [
    "sun",
    "unshadowed",
    "无暗者",
    "unshadowed-v01250"
  ],
  [
    "death",
    "undying",
    "不死者",
    "undying-v01260"
  ],
  [
    "door",
    "secretsSorcerer",
    "秘法师",
    "secrets-sorcerer-v01270"
  ],
  [
    "error",
    "parasite",
    "寄生者",
    "parasite-v01280"
  ],
  [
    "warrior",
    "demonHunter",
    "猎魔者",
    "demon-hunter-v01290"
  ],
  [
    "demoness",
    "despair",
    "绝望魔女",
    "despair-v01300"
  ],
  [
    "hermit",
    "mystic",
    "神秘学家",
    "mystic-v01310"
  ],
  [
    "hanged-man",
    "blackKnight",
    "黑骑士",
    "black-knight-v01320"
  ],
  [
    "abyss",
    "devil",
    "魔鬼",
    "devil-v01330"
  ],
  [
    "chained",
    "puppet",
    "木偶",
    "puppet-v01340"
  ],
  [
    "wheel",
    "misfortuneMage",
    "厄运法师",
    "misfortune-mage-v01350"
  ],
  [
    "black-emperor",
    "fallenEarl",
    "堕落伯爵",
    "fallen-earl-v01360"
  ],
  [
    "justiciar",
    "imperativeMage",
    "律令法师",
    "imperative-mage-v01370"
  ],
  [
    "mother",
    "ancientAlchemist",
    "古代炼金师",
    "ancient-alchemist-v01380"
  ]
] as const;

function practicedProjection(folder: string): SliceProjection {
  const capture = JSON.parse(readFileSync(`tests/fixtures/${folder}/${folder === "secrets-sorcerer-v01270" ? "directed" : "natural"}.json`, "utf8"));
  return projectSliceState(migrateSliceState(capture.practiced));
}

function bridge(state: SliceProjection): SliceBridge {
  return {
    getBootstrap: vi.fn(async () => ({
      ok: true as const,
      value: {
        mode: "browser" as const,
        activeState: state,
        runs: [{
          runId: state.runId,
          name: state.character.name,
          portraitId: state.character.portraitId,
          week: state.week,
          date: state.date,
          status: state.status,
          revision: state.revision,
          updatedAt: "2026-10-12T00:00:00Z",
        }],
      },
    })),
    loadRun: vi.fn(async () => ({ ok: true as const, value: state })),
    submitIntent: vi.fn(),
  };
}

async function enter(state: SliceProjection, api: SliceBridge) {
  window.sliceGame = api;
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole("button", { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole("button", {
    name: (name) => name.includes(state.character.name),
  }));
  await screen.findByRole("heading", { name: "人物卷宗" });

  // Some saved peaceful checkpoints still retain the previous combat receipt.
  // Dismiss it through the real UI instead of clearing saved state in the test.
  const reveal = screen.queryByRole("dialog", { name: "战斗回合结果" });
  if (reveal) {
    await userEvent.click(within(reveal).getByRole("button", { name: "返回生活" }));
  }
}

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  delete window.sliceGame;
  vi.restoreAllMocks();
});

describe("All 22 S4 original captures, including explicitly directed Door through SliceApp navigation", () => {
  it.each(routes)("opens %s / %s current S4 growth without submitting an intent", async (pathwayId, key, name, folder) => {
    const state = practicedProjection(folder);
    expect(state.progression).toMatchObject({ pathwayId, sequence: 4 });
    expect(state.status).toBe("ACTIVE");
    expect(state.activeEvent).toBeNull();
    expect(state.combat).toBeNull();
    expect(state[key].promoted).toBe(true);
    expect(state[key].title).toContain(name);

    const api = bridge(state);
    await enter(state, api);
    expect(api.loadRun).toHaveBeenCalledExactlyOnceWith(state.runId);
    await userEvent.click(screen.getByRole("button", { name: /非凡成长/ }));

    const growth = within(screen.getByRole("dialog", { name: "非凡成长" }));
    const currentPanel = growth.getByRole("region", { name: `${name}成长下一步` });
    expect(within(currentPanel).getByRole("heading", { name: state[key].title })).toBeTruthy();
    const choices = within(growth.getByRole("group", { name: "选择成长卷宗" }));
    const currentTab = choices.getByRole("button", { name: `${name}成长` });
    expect(choices.getAllByRole("button", { pressed: true })).toEqual([currentTab]);
    await userEvent.click(screen.getByRole("button", { name: "关闭非凡成长" }));
    expect(screen.queryByRole("dialog", { name: "非凡成长" })).toBeNull();
    expect(api.submitIntent).not.toHaveBeenCalled();
  });
});
