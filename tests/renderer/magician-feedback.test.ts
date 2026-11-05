import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation';
import { createSliceRun, projectSliceState } from '../../src/domain/slice';
import { applyMagicianPractice } from '../../src/domain/magician/practice';
import type { MagicianActivityCommand } from '../../src/domain/magician/types';
import type { SliceRecord } from '../../src/domain/slice/types';
import type { SliceEnvelope, SliceReceipt } from '../../src/shared/slice-contracts';
import { resolveNormalCheck } from '../../src/resolution/normal-check';
import { magicianCheckFeedback } from '../../src/renderer/seer-feedback';

const practiceIds = ['lamplit-step', 'air-target', 'consenting-audience', 'shallow-water', 'loose-rope', 'paper-weapon'];
// Synthetic unit receipt, not a player save or a claim of native playthrough.
function capture(id = 'lamplit-step', roll = 40) {
  const raw = createSliceRun('magician-renderer-unit', sliceDefaultCreationSelection, 'feedback');
  raw.activeEvent = null; raw.eventQueue = []; raw.actionsRemaining = 3;
  raw.world.city = 'BACKLUND'; raw.progression.pathwayId = 'diviner'; raw.progression.sequence = 7;
  raw.character.coreStats = { will: 20, perception: 22, physique: 24, knowledge: 26 };
  raw.clown.paperSheets = 2; raw.spirituality = 20;
  raw.magician.lantern.prepared = true; raw.magician.lantern.oilSpent = 1; raw.magician.lantern.oilStock--;
  if (id === 'talk') raw.magician.practices = ['air-target'];
  const current = projectSliceState(raw);
  const command: MagicianActivityCommand = id === 'talk' ? { type: 'ENCOUNTER_TALK' } : { type: 'PRACTICE', practiceId: id };
  const records: SliceRecord[] = [];
  applyMagicianPractice(raw, command, {
    check: (ability, difficulty) => {
      const check = resolveNormalCheck({ ability, difficulty, baseAbility: raw.character.coreStats[ability], modifiers: [], roll });
      raw.lastCheck = check; return check;
    },
    note: (title, text) => { records.push({ id: 'fresh-check', week: raw.week, title, text }); },
    roll: () => { throw new Error('Unexpected random call'); },
  }, () => {});
  raw.revision++; raw.chronicle.push(...records); raw.lastResult = records[0]!;
  const next = projectSliceState(raw), record = next.chronicle.at(-1)!;
  const envelope: SliceEnvelope = { runId: current.runId, intentId: 'new-magician-check', expectedRevision: current.revision, payload: { type: 'MAGICIAN', command } };
  const receipt: SliceReceipt = { runId: current.runId, intentId: envelope.intentId, previousRevision: current.revision, newRevision: next.revision, committedAt: '', replayed: false, state: next };
  return { current, next, record, envelope, receipt };
}
const display = (c: ReturnType<typeof capture>) => magicianCheckFeedback(c.record, c.current, c.envelope, c.receipt);
describe('current authoritative magician check display', () => {
  for (const roll of [1, 40, 90, 100]) it.each([...practiceIds, 'talk'])(`adds actual roll ${roll} for %s without changing history`, id => {
    const c = capture(id, roll), before = JSON.stringify(c);
    const result = display(c), check = c.next.lastCheck!;
    expect(result).not.toBe(c.record);
    expect(result.text).toBe(`${{ will: '意志', perception: '感知', physique: '体质', knowledge: '知识' }[check.ability]}难度${check.difficulty} · 成功率${check.chance}% · 骰点${roll}。${c.record.text}`);
    expect(JSON.stringify(c)).toBe(before);
  });
  it('uses public chance directly, not a recalculated historical chance', () => {
    const c = capture(); c.next.lastCheck = { ...c.next.lastCheck!, chance: 71 };
    expect(display(c).text).toContain('成功率71%');
  });
  it('binds the action record even when last AP produces later weekly records', () => {
    const c = capture(); c.current.actionsRemaining = 1; c.next.week++;
    const weekly = { id: 'weekly-finance', week: c.next.week, title: '本周结算', text: '生活费已扣除。' };
    c.next.chronicle.push(weekly); c.next.lastResult = weekly;
    expect(display(c).text).toContain('骰点40');
    expect(magicianCheckFeedback(weekly, c.current, c.envelope, c.receipt)).toBe(weekly);
  });
  const cases: Array<[string, (c: ReturnType<typeof capture>) => void]> = [
    ['missing check', c => { c.next.lastCheck = null; }],
    ['replay', c => { c.receipt.replayed = true; }],
    ['intent', c => { c.receipt.intentId += 'other'; }],
    ['receipt run', c => { c.receipt.runId += 'other'; }],
    ['next run', c => { c.next.runId += 'other'; }],
    ['current run', c => { c.current.runId += 'other'; }],
    ['envelope revision', c => { c.envelope.expectedRevision++; }],
    ['previous revision', c => { c.receipt.previousRevision++; }],
    ['new revision', c => { c.receipt.newRevision++; }],
    ['skipped revision', c => { c.next.revision++; c.receipt.newRevision++; }],
    ['old record', c => { c.current.chronicle.push(c.record); }],
    ['missing record', c => { c.next.chronicle = []; }],
    ['wrong title', c => { c.record.title += 'other'; }],
    ['unknown narrative', c => { c.record.text += 'other'; }],
    ['wrong week', c => { c.record.week++; }],
    ['wrong stat', c => { c.next.lastCheck = { ...c.next.lastCheck!, ability: 'knowledge' }; }],
    ['wrong base', c => { c.next.lastCheck = { ...c.next.lastCheck!, baseAbility: 500 }; }],
    ['wrong effective ability', c => { c.next.lastCheck = { ...c.next.lastCheck!, effectiveAbility: 500 }; }],
    ['wrong difficulty', c => { c.next.lastCheck = { ...c.next.lastCheck!, difficulty: 12 }; }],
    ['modifier', c => { c.next.lastCheck = { ...c.next.lastCheck!, modifiers: [{ source: 'other', value: 1 }] }; }],
    ['wrong outcome', c => { c.next.lastCheck = { ...c.next.lastCheck!, tier: 'FAILURE' }; }],
    ['non-integer roll', c => { c.next.lastCheck = { ...c.next.lastCheck!, roll: 40.5 }; }],
    ['too-high roll', c => { c.next.lastCheck = { ...c.next.lastCheck!, roll: 101 }; }],
    ['too-low chance', c => { c.next.lastCheck = { ...c.next.lastCheck!, chance: 4 }; }],
    ['too-high chance', c => { c.next.lastCheck = { ...c.next.lastCheck!, chance: 96 }; }],
    ['non-integer chance', c => { c.next.lastCheck = { ...c.next.lastCheck!, chance: 70.5 }; }],
    ['invalid roll', c => { c.next.lastCheck = { ...c.next.lastCheck!, roll: 0 }; }],
    ['invalid chance', c => { c.next.lastCheck = { ...c.next.lastCheck!, chance: NaN }; }],
    ['unavailable action', c => { c.current.magician.actions = []; }],
    ['disabled action', c => { c.current.magician.actions.forEach(a => { a.enabled = false; }); }],
    ['current pathway', c => { c.current.progression.pathwayId = 'hunter'; }],
    ['next pathway', c => { c.next.progression.pathwayId = 'hunter'; }],
    ['current sequence', c => { c.current.progression.sequence = 9; }],
    ['next sequence', c => { c.next.progression.sequence = 8; }],
  ];
  it.each(cases)('fails closed for %s', (_name, mutate) => {
    const c = capture(); mutate(c); const before = JSON.stringify(c);
    expect(display(c)).toBe(c.record); expect(JSON.stringify(c)).toBe(before);
  });
  it.each<MagicianActivityCommand>([{ type: 'PRACTICE', practiceId: 'unknown' }, { type: 'PRACTICE', practiceId: 'air-target' }, { type: 'ENCOUNTER_FIGHT' }, { type: 'ENCOUNTER_TALK' }, { type: 'BUY_OIL' }, { type: 'PREPARE_LANTERN' }, { type: 'PREPARE_FIGURINE' }, { type: 'TRANSFER_INJURY', injuryId: 'old-injury' }, { type: 'REFLECT' }])('rejects another magician command %j', command => {
    const c = capture(); c.envelope.payload = { type: 'MAGICIAN', command }; expect(display(c)).toBe(c.record);
  });
  it.each([6, 5] as const)('excludes inherited sequence %s in either state', sequence => {
    for (const side of ['current', 'next'] as const) {
      const c = capture(); c[side].progression.sequence = sequence; expect(display(c)).toBe(c.record);
    }
  });
  it('does not reconstruct rolls from historical records', () => {
    const c = capture(); c.next.lastCheck = null;
    c.current.chronicle.push({ ...c.record, id: 'historical', text: '成功率70% · 骰点40。' + c.record.text });
    expect(display(c)).toBe(c.record);
  });
  it('rejects ordinary actions and absent current state', () => {
    const c = capture(); expect(magicianCheckFeedback(c.record, null, c.envelope, c.receipt)).toBe(c.record);
    c.envelope.payload = { type: 'ACTION', action: 'REST' }; expect(display(c)).toBe(c.record);
  });
});
