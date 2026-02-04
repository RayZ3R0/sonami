import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { ContextMenu, ContextMenuItem } from "../components/ContextMenu";
import { ActionSheet } from "../components/ActionSheet";
import { useIsMobile } from "../hooks/useIsMobile";

interface ActionSheetMeta {
  title?: string;
  subtitle?: string;
  coverImage?: string;
}

interface ContextMenuContextType {
  /** Show context menu (desktop) or action sheet (mobile) */
  showMenu: (
    items: ContextMenuItem[],
    position: { x: number; y: number },
    meta?: ActionSheetMeta,
  ) => void;
  /** Show action sheet explicitly (works on both desktop and mobile) */
  showActionSheet: (
    items: ContextMenuItem[],
    meta?: ActionSheetMeta,
  ) => void;
  /** Hide any open menu */
  hideMenu: () => void;
  /** Whether a menu is currently open */
  isMenuOpen: boolean;
}

const ContextMenuContext = createContext<ContextMenuContextType | null>(null);

export const useContextMenu = () => {
  const context = useContext(ContextMenuContext);
  if (!context) {
    throw new Error("useContextMenu must be used within a ContextMenuProvider");
  }
  return context;
};

export const ContextMenuProvider = ({ children }: { children: ReactNode }) => {
  const isMobile = useIsMobile();
  
  // Desktop context menu state
  const [contextMenu, setContextMenu] = useState<{
    items: ContextMenuItem[];
    position: { x: number; y: number };
  } | null>(null);

  // Mobile action sheet state
  const [actionSheet, setActionSheet] = useState<{
    items: ContextMenuItem[];
    meta: ActionSheetMeta;
  } | null>(null);

  const showMenu = useCallback(
    (
      items: ContextMenuItem[], 
      position: { x: number; y: number },
      meta?: ActionSheetMeta,
    ) => {
      if (isMobile) {
        // On mobile, show action sheet instead
        setActionSheet({ items, meta: meta || {} });
      } else {
        // On desktop, show regular context menu
        setContextMenu({ items, position });
      }
    },
    [isMobile],
  );

  const showActionSheet = useCallback(
    (items: ContextMenuItem[], meta?: ActionSheetMeta) => {
      setActionSheet({ items, meta: meta || {} });
    },
    [],
  );

  const hideMenu = useCallback(() => {
    setContextMenu(null);
    setActionSheet(null);
  }, []);

  const isMenuOpen = contextMenu !== null || actionSheet !== null;

  return (
    <ContextMenuContext.Provider value={{ showMenu, showActionSheet, hideMenu, isMenuOpen }}>
      {children}
      
      {/* Desktop Context Menu */}
      {contextMenu && !isMobile && (
        <ContextMenu
          items={contextMenu.items}
          position={contextMenu.position}
          onClose={hideMenu}
        />
      )}

      {/* Mobile Action Sheet */}
      {actionSheet && (
        <ActionSheet
          isOpen={true}
          items={actionSheet.items}
          title={actionSheet.meta.title}
          subtitle={actionSheet.meta.subtitle}
          coverImage={actionSheet.meta.coverImage}
          onClose={hideMenu}
        />
      )}
    </ContextMenuContext.Provider>
  );
};
