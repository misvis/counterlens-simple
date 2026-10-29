import { useId, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

// The native top layer avoids clipping by the visualizer's scroll containers,
// while keeping theme inheritance and the normal form-control tab order.
export function ExplorerDropdown({ label, children, className = '', featureKey, bodyClassName = '' }) {
  const id = useId();
  const trigger = useRef(null);
  const panel = useRef(null);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const popup = panel.current;
    const button = trigger.current;
    const position = () => {
      const anchor = button.getBoundingClientRect();
      if (anchor.bottom <= 0 || anchor.top >= window.innerHeight || anchor.right <= 0 || anchor.left >= window.innerWidth) {
        popup.hidePopover();
        return;
      }
      const inset = 12, gap = 6;
      const below = Math.max(0, window.innerHeight - anchor.bottom - gap - inset);
      const above = Math.max(0, anchor.top - gap - inset);
      const upwards = below < Math.min(popup.scrollHeight + 2, 240) && above > below;
      popup.style.maxHeight = `${Math.min(420, upwards ? above : below)}px`;
      const bounds = popup.getBoundingClientRect();
      popup.style.left = `${Math.max(inset, Math.min(anchor.left, window.innerWidth - bounds.width - inset))}px`;
      popup.style.top = `${upwards ? Math.max(inset, anchor.top - gap - bounds.height) : anchor.bottom + gap}px`;
    };
    position();
    const onScroll = event => {
      // A horizontally scrolled toolbar can clip its trigger inside the window.
      if (event.target === button.closest('.fex-controls')) popup.hidePopover();
      else if (!popup.contains(event.target)) position();
    };
    const observer = new ResizeObserver(position);
    observer.observe(popup);
    observer.observe(button);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  return <div className={`fex-picker ${className}`} data-feature-picker={featureKey}
    onBlur={event => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) panel.current?.hidePopover();
    }}>
    <button ref={trigger} type="button" className="fex-picker-trigger" id={`${id}-trigger`}
      popoverTarget={id} aria-controls={id} aria-expanded={open}>
      <span>{label}</span><ChevronDown size={12} aria-hidden="true" />
    </button>
    <div ref={panel} id={id} popover="auto" role="group" aria-labelledby={`${id}-trigger`}
      className={`fex-picker-body ${bodyClassName}`} onToggle={event => setOpen(event.newState === 'open')}>
      {children}
    </div>
  </div>;
}
