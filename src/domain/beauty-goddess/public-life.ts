import type { PublicCheckResult } from '../../shared/contracts.js';
import type { SummoningMasterPartner } from '../summoning-master/life.js';
import type { BeautyGoddessActivityCommand, BeautyGoddessLifeBudget, BeautyGoddessLifeReceipt } from './life.js';

/** This module has only type imports: life projection must not load combat replay. */
const publicCheck = (c: PublicCheckResult | null): PublicCheckResult | null => c ? ({
  ability: c.ability, baseAbility: c.baseAbility, modifiers: c.modifiers.map(m => ({ source: m.source, value: m.value })),
  effectiveAbility: c.effectiveAbility, difficulty: c.difficulty, chance: c.chance, roll: c.roll, tier: c.tier,
}) : null;
const publicBudget = (b: BeautyGoddessLifeBudget) => ({
  health: b.health, mind: b.mind, spirituality: b.spirituality, cash: b.cash, actions: b.actions,
});
const publicPartner = (p: SummoningMasterPartner) => ({
  id: p.id, name: p.name, source: p.source, adult: p.adult, independentMind: p.independentMind,
  bodyId: p.bodyId, homeId: p.homeId, location: p.location, health: p.health, mind: p.mind,
  stamina: p.stamina, status: p.status, willing: p.willing, metWeek: p.metWeek,
  ordinaryDistanceM: p.ordinaryDistanceM, gateCrossings: p.gateCrossings,
  chime: { id: p.chime.id, owner: p.chime.owner },
  restHistory: p.restHistory.map(r => ({
    week: r.week, paidPennies: r.paidPennies, staminaBefore: r.staminaBefore, staminaAfter: r.staminaAfter,
    mindBefore: r.mindBefore, mindAfter: r.mindAfter, healthUnchanged: r.healthUnchanged,
  })),
});
const publicCommand = (c: BeautyGoddessActivityCommand): BeautyGoddessActivityCommand => {
  switch (c.type) {
    case 'OBSERVE': case 'REPORT': return { type: c.type, caseId: c.caseId };
    case 'INVITE': return { type: c.type, caseId: c.caseId, method: c.method };
    case 'CONSENT': case 'DECLINE_CONSENT': case 'REVOKE_CONSENT': return { type: c.type, permission: c.permission };
    case 'BUY_PIECE': return { type: c.type, pieceId: c.pieceId };
    default: return { type: c.type };
  }
};

export function projectBeautyGoddessLifeReceipt(e: BeautyGoddessLifeReceipt) { return {
  week: e.week, date: { epoch: e.date.epoch, year: e.date.year, month: e.date.month, day: e.date.day },
  revision: e.revision, check: publicCheck(e.check), command: publicCommand(e.command), outcome: e.outcome,
  before: publicBudget(e.before), after: publicBudget(e.after), elapsedSeconds: e.elapsedSeconds,
  playerWalkedMetres: e.playerWalkedMetres, guestWalkedMetres: e.guestWalkedMetres,
  guestStaminaSpent: e.guestStaminaSpent, lampFuelBurned: e.lampFuelBurned,
  guestBefore: publicPartner(e.guestBefore), guestAfter: publicPartner(e.guestAfter),
}; }
export type BeautyGoddessPublicLifeReceipt = ReturnType<typeof projectBeautyGoddessLifeReceipt>;
