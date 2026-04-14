/**
 * useSwipeBack — iOS-style edge-swipe-to-close gesture hook.
 *
 * Attaches pointer listeners to a host element. When the user presses
 * down on the left edge of the screen (within `edgeWidth` px) and
 * drags right past `threshold` px (or with enough velocity), invoke
 * `onSwipeBack`. This mirrors the native iOS back gesture so fullscreen
 * overlays feel at-home on device.
 *
 * Usage:
 *
 *   const ref = useSwipeBack({ onSwipeBack: onClose });
 *   return <motion.div ref={ref}>...</motion.div>;
 *
 * Notes:
 *  • Only activates for pointers that START within the left edge band.
 *    Scrolling and interactions in the interior are unaffected.
 *  • Ignores multi-touch / pinch gestures.
 *  • Provides light haptic feedback when the threshold is crossed.
 */

import { useEffect, useRef, useCallback } from 'react';
import { triggerHaptic } from './haptics';

export interface UseSwipeBackOptions {
  /** Called when the user completes a back-swipe gesture. */
  onSwipeBack: () => void;
  /** Px from the left edge that arms the gesture. Default 24. */
  edgeWidth?: number;
  /** Px of horizontal travel required to trigger close. Default 80. */
  threshold?: number;
  /** Px/ms velocity that also triggers close. Default 0.5. */
  velocityThreshold?: number;
  /** If false, gesture is disabled. Default true. */
  enabled?: boolean;
}

export function useSwipeBack<T extends HTMLElement>(
  options: UseSwipeBackOptions,
): (el: T | null) => void {
  const {
    onSwipeBack,
    edgeWidth = 24,
    threshold = 80,
    velocityThreshold = 0.5,
    enabled = true,
  } = options;

  // Keep the handler fresh without re-attaching listeners on every render.
  const onSwipeBackRef = useRef(onSwipeBack);
  useEffect(() => {
    onSwipeBackRef.current = onSwipeBack;
  }, [onSwipeBack]);

  const nodeRef = useRef<T | null>(null);

  const setRef = useCallback((el: T | null) => {
    nodeRef.current = el;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const node = nodeRef.current;
    if (!node) return;

    let active = false;
    let startX = 0;
    let startY = 0;
    let startT = 0;
    let pointerId: number | null = null;
    let hapticFired = false;

    const cleanup = () => {
      active = false;
      pointerId = null;
      hapticFired = false;
    };

    const onPointerDown = (e: PointerEvent) => {
      // Only respond to touch / pen — not mouse — and only single-pointer.
      if (e.pointerType === 'mouse') return;
      if (pointerId !== null) return;
      if (e.clientX > edgeWidth) return;
      pointerId = e.pointerId;
      active = true;
      startX = e.clientX;
      startY = e.clientY;
      startT = e.timeStamp;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!active || e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      const dy = Math.abs(e.clientY - startY);
      // If the gesture becomes clearly vertical, bail — let the page scroll.
      if (dy > 20 && dy > Math.abs(dx)) {
        cleanup();
        return;
      }
      // Fire a single light haptic tick when we cross the threshold so
      // the user knows the commit point.
      if (!hapticFired && dx > threshold) {
        hapticFired = true;
        triggerHaptic('light');
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!active || e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      const dt = e.timeStamp - startT;
      const vx = dt > 0 ? dx / dt : 0;
      if (dx > threshold || vx > velocityThreshold) {
        onSwipeBackRef.current();
      }
      cleanup();
    };

    const onPointerCancel = () => cleanup();

    // Passive listeners — we never preventDefault so the browser can
    // keep optimising scroll performance.
    node.addEventListener('pointerdown', onPointerDown, { passive: true });
    node.addEventListener('pointermove', onPointerMove, { passive: true });
    node.addEventListener('pointerup', onPointerUp, { passive: true });
    node.addEventListener('pointercancel', onPointerCancel, { passive: true });

    return () => {
      node.removeEventListener('pointerdown', onPointerDown);
      node.removeEventListener('pointermove', onPointerMove);
      node.removeEventListener('pointerup', onPointerUp);
      node.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [enabled, edgeWidth, threshold, velocityThreshold]);

  return setRef;
}
