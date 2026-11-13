import { useLayoutEffect, useRef } from 'react';
import './editor-presentation.css';

// Measure the rail's visible viewport, independently of its scrolling content.
// A clipped overlay lets the drawer slide over outcomes without moving them.
export default function EditorPresentation({ open, onClose, title, lang = 'en', children }) {
  const dialogRef = useRef(null);
  const layerRef = useRef(null);

  useLayoutEffect(() => {
    const layer = layerRef.current;
    const rail = layer.closest('.workspace-controls');
    const policy = rail.querySelector('.workspace-policy');
    const position = () => {
      const bounds = rail.getBoundingClientRect();
      const policyBounds = policy.getBoundingClientRect();
      const gap = parseFloat(getComputedStyle(rail).rowGap) || 10;
      const viewportTop = window.visualViewport?.offsetTop ?? 0;
      const viewportBottom = Math.min(window.innerHeight, viewportTop + (window.visualViewport?.height ?? window.innerHeight));
      const top = Math.max(viewportTop, bounds.top + rail.clientTop, policyBounds.bottom + gap);
      const bottom = Math.min(viewportBottom - 8, bounds.bottom - rail.clientTop);
      const height = bottom - top >= 64 ? bottom - top : 0;
      Object.assign(layer.style, {
        left: `${bounds.left + rail.clientLeft}px`, top: `${top}px`,
        width: `${rail.clientWidth}px`, height: `${height}px`,
        visibility: height > 0 ? 'visible' : 'hidden',
      });
      layer.inert = !open || height === 0;
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(rail);
    observer.observe(policy);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    window.visualViewport?.addEventListener('resize', position);
    window.visualViewport?.addEventListener('scroll', position);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      window.visualViewport?.removeEventListener('resize', position);
      window.visualViewport?.removeEventListener('scroll', position);
    };
  }, [open]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!open) {
      if (!dialog.open) return;
      let finished = false;
      const finishClosing = () => {
        if (finished) return;
        finished = true;
        const focus = document.activeElement;
        const rail = dialog.closest('.workspace-controls');
        const railScrollTop = rail.scrollTop;
        const pageScroll = { left: window.scrollX, top: window.scrollY };
        dialog.close();
        if (focus?.isConnected && !dialog.contains(focus)) focus.focus?.({ preventScroll: true });
        rail.scrollTop = railScrollTop;
        window.scrollTo({ ...pageScroll, behavior: 'instant' });
      };
      const onExitEnd = event => {
        if (event.target === dialog && event.animationName === 'editor-slide-out') finishClosing();
      };
      dialog.addEventListener('animationend', onExitEnd);
      // Wait for the visual exit, with a fallback if the browser cancels it.
      const duration = parseFloat(getComputedStyle(dialog).animationDuration) * 1000;
      const timer = window.setTimeout(finishClosing, (duration || 300) + 100);
      return () => {
        window.clearTimeout(timer);
        dialog.removeEventListener('animationend', onExitEnd);
      };
    }
    if (dialog.open) return;
    const previousFocus = document.activeElement;
    const rail = dialog.closest('.workspace-controls');
    const railScrollTop = rail?.scrollTop;
    const pageScroll = { left: window.scrollX, top: window.scrollY };
    dialog.show();
    // Native dialog focus must not scroll the page when a sample is selected.
    if (previousFocus?.isConnected && typeof previousFocus.focus === 'function') {
      previousFocus.focus({ preventScroll: true });
    }
    if (rail) rail.scrollTop = railScrollTop;
    window.scrollTo({ ...pageScroll, behavior: 'instant' });
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const onKeyDown = event => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
      // Help popovers, income cancellation and active drags handle Escape first.
      if (document.querySelector(':popover-open')) return;
      if (document.querySelector('[data-policy-help]')) return;
      if (document.querySelector('[data-dragging="student"], [data-dragging="threshold"]')) return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return <div ref={layerRef} className="editor-drawer-layer" data-open={open} inert={!open}>
    <dialog ref={dialogRef} id="counterfactual-editor"
    className="workspace-counterfactual simplified-panel has-explorer-editor editor-surface"
    aria-label={title} lang={lang}
    onCancel={event => {
      event.preventDefault();
      onClose();
    }}>
    {children}
    </dialog>
  </div>;
}
