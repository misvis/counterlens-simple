// Manual expansion belongs to the current policy visit, not a per-policy cache.
export const createOutcomeExpansion = (policyId, keys) => ({
  policyId,
  expanded: keys.filter(key => policyId === 'academic' || key === 'residency' || key === 'zipIncome'),
});

export function outcomeExpansionReducer(state, action) {
  switch (action.type) {
    case 'policy':
      return action.policyId === state.policyId ? state : createOutcomeExpansion(action.policyId, action.keys);
    case 'all':
      return { ...state, expanded: action.keys.every(key => state.expanded.includes(key)) ? [] : [...action.keys] };
    case 'toggle':
      return { ...state, expanded: state.expanded.includes(action.key)
        ? state.expanded.filter(key => key !== action.key) : [...state.expanded, action.key] };
    default:
      return state;
  }
}
