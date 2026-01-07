import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

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
}

function SubMenu({ items, closeMenu }: { items: ContextMenuItem[], closeMenu: () => void }) {
    const ref = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (ref.current) {
            const rect = ref.current.getBoundingClientRect();
            // Flip horizontal if overflow right
            if (rect.right > window.innerWidth) {
                ref.current.style.left = 'auto';
                ref.current.style.right = '100%';
                ref.current.style.marginLeft = '0';
                ref.current.style.marginRight = '-4px';
            }
            // Flip vertical if overflow bottom
            if (rect.bottom > window.innerHeight) {
                ref.current.style.top = 'auto';
                ref.current.style.bottom = '0';
            }
        }
    }, []);

    return (
        <div
            ref={ref}
            className="absolute left-full top-0 -ml-1 min-w-[220px] py-1.5 bg-[#1a1a20] border border-white/10 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-100 origin-top-left ring-1 ring-black/5 max-h-[300px] overflow-y-auto themed-scrollbar z-50"
        >
            {items.map((item, index) => (
                <ContextMenuItemRow key={index} item={item} closeMenu={closeMenu} />
            ))}
        </div>
    );
}

function ContextMenuItemRow({ item, closeMenu }: { item: ContextMenuItem, closeMenu: () => void }) {
    const [showSubmenu, setShowSubmenu] = useState(false);
    const closeTimerRef = useRef<number | null>(null);

    // Cleanup timer on unmount
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
        }, 250); // 250ms delay for smoother UX
    };

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (item.disabled) return;

        if (item.submenu) {
            // Mobile: click to toggle
            if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
            setShowSubmenu(!showSubmenu);
        } else if (item.action) {
            item.action();
            closeMenu();
        }
    };

    return (
        <div
            className={`relative ${showSubmenu ? 'bg-white/10' : ''}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <button
                onClick={handleClick}
                disabled={item.disabled}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors ${item.disabled
                    ? 'opacity-50 cursor-not-allowed'
                    : item.danger
                        ? 'text-theme-error hover:bg-theme-error/10'
                        : 'text-theme-primary hover:bg-white/5'
                    }`}
            >
                {item.icon && <span className="w-4 h-4 opacity-70">{item.icon}</span>}
                <span className="flex-1 truncate">{item.label}</span>
                {item.submenu && (
                    <svg className="w-4 h-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                )}
            </button>

            {showSubmenu && item.submenu && (
                <SubMenu items={item.submenu} closeMenu={closeMenu} />
            )}
        </div>
    );
}

export const ContextMenu = ({ items, position, onClose }: ContextMenuProps) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleScroll = () => {
            onClose();
        };

        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('scroll', handleScroll, true);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [onClose]);

    // Ensure menu stays within viewport
    const style: React.CSSProperties = {
        top: Math.min(position.y, window.innerHeight - (items.length * 36) - 20), // rough estimate height cap
        left: Math.min(position.x, window.innerWidth - 220), // Width cap
    };

    return createPortal(
        <div
            ref={menuRef}
            className="fixed z-50 min-w-[200px] py-1.5 bg-[#1a1a20] border border-white/10 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-100 origin-top-left ring-1 ring-black/5"
            style={style}
            onContextMenu={(e) => e.preventDefault()}
        >
            {items.map((item, index) => (
                <ContextMenuItemRow key={index} item={item} closeMenu={onClose} />
            ))}
        </div>,
        document.body
    );
};
