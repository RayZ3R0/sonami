import { useEffect, useRef, useState, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  action?: () => void;
  submenu?: ContextMenuItem[];
  disabled?: boolean;
  danger?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
  containerRef?: React.RefObject<HTMLElement | null>;
  portal?: boolean;
}

function SubMenu({
  items,
  closeMenu,
}: {
  items: ContextMenuItem[];
  closeMenu: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();

      if (rect.right > window.innerWidth) {
        ref.current.style.left = "auto";
        ref.current.style.right = "100%";
        ref.current.style.marginLeft = "0";
        ref.current.style.marginRight = "-4px";
      }

      if (rect.bottom > window.innerHeight) {
        ref.current.style.top = "auto";
        ref.current.style.bottom = "0";
      }
    }
  }, []);

  return (
    <div
      ref={ref}
      className="absolute left-full top-0 -ml-1 min-w-[220px] py-1.5 bg-[#1a1a20] border border-white/10 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-100 origin-top-left ring-1 ring-black/5 max-h-[300px] overflow-y-auto themed-scrollbar z-[9999]"
    >
      {items.map((item, index) => (
        <ContextMenuItemRow key={index} item={item} closeMenu={closeMenu} />
      ))}
    </div>
  );
}

function ContextMenuItemRow({
  item,
  closeMenu,
  isActive,
  onMouseEnter,
}: {
  item: ContextMenuItem;
  closeMenu: () => void;
  isActive?: boolean;
  onMouseEnter?: () => void;
}) {
  const [showSubmenu, setShowSubmenu] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setShowSubmenu(true);
  };

  const handleMouseLeave = () => {
    closeTimerRef.current = window.setTimeout(() => {
      setShowSubmenu(false);
    }, 250);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.disabled) return;

    if (item.submenu) {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      setShowSubmenu(!showSubmenu);
    } else if (item.action) {
      item.action();
      closeMenu();
    }
  };

  const handleMouseEnterReal = () => {
    if (onMouseEnter) onMouseEnter();
    handleMouseEnter();
  };

  return (
    <div
      className={`relative ${showSubmenu || isActive ? "bg-white/10" : ""}`}
      onMouseEnter={handleMouseEnterReal}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={handleClick}
        disabled={item.disabled}
        className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors ${
          item.disabled
            ? "opacity-50 cursor-not-allowed"
            : item.danger
              ? "text-theme-error hover:bg-theme-error/10"
              : "text-theme-primary hover:bg-white/5"
        }`}
      >
        {item.icon && <span className="w-4 h-4 opacity-70">{item.icon}</span>}
        <span className="flex-1 truncate">{item.label}</span>
        {item.submenu && (
          <svg
            className="w-4 h-4 opacity-50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        )}
      </button>

      {showSubmenu && item.submenu && (
        <SubMenu items={item.submenu} closeMenu={closeMenu} />
      )}
    </div>
  );
}

export const ContextMenu = ({
  items,
  position,
  onClose,
  containerRef,
  portal,
}: ContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [computedStyle, setComputedStyle] =
    useState<React.CSSProperties | null>(null);

  const menuWidth = 220;
  const estimatedHeight = Math.min(items.length * 40 + 20, 300);
  const padding = 8;

  const usePortal = portal !== undefined ? portal : true;

  useLayoutEffect(() => {
    let bounds: {
      left: number;
      top: number;
      right: number;
      bottom: number;
      width: number;
      height: number;
    };
    let clickX = position.x;
    let clickY = position.y;

    if (containerRef?.current) {
      const containerRect = containerRef.current.getBoundingClientRect();

      if (usePortal) {
        bounds = {
          left: containerRect.left,
          top: containerRect.top,
          right: containerRect.right,
          bottom: containerRect.bottom,
          width: containerRect.width,
          height: containerRect.height,
        };
      } else {
        bounds = {
          left: 0,
          top: 0,
          right: containerRect.width,
          bottom: containerRect.height,
          width: containerRect.width,
          height: containerRect.height,
        };

        clickX = position.x - containerRect.left;
        clickY = position.y - containerRect.top;
      }
    } else {
      bounds = {
        left: 0,
        top: 0,
        right: window.innerWidth,
        bottom: window.innerHeight,
        width: window.innerWidth,
        height: window.innerHeight,
      };
    }

    let xPos = clickX;
    const wouldOverflowRight = clickX + menuWidth > bounds.right - padding;
    if (wouldOverflowRight) {
      xPos = clickX - menuWidth;
    }

    xPos = Math.max(
      bounds.left + padding,
      Math.min(xPos, bounds.right - menuWidth - padding),
    );

    let yPos = clickY;
    const wouldOverflowBottom =
      clickY + estimatedHeight > bounds.bottom - padding;
    if (wouldOverflowBottom) {
      yPos = clickY - estimatedHeight;
    }

    yPos = Math.max(
      bounds.top + padding,
      Math.min(yPos, bounds.bottom - estimatedHeight - padding),
    );

    const flipHorizontal = wouldOverflowRight;

    setComputedStyle({
      top: yPos,
      left: xPos,
      position: usePortal ? "fixed" : "absolute",
      transformOrigin: `${flipHorizontal ? "top right" : "top left"}`,
    });
  }, [position, containerRef, estimatedHeight, usePortal]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (
        ["ArrowUp", "ArrowDown", "Enter", "Escape", "Tab"].includes(event.key)
      ) {
        event.stopPropagation();
        event.stopImmediatePropagation();
        event.preventDefault();
      }

      switch (event.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowDown":
          setActiveIndex((prev) => (prev + 1) % items.length);
          break;
        case "ArrowUp":
          setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
          break;
        case "Enter":
          if (
            activeIndex >= 0 &&
            items[activeIndex] &&
            !items[activeIndex].disabled
          ) {
            if (items[activeIndex].action) {
              items[activeIndex].action!();
              onClose();
            }
          }
          break;
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);

    document.addEventListener("keydown", handleKeyDown, { capture: true });

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [onClose, items, activeIndex]);

  if (!computedStyle) return null;

  const menuElement = (
    <div
      ref={menuRef}
      className="z-[9999] min-w-[220px] py-1.5 bg-[#1a1a20] border border-white/10 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/5"
      style={computedStyle}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, index) => (
        <ContextMenuItemRow
          key={index}
          item={item}
          closeMenu={onClose}
          isActive={index === activeIndex}
          onMouseEnter={() => setActiveIndex(index)}
        />
      ))}
    </div>
  );

  if (usePortal) {
    return createPortal(menuElement, document.body);
  }
  return menuElement;
};
