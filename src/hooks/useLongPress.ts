import { useCallback, useRef } from "react";

interface LongPressOptions {
  /** Duration in ms before long press triggers (default: 500) */
  threshold?: number;
  /** Callback when long press is detected */
  onLongPress: (event: React.TouchEvent | React.MouseEvent) => void;
  /** Optional callback for regular tap/click */
  onClick?: (event: React.TouchEvent | React.MouseEvent) => void;
  /** Disable long press detection */
  disabled?: boolean;
}

interface LongPressHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseLeave: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

/**
 * Hook to detect long press gestures on both touch and mouse devices.
 * Provides haptic feedback on supported devices.
 */
export function useLongPress({
  threshold = 500,
  onLongPress,
  onClick,
  disabled = false,
}: LongPressOptions): LongPressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const eventRef = useRef<React.TouchEvent | React.MouseEvent | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const triggerHaptic = useCallback(() => {
    // Try to trigger haptic feedback on supported devices
    if ("vibrate" in navigator) {
      navigator.vibrate(50);
    }
  }, []);

  const startPress = useCallback(
    (e: React.TouchEvent | React.MouseEvent, clientX: number, clientY: number) => {
      if (disabled) return;

      isLongPressRef.current = false;
      startPosRef.current = { x: clientX, y: clientY };
      eventRef.current = e;

      clearTimer();

      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        triggerHaptic();
        onLongPress(eventRef.current!);
      }, threshold);
    },
    [disabled, threshold, onLongPress, clearTimer, triggerHaptic]
  );

  const endPress = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      clearTimer();

      if (!isLongPressRef.current && onClick && !disabled) {
        onClick(e);
      }

      isLongPressRef.current = false;
      startPosRef.current = null;
      eventRef.current = null;
    },
    [clearTimer, onClick, disabled]
  );

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!startPosRef.current) return;

      // Cancel if moved more than 10px (prevents accidental long press while scrolling)
      const dx = Math.abs(clientX - startPosRef.current.x);
      const dy = Math.abs(clientY - startPosRef.current.y);

      if (dx > 10 || dy > 10) {
        clearTimer();
        startPosRef.current = null;
      }
    },
    [clearTimer]
  );

  // Touch handlers
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      startPress(e, touch.clientX, touch.clientY);
    },
    [startPress]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      endPress(e);
    },
    [endPress]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    },
    [handleMove]
  );

  // Mouse handlers (for desktop testing and hybrid devices)
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only handle left click
      if (e.button !== 0) return;
      startPress(e, e.clientX, e.clientY);
    },
    [startPress]
  );

  const onMouseUp = useCallback(
    (e: React.MouseEvent) => {
      endPress(e);
    },
    [endPress]
  );

  const onMouseLeave = useCallback(() => {
    clearTimer();
    startPosRef.current = null;
  }, [clearTimer]);

  // Prevent native context menu on mobile
  const onContextMenu = useCallback((e: React.MouseEvent) => {
    if (!disabled) {
      e.preventDefault();
    }
  }, [disabled]);

  return {
    onTouchStart,
    onTouchEnd,
    onTouchMove,
    onMouseDown,
    onMouseUp,
    onMouseLeave,
    onContextMenu,
  };
}
