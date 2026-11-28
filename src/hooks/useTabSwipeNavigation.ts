import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NavView } from '../types/music';

const SWIPE_TAB_ORDER: readonly NavView[] = ['home', 'explore', 'studio', 'library'];

interface TouchSession {
  startX: number;
  startY: number;
  lastX: number;
  startTime: number;
  lock: 'horizontal' | 'vertical' | null;
}

function shouldIgnoreSwipeTarget(target: EventTarget | null, root: HTMLElement | null): boolean {
  let node = target as HTMLElement | null;
  while (node && node !== root) {
    const tag = node.tagName;
    if (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      tag === 'OPTION' ||
      node.isContentEditable
    ) {
      return true;
    }
    if (node.getAttribute('role') === 'slider' || node.dataset.noSwipe === 'true') {
      return true;
    }
    const style = window.getComputedStyle(node);
    if (
      (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
      node.scrollWidth > node.clientWidth + 4
    ) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

interface UseTabSwipeNavigationOptions {
  activeView: NavView;
  setActiveView: (view: NavView) => void;
  disabled?: boolean;
  scrollContainerRef: React.RefObject<HTMLElement | null>;
}

export function useTabSwipeNavigation({
  activeView,
  setActiveView,
  disabled = false,
  scrollContainerRef,
}: UseTabSwipeNavigationOptions) {
  const sessionRef = useRef<TouchSession | null>(null);
  const rafRef = useRef<number | null>(null);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [isDraggingHorizontal, setIsDraggingHorizontal] = useState(false);

  const currentTabIndex = SWIPE_TAB_ORDER.indexOf(activeView);
  const canSwipeView = !disabled && currentTabIndex !== -1;

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      if (!canSwipeView || e.touches.length !== 1) {
        sessionRef.current = null;
        return;
      }
      if (shouldIgnoreSwipeTarget(e.target, scrollContainerRef.current)) {
        sessionRef.current = null;
        return;
      }

      const touch = e.touches[0];
      sessionRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        startTime: Date.now(),
        lock: null,
      };
    },
    [canSwipeView, scrollContainerRef]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      const session = sessionRef.current;
      if (!session || !canSwipeView || e.touches.length !== 1) return;

      const touch = e.touches[0];
      const dx = touch.clientX - session.startX;
      const dy = touch.clientY - session.startY;
      session.lastX = touch.clientX;

      if (session.lock === null) {
        if (Math.hypot(dx, dy) < 10) return;
        if (Math.abs(dy) >= Math.abs(dx) * 1.05) {
          session.lock = 'vertical';
          return;
        }
        if (Math.abs(dx) > Math.abs(dy) * 1.15) {
          session.lock = 'horizontal';
          setIsDraggingHorizontal(true);
        } else {
          return;
        }
      }

      if (session.lock !== 'horizontal') return;

      const hasTargetInDirection =
        (dx < 0 && currentTabIndex < SWIPE_TAB_ORDER.length - 1) ||
        (dx > 0 && currentTabIndex > 0);

      if (hasTargetInDirection) {
        setDragOffsetX(Math.max(-110, Math.min(110, dx * 0.45)));
      } else {
        // Gentle edge rubber-band when already at first or last tab
        setDragOffsetX(Math.max(-28, Math.min(28, dx * 0.16)));
      }
    },
    [canSwipeView, currentTabIndex]
  );

  const finishSwipe = useCallback(
    (endClientX?: number) => {
      const session = sessionRef.current;
      sessionRef.current = null;

      if (!session || session.lock !== 'horizontal' || !canSwipeView) {
        setIsDraggingHorizontal(false);
        setDragOffsetX(0);
        return;
      }

      const finalX = typeof endClientX === 'number' ? endClientX : session.lastX;
      const dx = finalX - session.startX;
      const elapsed = Math.max(1, Date.now() - session.startTime);
      const velocity = Math.abs(dx) / elapsed;
      const shouldSwitch = Math.abs(dx) >= 54 || (Math.abs(dx) >= 28 && velocity >= 0.35);

      let nextIndex = currentTabIndex;
      if (shouldSwitch) {
        if (dx < 0 && currentTabIndex < SWIPE_TAB_ORDER.length - 1) {
          nextIndex = currentTabIndex + 1;
        } else if (dx > 0 && currentTabIndex > 0) {
          nextIndex = currentTabIndex - 1;
        }
      }

      if (nextIndex !== currentTabIndex) {
        const enterFromX = dx < 0 ? 34 : -34;
        setIsDraggingHorizontal(true);
        setDragOffsetX(enterFromX);
        setActiveView(SWIPE_TAB_ORDER[nextIndex]);
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
        }
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = requestAnimationFrame(() => {
            setIsDraggingHorizontal(false);
            setDragOffsetX(0);
          });
        });
      } else {
        setIsDraggingHorizontal(false);
        setDragOffsetX(0);
      }
    },
    [canSwipeView, currentTabIndex, scrollContainerRef, setActiveView]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      const endX = e.changedTouches[0]?.clientX;
      finishSwipe(endX);
    },
    [finishSwipe]
  );

  const handleTouchCancel = useCallback(() => {
    finishSwipe();
  }, [finishSwipe]);

  const contentStyle: React.CSSProperties = {
    transform: dragOffsetX !== 0 ? `translate3d(${dragOffsetX}px, 0, 0)` : 'translate3d(0, 0, 0)',
    opacity: dragOffsetX !== 0 ? Math.max(0.76, 1 - Math.abs(dragOffsetX) / 360) : 1,
    transition: isDraggingHorizontal
      ? 'none'
      : 'transform 240ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease',
  };

  return {
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchCancel,
    },
    contentStyle,
  };
}
