/** Public, fixed costs and checks for already-offered sequence-8 case choices.
 * No state, availability, hidden character information or outcome prediction. */
export const PROVOKER_CHOICE_RULES = {
  CHALLENGE: { attribute: 'will', difficulty: 14, spirituality: 2, failureHealth: 4, failureMind: 5 },
  DEESCALATE: { attribute: 'knowledge', difficulty: 12, spirituality: 0, failureHealth: 0, failureMind: 0 },
  ATTRACT: { attribute: 'perception', difficulty: 12, spirituality: 2, failureHealth: 0, failureMind: 5 },
  WAIT: { attribute: 'perception', difficulty: 14, spirituality: 0, failureHealth: 0, failureMind: 0 },
} as const;

export const PROVOKER_CHOICE_SUCCESS = { acting: 20, mastery: 8 } as const;
