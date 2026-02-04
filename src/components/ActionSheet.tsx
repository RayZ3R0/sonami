import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { ContextMenuItem } from "./ContextMenu";

interface ActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  items: ContextMenuItem[];
  title?: string;
  subtitle?: string;
  coverImage?: string;
}

interface ActionSheetItemProps {
  item: ContextMenuItem;
  onClose: () => void;
  onShowSubmenu: (items: ContextMenuItem[], title: string) => void;
}

function ActionSheetItem({ item, onClose, onShowSubmenu }: ActionSheetItemProps) {
  const handleClick = () => {
    if (item.disabled) return;

    if (item.submenu && item.submenu.length > 0) {
      onShowSubmenu(item.submenu, item.label);
    } else if (item.action) {
      item.action();
      onClose();
    }
  };

  // Generate icon based on label if not provided
  const getDefaultIcon = () => {
    const label = item.label.toLowerCase();
    if (label.includes('play')) {
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      );
    }
    if (label.includes('like') || label.includes('favorite') || label.includes('heart')) {
      return (
        <svg className="w-5 h-5" fill={label.includes('remove') ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      );
    }
    if (label.includes('playlist') || label.includes('add to')) {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      );
    }
    if (label.includes('download')) {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      );
    }
    if (label.includes('remove') || label.includes('delete')) {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      );
    }
    return null;
  };

  const icon = item.icon || getDefaultIcon();

  return (
    <button
      onClick={handleClick}
      disabled={item.disabled}
      className={`
        w-full flex items-center gap-4 px-5 py-4 text-left
        transition-colors duration-100 active:bg-white/10
        ${item.disabled ? "opacity-40 cursor-not-allowed" : ""}
        ${item.danger ? "text-red-400" : "text-white"}
      `}
    >
      {icon && (
        <span className={`w-5 h-5 flex-shrink-0 ${item.danger ? 'text-red-400' : 'text-white/60'}`}>
          {icon}
        </span>
      )}
      <span className="flex-1 text-base font-medium">{item.label}</span>
      {item.submenu && item.submenu.length > 0 && (
        <svg
          className="w-5 h-5 opacity-40 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      )}
    </button>
  );
}

export function ActionSheet({
  isOpen,
  onClose,
  items,
  title,
  subtitle,
  coverImage,
}: ActionSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [submenuStack, setSubmenuStack] = useState<
    { items: ContextMenuItem[]; title: string }[]
  >([]);
  const startYRef = useRef<number>(0);
  const currentYRef = useRef<number>(0);
  const isDraggingRef = useRef(false);

  // Current items to display (either root or submenu)
  const currentItems = submenuStack.length > 0 
    ? submenuStack[submenuStack.length - 1].items 
    : items;
  const currentTitle = submenuStack.length > 0 
    ? submenuStack[submenuStack.length - 1].title 
    : title;

  // Handle open/close animations
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // Small delay to trigger CSS animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setSubmenuStack([]); // Reset submenu on close
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (submenuStack.length > 0) {
          setSubmenuStack((prev) => prev.slice(0, -1));
        } else {
          onClose();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, submenuStack.length]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  // Handle swipe down to dismiss
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    currentYRef.current = 0;
    isDraggingRef.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const deltaY = e.touches[0].clientY - startYRef.current;
    currentYRef.current = deltaY;

    // Only allow dragging down
    if (deltaY > 0) {
      isDraggingRef.current = true;
      if (sheetRef.current) {
        sheetRef.current.style.transform = `translateY(${deltaY}px)`;
        sheetRef.current.style.transition = "none";
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isDraggingRef.current) return;

    if (sheetRef.current) {
      sheetRef.current.style.transition = "";
      sheetRef.current.style.transform = "";
    }

    // If dragged more than 100px or with velocity, close
    if (currentYRef.current > 100) {
      onClose();
    }

    isDraggingRef.current = false;
  }, [onClose]);

  const handleShowSubmenu = useCallback((items: ContextMenuItem[], title: string) => {
    setSubmenuStack((prev) => [...prev, { items, title }]);
  }, []);

  const handleBack = useCallback(() => {
    setSubmenuStack((prev) => prev.slice(0, -1));
  }, []);

  if (!isVisible) return null;

  return createPortal(
    <div
      className={`
        fixed inset-0 z-[10000] flex items-end justify-center
        transition-colors duration-300
        ${isAnimating ? "bg-black/60" : "bg-transparent"}
      `}
      onClick={handleBackdropClick}
    >
      <div
        ref={sheetRef}
        className={`
          w-full max-w-lg bg-[#1e1e24] rounded-t-3xl shadow-2xl
          transform transition-transform duration-300 ease-out
          ${isAnimating ? "translate-y-0" : "translate-y-full"}
          max-h-[85vh] flex flex-col
        `}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        {(currentTitle || subtitle || coverImage || submenuStack.length > 0) && (
          <div className="px-5 pb-4 border-b border-white/10">
            <div className="flex items-center gap-4">
              {/* Back button for submenus */}
              {submenuStack.length > 0 && (
                <button
                  onClick={handleBack}
                  className="p-1 -ml-1 rounded-full hover:bg-white/10 transition-colors"
                >
                  <svg
                    className="w-5 h-5 text-white/70"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}

              {/* Cover image */}
              {coverImage && submenuStack.length === 0 && (
                <img
                  src={coverImage}
                  alt=""
                  className="w-12 h-12 rounded-lg object-cover shadow-lg flex-shrink-0"
                />
              )}

              {/* Title & subtitle */}
              <div className="flex-1 min-w-0">
                {currentTitle && (
                  <h3 className="text-base font-semibold text-white truncate">
                    {currentTitle}
                  </h3>
                )}
                {subtitle && submenuStack.length === 0 && (
                  <p className="text-sm text-white/60 truncate">{subtitle}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Items */}
        <div className="flex-1 overflow-y-auto overscroll-contain py-2">
          {currentItems.length === 0 ? (
            <div className="px-5 py-8 text-center text-white/40 text-sm">
              No options available
            </div>
          ) : (
            currentItems.filter((item, idx) => {
              // Filter out dividers at start/end
              if (item.label === 'divider') {
                if (idx === 0 || idx === currentItems.length - 1) return false;
              }
              return true;
            }).map((item, index) => (
              item.label === 'divider' ? (
                <div key={index} className="my-2 mx-5 h-px bg-white/10" />
              ) : (
                <ActionSheetItem
                  key={index}
                  item={item}
                  onClose={onClose}
                  onShowSubmenu={handleShowSubmenu}
                />
              )
            ))
          )}
        </div>

        {/* Cancel button */}
        <div className="p-4 pt-2 border-t border-white/10">
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-xl bg-white/5 text-white font-medium text-base
                       hover:bg-white/10 active:bg-white/15 transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* Safe area for notch devices */}
        <div className="h-safe-area-inset-bottom bg-[#1e1e24]" />
      </div>
    </div>,
    document.body
  );
}
