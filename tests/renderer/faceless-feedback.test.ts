import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation';
import { createSliceRun, projectSliceState } from '../../src/domain/slice';
import { applyFacelessActivity } from '../../src/domain/faceless/practice';
import type { FacelessActivityCommand, FacelessCaseId } from '../../src/domain/faceless/types';
import type { SliceRecord } from '../../src/domain/slice/types';
import type { SliceEnvelope, SliceReceipt } from '../../src/shared/slice-contracts';
import { resolveNormalCheck } from '../../src/resolution/normal-check';
import { facelessCheckFeedback, seerFeedbackText } from '../../src/renderer/seer-feedback';

const caseIds: FacelessCaseId[] = ['stage-double', 'familiar-manner', 'remember-self'];
// Synthetic unit receipts, never player saves or native playthrough evidence.
function capture(id: FacelessCaseId | 'talk' = 'stage-double', roll = 40, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  const raw = createSliceRun('faceless-renderer-unit', sliceDefaultCreationSelection, 'feedback');
  raw.activeEvent = null; raw.eventQueue = []; raw.actionsRemaining = 3;
  raw.world.city = 'BACKLUND'; raw.progression.pathwayId = 'diviner'; raw.progression.sequence = 6;
  raw.character.coreStats = { will: 20, perception: 22, physique: 24, knowledge: 26 };
  raw.spirituality = 20;
  if (id === 'talk') raw.faceless.cases['stage-double'].status = 'RESOLVED';
  else {
    const scene = raw.faceless.cases[id]; scene.status = 'PREPARED'; scene.observedWeek = raw.week; scene.method = method;
    if (method === 'ABILITY') {
      raw.faceless.appearance.templateId = id === 'stage-double' ? 'STAGE_DOUBLE' : 'PORTER_PART';
      raw.faceless.appearance.changes = 1; raw.faceless.appearance.changedWeek = raw.week;
      raw.faceless.outfit.location = 'PLAYER'; raw.faceless.outfit.caseId = id; raw.faceless.outfit.loans = 1;
    }
  }
  const current = projectSliceState(raw);
  const command: FacelessActivityCommand = id === 'talk' ? { type: 'ENCOUNTER_TALK' } : { type: 'PERFORM', caseId: id };
  const records: SliceRecord[] = [];
  applyFacelessActivity(raw, command, {
    check: (ability, difficulty) => {
      const check = resolveNormalCheck({ ability, difficulty, baseAbility: raw.character.coreStats[ability], modifiers: [], roll });
      raw.lastCheck = check; return check;
    },
    note: (title, text) => { records.push({ id: 'fresh-check', week: raw.week, title, text }); },
    roll: () => { throw new Error('Unexpected random call'); },
  }, () => {});
  raw.revision++; raw.chronicle.push(...records); raw.lastResult = records[0]!;
  const next = projectSliceState(raw), record = next.chronicle.at(-1)!;
  const envelope: SliceEnvelope = { runId: current.runId, intentId: 'new-faceless-check', expectedRevision: current.revision, payload: { type: 'FACELESS', command } };
  const receipt: SliceReceipt = { runId: current.runId, intentId: envelope.intentId, previousRevision: current.revision, newRevision: next.revision, committedAt: '', replayed: false, state: next };
  return { current, next, record, envelope, receipt };
}
const display = (c: ReturnType<typeof capture>) => facelessCheckFeedback(c.record, c.current, c.envelope, c.receipt);
describe('current authoritative faceless check display', () => {
  for (const method of ['ABILITY', 'ORDINARY'] as const) for (const roll of [1, 40, 90, 100]) {
    it.each(caseIds)(`${method} actual roll ${roll} for %s preserves history and existing readable feedback`, id => {
      const c = capture(id, roll, method), before = JSON.stringify(c), check = c.next.lastCheck!;
      expect(display(c).text).toBe(`${{ will: '意志', perception: '感知', physique: '体质', knowledge: '知识' }[check.ability]}难度${check.difficulty} · 成功率${check.chance}% · 骰点${roll}。${seerFeedbackText(c.record, false)}`);
      expect(display(c)).not.toBe(c.record); expect(JSON.stringify(c)).toBe(before);
    });
  }
  it.each([1, 40, 90, 100])('dispute actual roll %s', roll => {
    const c = capture('talk', roll), before = JSON.stringify(c);
    expect(display(c).text).toBe(`意志难度16 · 成功率${c.next.lastCheck!.chance}% · 骰点${roll}。${c.record.text}`);
    expect(JSON.stringify(c)).toBe(before);
  });
  it('uses the public chance without recalculation', () => {
    const c = capture(); c.next.lastCheck = { ...c.next.lastCheck!, chance: 71 };
    expect(display(c).text).toContain('成功率71%');
  });
  it('binds only the action record in a synthetic multi-record receipt', () => {
    const c = capture(); c.current.actionsRemaining = 1; c.next.week++;
    const weekly = { id: 'weekly', week: c.next.week, title: '本周结算', text: '生活费已扣除。' };
    c.next.chronicle.push(weekly); c.next.lastResult = weekly;
    expect(display(c).text).toContain('骰点40');
    expect(facelessCheckFeedback(weekly, c.current, c.envelope, c.receipt)).toBe(weekly);
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
    ['wrong stat', c => { c.next.lastCheck = { ...c.next.lastCheck!, ability: 'physique' }; }],
    ['wrong base', c => { c.next.lastCheck = { ...c.next.lastCheck!, baseAbility: 500 }; }],
    ['wrong effective ability', c => { c.next.lastCheck = { ...c.next.lastCheck!, effectiveAbility: 500 }; }],
    ['wrong difficulty', c => { c.next.lastCheck = { ...c.next.lastCheck!, difficulty: 14 }; }],
    ['modifier', c => { c.next.lastCheck = { ...c.next.lastCheck!, modifiers: [{ source: 'other', value: 1 }] }; }],
    ['wrong outcome', c => { c.next.lastCheck = { ...c.next.lastCheck!, tier: 'FAILURE' }; }],
    ['non-integer roll', c => { c.next.lastCheck = { ...c.next.lastCheck!, roll: 40.5 }; }],
    ['too-high roll', c => { c.next.lastCheck = { ...c.next.lastCheck!, roll: 101 }; }],
    ['too-low chance', c => { c.next.lastCheck = { ...c.next.lastCheck!, chance: 4 }; }],
    ['too-high chance', c => { c.next.lastCheck = { ...c.next.lastCheck!, chance: 96 }; }],
    ['non-integer chance', c => { c.next.lastCheck = { ...c.next.lastCheck!, chance: 70.5 }; }],
    ['invalid roll', c => { c.next.lastCheck = { ...c.next.lastCheck!, roll: 0 }; }],
    ['invalid chance', c => { c.next.lastCheck = { ...c.next.lastCheck!, chance: NaN }; }],
    ['unavailable action', c => { c.current.faceless.actions = []; }],
    ['disabled action', c => { c.current.faceless.actions.forEach(a => { a.enabled = false; }); }],
    ['current pathway', c => { c.current.progression.pathwayId = 'hunter'; }],
    ['next pathway', c => { c.next.progression.pathwayId = 'hunter'; }],
    ['current sequence', c => { c.current.progression.sequence = 9; }],
    ['next sequence', c => { c.next.progression.sequence = 8; }],
  ];
  it.each(cases)('fails closed for %s', (_name, mutate) => {
    const c = capture(); mutate(c); const before = JSON.stringify(c);
    expect(display(c)).toBe(c.record); expect(JSON.stringify(c)).toBe(before);
  });

  it.each<FacelessActivityCommand>([
    { type: 'OBSERVE', caseId: 'stage-double' }, { type: 'PREPARE', caseId: 'stage-double', method: 'ABILITY' },
    { type: 'PREPARE', caseId: 'stage-double', method: 'ORDINARY' }, { type: 'CLOSE', caseId: 'stage-double' },
    { type: 'WITHDRAW', caseId: 'stage-double' }, { type: 'REPORT', caseId: 'stage-double' },
    { type: 'BORROW_OUTFIT', caseId: 'stage-double' }, { type: 'RETURN_OUTFIT' }, { type: 'RESTORE_SELF' },
    { type: 'CHANGE_APPEARANCE', templateId: 'STAGE_DOUBLE' }, { type: 'REFLECT' },
    { type: 'PERFORM', caseId: 'familiar-manner' }, { type: 'ENCOUNTER_TALK' }, { type: 'ENCOUNTER_FIGHT' },
  ])('rejects deterministic or mismatched command %j', command => {
    const c = capture(); c.envelope.payload = { type: 'FACELESS', command }; expect(display(c)).toBe(c.record);
  });
  it.each([9, 8, 7, 5, 4, 3, 2] as const)('excludes other and inherited sequence %s', sequence => {
    for (const side of ['current', 'next'] as const) {
      const c = capture(); c[side].progression.sequence = sequence; expect(display(c)).toBe(c.record);
    }
  });
  it.each(['unknown', 'missing', 'other method', 'status', 'title', 'missing scene', 'next status', 'next contact', 'next result', 'next preparation'])(
    'fails closed for scene %s', mismatch => {
      const c = capture(), before = c.current.faceless.cases[0]!, after = c.next.faceless.cases[0]!;
      if (mismatch === 'unknown') before.preparation += 'changed';
      if (mismatch === 'missing') before.preparation = null;
      if (mismatch === 'other method') before.preparation = capture('stage-double', 40, 'ORDINARY').current.faceless.cases[0]!.preparation;
      if (mismatch === 'status') before.status = 'OBSERVED';
      if (mismatch === 'title') before.title += 'changed';
      if (mismatch === 'missing scene') c.next.faceless.cases = [];
      if (mismatch === 'next status') after.status = 'OBSERVED';
      if (mismatch === 'next contact') after.contactOpen = before.contactOpen;
      if (mismatch === 'next result') after.result = null;
      if (mismatch === 'next preparation') after.preparation = before.preparation;
      expect(display(c)).toBe(c.record);
    });
  it('distinguishes ordinary failure from great failure narrative', () => {
    const c = capture('stage-double', 100); c.next.lastCheck = { ...c.next.lastCheck!, tier: 'FAILURE' }; expect(display(c)).toBe(c.record);
  });
  it('rejects a mismatched encounter projection', () => {
    const c = capture('talk'); c.next.faceless.cases.find(row => row.id === 'faceless-dispute')!.status = 'AVAILABLE';
    expect(display(c)).toBe(c.record);
  });
  it('rejects absent state and unrelated action without historical reconstruction', () => {
    const c = capture(); expect(facelessCheckFeedback(c.record, null, c.envelope, c.receipt)).toBe(c.record);
    c.envelope.payload = { type: 'ACTION', action: 'REST' }; expect(display(c)).toBe(c.record);
  });
});
