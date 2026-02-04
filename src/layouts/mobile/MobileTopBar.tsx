import { motion, AnimatePresence } from "framer-motion";
import { useRef, useEffect } from "react";

interface MobileTopBarProps {
  onSearchClick: () => void;
  onSettingsClick: () => void;
  activeTab?: string;
  query?: string;
  onQueryChange?: (query: string) => void;
}

export const MobileTopBar = ({
  onSearchClick,
  onSettingsClick,
  activeTab,
  query = "",
  onQueryChange,
}: MobileTopBarProps) => {
  const isSearchActive =
    activeTab === "search" || activeTab?.startsWith("search:");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSearchActive]);

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 px-4 pt-4 pb-2 flex items-center justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent backdrop-blur-[2px]"
      data-tauri-drag-region
    >
      {/* Search Bar / Input */}
      <AnimatePresence mode="wait">
        {isSearchActive ? (
          <motion.div
            key="input"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex-1 relative h-10 group"
          >
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => onQueryChange?.(e.target.value)}
              placeholder="Search global..."
              className="w-full h-full pl-10 pr-4 pt-[3px] rounded-full bg-theme-surface border border-white/5 text-theme-primary placeholder:text-theme-muted/70 outline-none focus:ring-2 focus:ring-theme-accent focus:border-transparent transition-all"
            />
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-accent"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </motion.div>
        ) : (
          <motion.button
            key="button"
            onClick={onSearchClick}
            layoutId="search-bar"
            whileTap={{ scale: 0.98 }}
            className="flex-1 flex items-center gap-3 h-10 px-4 rounded-full bg-theme-surface/60 border border-white/10 backdrop-blur-md shadow-sm relative overflow-hidden group text-left"
          >
            <svg
              className="w-4 h-4 text-theme-muted group-hover:text-theme-primary transition-colors shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <span className="text-sm text-theme-muted font-medium pt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
              Search...
            </span>

            {/* Shine Effect */}
            <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Settings Button */}
      {!isSearchActive && (
        <motion.button
          layout
          key="settings"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0 }}
          onClick={onSettingsClick}
          whileTap={{ scale: 0.9, rotate: 15 }}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-theme-surface/60 border border-white/10 backdrop-blur-md shadow-sm text-theme-muted hover:text-theme-primary hover:bg-theme-surface transition-all"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </motion.button>
      )}
    </div>
  );
};
