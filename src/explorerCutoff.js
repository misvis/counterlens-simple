import { admissionBoundary, backgroundScore } from '../shared/admissionModel.js';
import { explorerBackgroundExtents, isExplorerPolicy } from '../shared/explorerPolicies.js';
import { recordMatchesExplorerContext } from '../shared/featureExplorer.js';

// A shared line is valid only for the Academic Focus rule with no background
// contribution. Profile boundaries always use the actual, unbinned values.
export const getExplorerCutoff = (policy, profile) => {
  if (profile) {
    const score = backgroundScore(profile, policy);
    return { scope: 'profile', profile, score, boundary: admissionBoundary(policy, score) };
  }
  if (policy.id !== 'academic') return null;
  const backgroundIsZero = isExplorerPolicy(policy)
    ? explorerBackgroundExtents(policy).every(value => value === 0)
    : ['firstGen', 'athlete', 'resident'].every(key => (policy.weights[key] ?? 0) === 0);
  return backgroundIsZero
    ? { scope: 'all', profile: null, score: 0, boundary: admissionBoundary(policy, 0) }
    : null;
};

export const cutoffMatchesContext = (cutoff, context) => Boolean(cutoff)
  && (cutoff.scope === 'all' || recordMatchesExplorerContext(cutoff.profile, context));
