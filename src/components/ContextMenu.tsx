import {
  useEffect,
  useRef,
  useState,
  useLayoutEffect,
  useCallback,
} from "react";
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

interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

// Auto-generate icons based on label text
function getDefaultIcon(label: string): React.ReactNode {
  const l = label.toLowerCase();

  if (l.includes("play") && !l.includes("playlist")) {
    return (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M8 5v14l11-7z" />
      </svg>
    );
  }
  if (
    l.includes("like") ||
    l.includes("favorite") ||
    l.includes("heart") ||
    l.includes("liked songs")
  ) {
    const isFilled = l.includes("remove") || l.includes("unlike");
    return (
      <svg
        className="w-4 h-4"
        fill={isFilled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    );
  }
  if (l.includes("playlist") || l.includes("add to")) {
    return (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
        />
      </svg>
    );
  }
  if (l.includes("download")) {
    return (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        />
      </svg>
    );
  }
  if (l.includes("remove") || l.includes("delete")) {
    return (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
      </svg>
    );
  }
  if (l.includes("queue")) {
    return (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 6h16M4 10h16M4 14h16M4 18h16"
        />
      </svg>
    );
  }
  if (l.includes("share")) {
    return (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
        />
      </svg>
    );
  }
  if (l.includes("create") || l.includes("new")) {
    return (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    );
  }
  if (l.includes("edit") || l.includes("rename")) {
    return (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
        />
      </svg>
    );
  }

  return null;
}

function SubMenu({
  items,
  closeMenu,
  parentRect,
  containerBounds,
}: {
  items: ContextMenuItem[];
  closeMenu: () => void;
  parentRect: DOMRect;
  containerBounds: Bounds;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    left?: number;
    right?: number;
    top?: number;
    bottom?: number;
    maxHeight?: number;
    flipX: boolean;
    flipY: boolean;
  }>({ flipX: false, flipY: false });

  useLayoutEffect(() => {
    if (!ref.current) return;

    const menuRect = ref.current.getBoundingClientRect();
    const padding = 8;

    const spaceRight = containerBounds.right - parentRect.right - padding;
    const spaceLeft = parentRect.left - containerBounds.left - padding;
    const spaceBelow = containerBounds.bottom - parentRect.top - padding;
    const spaceAbove = parentRect.bottom - containerBounds.top - padding;

    let flipX = false;
    let flipY = false;
    let left: number | undefined;
    let right: number | undefined;
    let top: number | undefined;
    let bottom: number | undefined;

    if (menuRect.width <= spaceRight) {
      left = parentRect.right - 2;
    } else if (menuRect.width <= spaceLeft) {
      right = window.innerWidth - parentRect.left + 2;
      flipX = true;
    } else {
      if (spaceRight >= spaceLeft) {
        left = parentRect.right - 2;
      } else {
        right = window.innerWidth - parentRect.left + 2;
        flipX = true;
      }
    }

    const menuHeight = Math.min(menuRect.height, 320);
    if (menuHeight <= spaceBelow) {
      top = parentRect.top - 4;
    } else if (menuHeight <= spaceAbove) {
      bottom = window.innerHeight - parentRect.bottom - 4;
      flipY = true;
    } else {
      const idealTop = parentRect.top + (parentRect.height - menuHeight) / 2;
      top = Math.max(
        containerBounds.top + padding,
        Math.min(idealTop, containerBounds.bottom - menuHeight - padding),
      );
    }

    const maxHeight = Math.min(
      320,
      containerBounds.bottom - (top ?? parentRect.top) - padding,
    );

    setPosition({ left, right, top, bottom, maxHeight, flipX, flipY });
  }, [parentRect, containerBounds]);

  const style: React.CSSProperties = {
    position: "fixed",
    ...(position.left !== undefined && { left: position.left }),
    ...(position.right !== undefined && { right: position.right }),
    ...(position.top !== undefined && { top: position.top }),
    ...(position.bottom !== undefined && { bottom: position.bottom }),
    ...(position.maxHeight !== undefined && { maxHeight: position.maxHeight }),
    transformOrigin: `${position.flipX ? "right" : "left"} ${position.flipY ? "bottom" : "top"}`,
  };

  // Filter out dividers for submenus if they're at the start or end
  const filteredItems = items.filter((item, idx) => {
    if (item.label === "divider") {
      if (idx === 0 || idx === items.length - 1) return false;
    }
    return true;
  });

  return (
    <div
      ref={ref}
      style={style}
      className="context-menu-panel animate-in fade-in zoom-in-95 duration-100"
    >
      <div
        className="overflow-y-auto themed-scrollbar"
        style={{ maxHeight: position.maxHeight ?? 320 }}
      >
        {filteredItems.map((item, index) =>
          item.label === "divider" ? (
            <div key={index} className="my-1.5 mx-3 h-px bg-white/[0.08]" />
          ) : (
            <ContextMenuItemRow
              key={index}
              item={item}
              closeMenu={closeMenu}
              containerBounds={containerBounds}
            />
          ),
        )}
      </div>
    </div>
  );
}

function ContextMenuItemRow({
  item,
  closeMenu,
  isActive,
  onMouseEnter,
  containerBounds,
}: {
  item: ContextMenuItem;
  closeMenu: () => void;
  isActive?: boolean;
  onMouseEnter?: () => void;
  containerBounds?: Bounds;
}) {
  const [showSubmenu, setShowSubmenu] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [rowRect, setRowRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (item.submenu && rowRef.current) {
      setRowRect(rowRef.current.getBoundingClientRect());
    }
    setShowSubmenu(true);
  }, [item.submenu]);

  const handleMouseLeave = useCallback(() => {
    closeTimerRef.current = window.setTimeout(() => {
      setShowSubmenu(false);
    }, 150);
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.disabled) return;

    if (item.submenu) {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (rowRef.current) {
        setRowRect(rowRef.current.getBoundingClientRect());
      }
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

  const defaultBounds: Bounds = {
    left: 0,
    top: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
  };

  const icon = item.icon || getDefaultIcon(item.label);

  return (
    <div
      ref={rowRef}
      className="relative"
      onMouseEnter={handleMouseEnterReal}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={handleClick}
        disabled={item.disabled}
        className={`
          context-menu-item
          ${item.disabled ? "context-menu-item-disabled" : ""}
          ${item.danger ? "context-menu-item-danger" : ""}
          ${showSubmenu || isActive ? "context-menu-item-active" : ""}
        `}
      >
        <span
          className={`context-menu-icon ${item.danger ? "text-red-400" : ""}`}
        >
          {icon}
        </span>
        <span className="context-menu-label">{item.label}</span>
        {item.submenu && (
          <svg
            className="w-3.5 h-3.5 opacity-50 flex-shrink-0 ml-auto"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 5l7 7-7 7"
            />
          </svg>
        )}
      </button>

      {showSubmenu &&
        item.submenu &&
        rowRect &&
        createPortal(
          <SubMenu
            items={item.submenu}
            closeMenu={closeMenu}
            parentRect={rowRect}
            containerBounds={containerBounds || defaultBounds}
          />,
          document.body,
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
  const [menuPosition, setMenuPosition] = useState<{
    x: number;
    y: number;
    maxHeight: number;
    transformOrigin: string;
  } | null>(null);
  const [containerBounds, setContainerBounds] = useState<Bounds>({
    left: 0,
    top: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
  });

  const menuWidth = 220;
  const padding = 12;
  const usePortal = portal !== undefined ? portal : true;

  useLayoutEffect(() => {
    requestAnimationFrame(() => {
      if (!menuRef.current) return;

      const menuRect = menuRef.current.getBoundingClientRect();
      const menuHeight = menuRect.height;

      let bounds: Bounds;

      if (containerRef?.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        bounds = {
          left: containerRect.left,
          top: containerRect.top,
          right: containerRect.right,
          bottom: containerRect.bottom,
        };
      } else {
        bounds = {
          left: 0,
          top: 0,
          right: window.innerWidth,
          bottom: window.innerHeight,
        };
      }

      setContainerBounds(bounds);

      const clickX = position.x;
      const clickY = position.y;

      let xPos = clickX;
      let flipHorizontal = false;

      if (clickX + menuWidth > bounds.right - padding) {
        xPos = clickX - menuWidth;
        flipHorizontal = true;
      }

      xPos = Math.max(
        bounds.left + padding,
        Math.min(xPos, bounds.right - menuWidth - padding),
      );

      let yPos = clickY;
      let flipVertical = false;

      if (clickY + menuHeight > bounds.bottom - padding) {
        yPos = clickY - menuHeight;
        flipVertical = true;
      }

      yPos = Math.max(
        bounds.top + padding,
        Math.min(yPos, bounds.bottom - menuHeight - padding),
      );

      const availableHeight = bounds.bottom - yPos - padding;
      const maxHeight = Math.min(380, availableHeight);

      const transformOrigin = `${flipHorizontal ? "right" : "left"} ${flipVertical ? "bottom" : "top"}`;

      setMenuPosition({
        x: xPos,
        y: yPos,
        maxHeight,
        transformOrigin,
      });
    });
  }, [position, containerRef, usePortal]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleScroll = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node)) {
        return;
      }
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

      // Filter out dividers for navigation
      const navigableItems = items.filter(
        (i) => i.label !== "divider" && !i.disabled,
      );

      switch (event.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowDown":
          setActiveIndex((prev) => (prev + 1) % navigableItems.length);
          break;
        case "ArrowUp":
          setActiveIndex(
            (prev) =>
              (prev - 1 + navigableItems.length) % navigableItems.length,
          );
          break;
        case "Enter":
          if (activeIndex >= 0 && navigableItems[activeIndex]) {
            const item = navigableItems[activeIndex];
            if (item.action) {
              item.action();
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

  const menuStyle: React.CSSProperties = menuPosition
    ? {
        position: "fixed",
        left: menuPosition.x,
        top: menuPosition.y,
        maxHeight: menuPosition.maxHeight,
        transformOrigin: menuPosition.transformOrigin,
        opacity: 1,
      }
    : {
        position: "fixed",
        left: position.x,
        top: position.y,
        opacity: 0,
        pointerEvents: "none",
      };

  // Filter items for rendering
  const renderItems = items.filter((item, idx) => {
    if (item.label === "divider") {
      // Don't render divider at start or end
      if (idx === 0 || idx === items.length - 1) return false;
      // Don't render consecutive dividers
      if (items[idx - 1]?.label === "divider") return false;
    }
    return true;
  });

  const menuElement = (
    <div
      ref={menuRef}
      className="context-menu-panel animate-in fade-in zoom-in-95 duration-100"
      style={menuStyle}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="overflow-y-auto themed-scrollbar"
        style={{ maxHeight: menuPosition?.maxHeight ?? 380 }}
      >
        {renderItems.map((item, index) =>
          item.label === "divider" ? (
            <div key={index} className="my-1.5 mx-3 h-px bg-white/[0.08]" />
          ) : (
            <ContextMenuItemRow
              key={index}
              item={item}
              closeMenu={onClose}
              isActive={index === activeIndex}
              onMouseEnter={() => setActiveIndex(index)}
              containerBounds={containerBounds}
            />
          ),
        )}
      </div>
    </div>
  );

  if (usePortal) {
    return createPortal(menuElement, document.body);
  }
  return menuElement;
};
