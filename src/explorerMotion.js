import { flushSync } from 'react-dom';

let activeTransition;
let transitionSequence = 0;
const resetAnimations = new WeakMap();
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const explorerLayoutKey = layout => JSON.stringify([layout.rows, layout.columns, layout.sections]);

// Only the plot viewport gets snapshots; controls and statistics stay live.
export function withExplorerViewTransition(update, nextLayout) {
  const viewport = document.querySelector('.fex-matrix-viewport');
  const currentLayout = document.querySelector('[data-feature-explorer]')?.dataset.layoutKey;
  const sequence = ++transitionSequence;
  activeTransition?.skipTransition();
  if (!viewport || (nextLayout && currentLayout === explorerLayoutKey(nextLayout))) {
    flushSync(update);
    return;
  }
  if (!document.startViewTransition || document.hidden) {
    flushSync(update);
    viewport.animate?.([{ opacity: .65 }, { opacity: 1 }], { duration: reducedMotion() ? 90 : 150, easing: 'ease-out' });
    return;
  }
  document.documentElement.classList.add('explorer-layout-transition');
  const transition = document.startViewTransition(() => {
    if (sequence === transitionSequence) flushSync(update);
  });
  activeTransition = transition;
  // Rapid input can intentionally skip a snapshot before it becomes ready.
  transition.ready.catch(() => {});
  const finish = () => {
    if (activeTransition !== transition) return;
    activeTransition = undefined;
    document.documentElement.classList.remove('explorer-layout-transition');
  };
  transition.finished.then(finish, finish);
}

// One quiet highlight, only on controls whose values actually changed.
export function flashExplorerReset(elements) {
  for (const element of elements.filter(Boolean)) {
    resetAnimations.get(element)?.cancel();
    const style = getComputedStyle(element);
    const animation = element.animate?.([
      { backgroundColor: style.getPropertyValue('--workspace-highlight-ring').trim() || 'rgba(142, 167, 255, .25)' },
      { backgroundColor: style.backgroundColor },
    ], { duration: reducedMotion() ? 250 : 450, easing: 'ease-out' });
    if (animation) resetAnimations.set(element, animation);
  }
}
