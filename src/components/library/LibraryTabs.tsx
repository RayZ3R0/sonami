import React from "react";

interface LibraryTabsProps {
  activeTab: "tracks" | "albums" | "artists";
  onTabChange: (tab: "tracks" | "albums" | "artists") => void;
}

export const LibraryTabs: React.FC<LibraryTabsProps> = ({
  activeTab,
  onTabChange,
}) => {
  return (
    <div className="flex gap-4 mb-6 border-b border-theme-border/50 pb-2">
      {(["tracks", "albums", "artists"] as const).map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={`
                        text-lg font-bold capitalize pb-2 px-1 transition-colors relative
                        ${activeTab === tab ? "text-theme-accent" : "text-theme-muted hover:text-theme-primary"}
                    `}
        >
          {tab}
          {activeTab === tab && (
            <span className="absolute bottom-0 left-0 w-full h-[2px] bg-theme-accent rounded-full mb-[-1px]" />
          )}
        </button>
      ))}
    </div>
  );
};
