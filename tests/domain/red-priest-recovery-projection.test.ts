import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { SLICE_LIFE } from '../../src/content/slice-events.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { applySliceIntent, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createRedPriestCampaign, getRedPriestCampaignTravelWeeks } from '../../src/domain/red-priest/campaign.js';
import { RED_PRIEST_CAMPAIGN_COALITION, RED_PRIEST_CAMPAIGN_LEGIONS } from '../../src/domain/red-priest/campaign-content.js';
import { projectRedPriest, redPriestCampaignReadiness, redPriestCommandBlock, validateRedPriestCommand } from '../../src/domain/red-priest/index.js';
import { openRedPriestRuntimeSession, type RedPriestRuntimeSession } from '../../src/domain/red-priest/owned-session.js';
import { RED_PRIEST_FROZEN_SOURCE_KEYS } from '../../src/domain/red-priest/source.js';
import type { RedPriestCommand } from '../../src/domain/red-priest/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';

const FOOT = { type: 'RETURN_ON_FOOT' } as const;
const ARMISTICE = { type: 'CAMPAIGN', command: { type: 'SEEK_ARMISTICE' } } as const;
const SOURCE = 'tests/fixtures/conqueror-v01870/natural.json';
// Immutable observation of the actual 974-command run, not a producer rerun or
// a rewritten legal state. Only the final reviewed fixture location is read.
const OBSERVATION = 'tests/fixtures/red-priest-v02090/original983/prior-observation/natural.json';
const OBSERVATION_SHA = 'f8017e64be594512cce88c7c2c2ff0e25a001fa4943e15a1880ea9f034e1d7e3';
const intent = (command: RedPriestCommand): SliceIntent => ({ type: 'RED_PRIEST', command });
const same = (actual: unknown, expected: unknown): void => { expect(stableStringify(actual)).toBe(stableStringify(expected)); };
const fileHash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const debtTotal = (s: SliceState) => s.debts.reduce((sum, debt) => sum + debt.remaining, 0);
const footAction = (session: RedPriestRuntimeSession) => session.projectRedPriest().actions.find(a => a.command.type === 'RETURN_ON_FOOT');

function act(session: RedPriestRuntimeSession, command: RedPriestCommand): SliceState {
  const action = session.projectRedPriest().actions.find(a => stableStringify(a.command) === stableStringify(command));
  expect(action, `Missing public action ${stableStringify(command)}`).toBeDefined();
  expect(action!.enabled, action!.reason ?? action!.label).toBe(true);
  const draft = session.prepare(intent(action!.command), session.inspect().revision);
  session.commit(draft);
  return session.snapshot();
}
function reject(session: RedPriestRuntimeSession, command: RedPriestCommand): void {
  const before = session.snapshot();
  expect(() => session.prepare(intent(command), before.revision)).toThrow();
  same(session.snapshot(), before);
}

// Projection-only examples deliberately vary visible quantities. They are not
// captured saves, never enter a runtime, and do not claim verified war outcomes.
function readinessExample(personnel = 2600, reserves = 0) {
  const campaign = createRedPriestCampaign('readiness-example', 200);
  campaign.location = 'northern-pass';
  for (const legion of RED_PRIEST_CAMPAIGN_LEGIONS.filter(l => l.role === 'FIELD'))
    campaign.legions[legion.id].personnel = personnel;
  for (const polity of RED_PRIEST_CAMPAIGN_COALITION) campaign.polities[polity].reservePersonnel = reserves;
  return campaign;
}

describe('Red Priest finite recovery public projection', () => {
  it('derives actual will/shortage chances without changing the source or exposing private random state', () => {
    const full = readinessExample(), before = stableStringify(full);
    const lines = redPriestCampaignReadiness(full, 29);
    expect(lines[0]).toContain('现有原军7800人');
    expect(lines[1]).toContain('最多损失1800现员');
    expect(lines[2]).toContain('至少需现有5160人');
    expect(lines.at(-1)).toContain('本次会战成功率为24%');
    expect(lines.at(-1)).toContain('额外等待不会重抽或保证成功');
    same(redPriestCampaignReadiness(full, 29), lines);
    expect(stableStringify(full)).toBe(before);
    expect(lines.join('\n')).not.toMatch(/seed|cursor|digest|receipt|\broll\b/i);
    expect(redPriestCampaignReadiness(readinessExample(2000), 29).at(-1)).toContain('成功率为18%');
    expect(redPriestCampaignReadiness(full, 0).at(-1)).toContain('成功率为5%');
    expect(redPriestCampaignReadiness(full, 500).at(-1)).toContain('成功率为95%');
    const headquarters = createRedPriestCampaign('no-current-battle', 200);
    expect(redPriestCampaignReadiness(headquarters, 29).some(line => line.includes('成功率'))).toBe(false);
  });

  it('warns at the finite all-win threshold and distinguishes an already-impossible army from one more defeat', () => {
    const safe = redPriestCampaignReadiness(readinessExample(), 29).join('\n');
    const vulnerable = redPriestCampaignReadiness(readinessExample(2000), 29).join('\n');
    const exactMinimum = redPriestCampaignReadiness(readinessExample(1720), 29).join('\n');
    const exhausted = redPriestCampaignReadiness(readinessExample(1719), 29).join('\n');
    expect(safe).not.toContain('不足以完成剩余目标');
    expect(vulnerable).toContain('再败一次将不足以完成剩余目标');
    expect(vulnerable).toContain('死者和伤员不能靠休整返还');
    expect(exactMinimum).toContain('再败一次将不足以完成剩余目标');
    expect(exactMinimum).not.toContain('现有人员已经不足');
    expect(exhausted).toContain('现有人员已经不足以完成剩余目标');
    expect(exhausted).not.toContain('再败一次将不足');
    expect(exhausted).toContain('可以真实停战或保护撤离');
    expect(redPriestCampaignReadiness(readinessExample(1719, 300), 29).join('\n')).not.toContain('现有人员已经不足');
  });

  it('accepts only the top-level foot-return intent and rejects caller-controlled travel, money, armies and evidence', () => {
    expect(validateRedPriestCommand(FOOT)).toBe(true);
    expect(validateSlicePayload(intent(FOOT))).toBe(true);
    for (const command of [
      { ...FOOT, to: 'loen-headquarters' }, { ...FOOT, from: 'northern-pass' },
      { ...FOOT, weeks: 0 }, { ...FOOT, cash: 0 }, { ...FOOT, cashGain: 60 },
      { ...FOOT, actions: 0 }, { ...FOOT, personnel: 9000 }, { ...FOOT, receipt: {} },
      { ...FOOT, result: 'SUCCESS' }, { type: 'CAMPAIGN', command: FOOT },
    ]) {
      expect(validateRedPriestCommand(command)).toBe(false);
      expect(validateSlicePayload({ type: 'RED_PRIEST', command })).toBe(false);
    }
  });

  it('keeps original795 and real guided/crisis/withdrawn headquarters states closed to remote foot return', () => {
    const prior = migrateSliceState(readObjectEntry<unknown>(SOURCE, 'final'));
    const before = stableStringify(prior);
    expect(redPriestCommandBlock(prior, FOOT)).not.toBeNull();
    expect(projectRedPriest(prior).actions.some(a => a.command.type === 'RETURN_ON_FOOT')).toBe(false);
    expect(() => applySliceIntent(prior, intent(FOOT))).toThrow();
    expect(stableStringify(prior)).toBe(before);
    const guided = applySliceIntent(prior, intent({ type: 'LEARN_GUIDANCE' }));
    const session = openRedPriestRuntimeSession(guided);
    expect(session.snapshot().redPriest.campaign!.phase).toBe('CRISIS');
    expect(footAction(session)).toBeUndefined(); reject(session, FOOT);
    const withdrawn = act(session, { type: 'CAMPAIGN', command: { type: 'WITHDRAW_PROTECT' } });
    expect(withdrawn.redPriest.campaign!.phase).toBe('WITHDRAWN');
    expect(withdrawn.redPriest.frame!.location).toBe('loen-headquarters');
    expect(footAction(session)).toBeUndefined(); reject(session, FOOT);
  }, 90_000);

  it('continues exact974 through actual armistice checks, zero-cash living costs and a conserved foot return', () => {
    if (!existsSync(OBSERVATION)) throw Error(`PENDING: final reviewed exact974 fixture required at ${OBSERVATION}; this integration has not run.`);
    expect(fileHash(OBSERVATION)).toBe(OBSERVATION_SHA);
    try {
      expect(readObjectEntry<unknown[]>(OBSERVATION, 'commands')).toHaveLength(974);
      const raw = readObjectEntry<unknown>(OBSERVATION, 'final'), rawHash = stableStringify(raw);
      const original = migrateSliceState(raw);
      expect(stableStringify(raw), 'Migration preserves the raw historical974 input').toBe(rawHash);
      expect([original.schemaVersion, original.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
      expect(original).toMatchObject({ revision: 975, week: 280, cash: 1566, status: 'ACTIVE',
        random: { seed: 'hunter-rebuild-first', cursor: 426 }, progression: { pathwayId: 'hunter', sequence: 1 } });
      const session = openRedPriestRuntimeSession(original);
      expect(original.redPriest.campaign!.phase).toBe('WAR');
      expect(footAction(session)).toBeUndefined(); reject(session, FOOT);
      const readiness = session.projectRedPriest().sections.find(s => s.id === 'campaign-readiness');
      expect(readiness?.lines).toEqual(redPriestCampaignReadiness(original.redPriest.campaign!, original.character.coreStats.will));
      expect(readiness?.lines.join('\n')).toContain('再败一次将不足以完成剩余目标');

      let state = original, attempts = 0;
      // No outcome/receipt injection and no seed or cursor search. Each failed
      // negotiation consumes its real check, fee and ordinary elapsed week.
      while (state.redPriest.campaign!.phase === 'WAR' && attempts < 24) {
        const before = state;
        state = act(session, ARMISTICE); attempts++;
        expect(state.random).toEqual({ seed: before.random.seed, cursor: before.random.cursor + 1 });
        expect(state.week).toBe(before.week + 1);
        expect(state.redPriest.journal.at(-1)!.randomReceipts).toHaveLength(1);
      }
      expect(state.redPriest.campaign!.phase, `No actual armistice after ${attempts} bounded attempts`).toBe('ARMISTICE');
      expect(attempts).toBeGreaterThan(0);
      expect(state.redPriest.campaign!.location).toBe('northern-pass');
      expect(footAction(session)?.enabled).toBe(true);
      expect(session.projectRedPriest().sections.some(s => s.id === 'campaign-readiness')).toBe(false);
      const truceRandom = structuredClone(state.random), truceArmy = structuredClone(state.redPriest.campaign!.legions);

      // Exhaust real AP rather than editing a legal capture to manufacture the
      // gate. Rest cannot supply the unavailable foot-return action for free.
      while (state.actionsRemaining > 0) state = act(session, { type: 'REST' });
      expect(footAction(session)?.enabled).toBe(false); reject(session, FOOT);
      const waitLimit = Math.ceil(state.cash / SLICE_LIFE.DESTITUTE.cost) + 1;
      let waits = 0;
      do {
        state = act(session, { type: 'NEXT_WEEK' });
        expect(++waits).toBeLessThanOrEqual(waitLimit);
      } while (state.cash > 0);
      // A full unpaid week also guarantees pre-existing unpaid principal, so
      // walking tests old debt preservation as well as new living obligations.
      state = act(session, { type: 'NEXT_WEEK' });
      expect(state.cash).toBe(0); expect(debtTotal(state)).toBeGreaterThan(0);
      while (state.actionsRemaining > 1) state = act(session, { type: 'REST' });
      expect(state.actionsRemaining).toBe(1);
      same(state.random, truceRandom); same(state.redPriest.campaign!.legions, truceArmy);
      const walk = footAction(session)!;
      expect(walk).toMatchObject({ enabled: true, reason: null, preferredAction: true });
      expect(walk.cost).toContain('1行动、2周');
      expect(walk.cost).toContain('不预付车费');
      const paidReturn = { type: 'TRAVEL', to: 'loen-headquarters' } as const;
      expect(session.projectRedPriest().actions.find(a => stableStringify(a.command) === stableStringify(paidReturn))?.enabled).toBe(false);
      reject(session, paidReturn);

      const before = state, from = before.redPriest.frame!.location;
      const weeks = 2 * getRedPriestCampaignTravelWeeks('northern-pass', 'loen-headquarters');
      state = act(session, FOOT);
      expect(weeks).toBe(2); expect(state.revision).toBe(before.revision + 1);
      expect(state.week).toBe(before.week + weeks); same(state.date, addGameWeeks(before.date, weeks));
      same(state.redPriest.frame!.budget, { ...before.redPriest.frame!.budget,
        week: before.week + weeks, date: addGameWeeks(before.date, weeks), actions: before.weeklyBudget });
      expect(state.redPriest.frame!.location).toBe('loen-headquarters');
      expect(state.redPriest.frame!.nowSecond).toBe(before.redPriest.frame!.nowSecond + weeks * 604800);
      expect(state.cash).toBe(0); expect(state.wagePaidWeek).toBe(before.wagePaidWeek);
      same(state.random, truceRandom); same(state.character, before.character); same(state.progression, before.progression);
      same(state.injuries, before.injuries); same(state.redPriest.source, original.redPriest.source);
      for (const key of RED_PRIEST_FROZEN_SOURCE_KEYS) same(state[key], original[key]);
      same(state.world, original.world); same(state.combatHistory, original.combatHistory);
      const { week: _week, revision: _revision, journal: _journal, ...armyBefore } = before.redPriest.campaign!;
      const { week: armyWeek, revision: armyRevision, journal: armyJournal, ...armyAfter } = state.redPriest.campaign!;
      same(armyAfter, armyBefore); expect(armyWeek).toBe(state.week);
      expect(armyRevision).toBe(before.redPriest.campaign!.revision + 1);
      same(armyJournal.slice(0, -1), before.redPriest.campaign!.journal);
      expect(armyJournal.at(-1)!.command).toEqual({ type: 'HOST_ADVANCE', toWeek: state.week });
      expect(state.redPriest.campaign!.location).toBe(from);

      // Zero cash means no old principal can be repaid, and each real walking
      // week creates exactly the ordinary destitute bill as new principal.
      same(state.debts.slice(0, before.debts.length), before.debts);
      const addedDebts = state.debts.slice(before.debts.length);
      expect(addedDebts).toHaveLength(weeks);
      expect(addedDebts.map(d => ({ source: d.source, remaining: d.remaining, weeklyPayment: d.weeklyPayment, createdWeek: d.createdWeek })))
        .toEqual(Array.from({ length: weeks }, (_, index) => ({ source: '生活应付款', remaining: SLICE_LIFE.DESTITUTE.cost,
          weeklyPayment: 30, createdWeek: before.week + index })));
      expect(debtTotal(state)).toBe(debtTotal(before) + weeks * SLICE_LIFE.DESTITUTE.cost);
      expect(state.missedWeeks).toBe(before.missedWeeks + weeks);
      expect(state.lifeTier).toBe('DESTITUTE'); expect(state.nextLifeTier).toBe('DESTITUTE');
      expect(state.credit).toBe(state.missedWeeks >= 4 ? 'SUSPENDED' : state.missedWeeks >= 2 ? 'NOTICE' : before.credit);
      same(state.redPriest.frame!.finance, { ...before.redPriest.frame!.finance,
        debts: state.debts, missedWeeks: state.missedWeeks, credit: state.credit });
      const event = state.redPriest.journal.at(-1)!;
      expect(event.command).toEqual(FOOT); expect(event.randomReceipts).toEqual([]); expect(event.campaignHost).toBeNull();
      expect(event.financeReceipts.filter(r => r.text.includes('计欠'))).toHaveLength(weeks);
      expect(event.financeReceipts.filter(r => r.title === '本周约定还款')).toHaveLength(weeks);
      same(state.redPriest.journal.slice(0, -1), before.redPriest.journal);
      same(state.redPriest.materials!.items, before.redPriest.materials!.items.map(item => ({ ...item, locationId: 'loen-headquarters' })));
      same(state.redPriest.materials!.compounds, before.redPriest.materials!.compounds);
      same(state.redPriest.materials!.journal.slice(0, -1), before.redPriest.materials!.journal);
      expect(event.materialReceipt).toMatchObject({ kind: 'TRANSPORT', cost: { cash: 0, actions: 0, spirituality: 0 },
        transport: { fromLocationId: from, toLocationId: 'loen-headquarters', departedWeek: before.week, arrivedWeek: state.week,
          carried: before.redPriest.materials!.items.map(item => ({ itemId: item.id, containerId: item.containerId })) } });
      expect(footAction(session)).toBeUndefined(); reject(session, FOOT);

      // The same old camp remains visible at zero cash, with its actual
      // resource block, then becomes reachable after real headquarters work.
      const campCommand = { type: 'TRAVEL', to: from } as const;
      const campBeforeWork = session.projectRedPriest().actions.filter(a => stableStringify(a.command) === stableStringify(campCommand));
      expect(campBeforeWork).toHaveLength(1);
      expect(campBeforeWork[0]).toMatchObject({ enabled: false });
      expect(campBeforeWork[0]!.reason).toBeTruthy();
      reject(session, campCommand);
      const worked = act(session, { type: 'WORK' });
      expect(worked.cash).toBe(state.cash + state.character.weeklyWage);
      state = act(session, { type: 'TRAVEL', to: from });
      expect(state.redPriest.frame!.location).toBe(from);
      expect(session.projectRedPriest().actions.some(a => stableStringify(a.command) === stableStringify(campCommand))).toBe(false);
      expect(state.week).toBe(worked.week + weeks / 2);
      expect(state.cash).toBeLessThan(worked.cash - 10);
      same(state.redPriest.campaign!.legions, truceArmy); same(state.random, truceRandom);
      expect(state.redPriest.materials!.items.every(item => item.locationId === from)).toBe(true);
      // Strict reopening verifies the complete unedited original prefix and
      // every newly executed check, debt, AP and original-item movement.
      same(openRedPriestRuntimeSession(state).snapshot(), state);
    } finally {
      expect(fileHash(OBSERVATION)).toBe(OBSERVATION_SHA);
    }
  }, 600_000);
});
